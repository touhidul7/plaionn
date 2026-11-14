import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration(pg, filename) {
  const filePath = path.join(__dirname, "../supabase/migrations", filename);
  const sql = await fs.readFile(filePath, "utf8");
  await pg.exec(sql);
}

test("Security Guardrails: Rate Limiting, Audit Trail, and Credential Sanitization", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);

  const migrations = [
    "202610260001_league_foundation.sql",
    "202610270001_season_settings.sql",
    "202611160037_rate_limits_and_security_guardrails.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "a0000000-0000-0000-0000-000000000001";
  const commUserId = "a0000000-0000-0000-0000-000000000002";
  const regularUserId = "a0000000-0000-0000-0000-000000000003";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'comm@example.com'),
      ('${regularUserId}', 'player@example.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Security Test League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${commUserId}', 'commissioner');
  `);

  // 1. Rate Limiting verification
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${regularUserId}', false);
  `);

  // First request: succeeds
  const check1 = await pg.query(`select public.check_rate_limit('export_data', 2, 60) as allowed;`);
  assert.equal(check1.rows[0].allowed, true);

  // Second request: succeeds
  const check2 = await pg.query(`select public.check_rate_limit('export_data', 2, 60) as allowed;`);
  assert.equal(check2.rows[0].allowed, true);

  // Third request: check_rate_limit returns false
  const check3 = await pg.query(`select public.check_rate_limit('export_data', 2, 60) as allowed;`);
  assert.equal(check3.rows[0].allowed, false);

  // enforce_rate_limit must reject when limit is exceeded
  await assert.rejects(
    async () => {
      await pg.query(`select public.enforce_rate_limit('export_data', 2, 60);`);
    },
    /Rate limit exceeded for action export_data/
  );

  // 2. Secret sanitization test in security audit log
  await pg.query(`
    select public.log_security_audit_event(
      '${leagueId}',
      'api_key_configured',
      'info',
      '{"service": "broadcast", "secret": "super_secret_token", "apiKey": "12345", "status": "active"}'::jsonb
    );
  `);

  await pg.query(`
    select public.log_security_audit_event(
      '${leagueId}',
      'rate_limit_alert',
      'warning',
      '{"action": "export_data", "threshold": 2, "user_id": "${regularUserId}"}'::jsonb
    );
  `);

  // 3. Authorization check on get_league_security_audit_trail
  // Regular user cannot read audit trail
  await assert.rejects(
    async () => {
      await pg.query(`select * from public.get_league_security_audit_trail('${leagueId}');`);
    },
    /Commissioner permissions required/
  );

  // Commissioner can read audit trail and verify secret was sanitized
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const auditRes = await pg.query(`
    select * from public.get_league_security_audit_trail('${leagueId}');
  `);

  assert.ok(auditRes.rows.length >= 2, "Expected at least 2 audit entries");

  const configEvent = auditRes.rows.find((r) => r.action === "api_key_configured");
  assert.ok(configEvent, "api_key_configured event found");
  assert.equal(configEvent.details.service, "broadcast");
  assert.equal(configEvent.details.status, "active");
  // Ensure sensitive keys were stripped out completely!
  assert.equal(configEvent.details.secret, undefined);
  assert.equal(configEvent.details.apiKey, undefined);

  const rateLimitEvent = auditRes.rows.find((r) => r.action === "rate_limit_alert");
  assert.ok(rateLimitEvent, "rate_limit_alert event logged in audit trail");
  assert.equal(rateLimitEvent.severity, "warning");
});
