import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { resolveAdminPermissions } from "../src/lib/admin-permissions.ts";

test("admin scope fails closed for guests, unassigned users, and non-commissioners", () => {
  for (const [id, role, memberships] of [
    [null, "super_admin", [{ league_id: "a", role: "commissioner" }]],
    ["user", null, []],
    ["user", null, [{ league_id: "a", role: "player" }]],
  ]) {
    const access = resolveAdminPermissions(id, role, memberships);
    assert.equal(access.isPlatformAdmin, false);
    assert.equal(access.canManageLeague("a"), false);
  }
});

test("commissioners manage only their explicit assignments; platform roles are explicit", () => {
  const access = resolveAdminPermissions("user", null, [
    { league_id: "ontario", role: "commissioner" },
    { league_id: "second", role: "commissioner" },
    { league_id: "other", role: "player" },
  ]);
  assert.equal(access.isPlatformAdmin, false);
  assert.equal(access.canManageLeague("ontario"), true);
  assert.equal(access.canManageLeague("second"), true);
  assert.equal(access.canManageLeague("other"), false);
  assert.equal(resolveAdminPermissions("owner", "super_admin", []).canManageLeague("other"), true);
});

test("provisioning persists assignments atomically, imports once, and enforces RLS", async () => {
  const db = new PGlite();
  const owner = "27739759-8e9a-4cfc-a702-bdd5dbd8bf48";
  const commissioner = "00000000-0000-4000-8000-000000000001";
  const stranger = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon,service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;`);
    await db.query("insert into auth.users values ($1,'owner@example.test'),($2,'touhidul.islam.shadhin.77@gmail.com'),($3,'other@example.test')", [owner,commissioner,stranger]);
    for (const file of ["202610260001_league_foundation.sql", "202611240001_admin_league_assignments.sql", "202611240002_platform_league_operations.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec("set role service_role");
    const provision = () => db.query("select provision_admin_league('Ontario Central League','ontario.example.test','Winter 2026',$1,'touhidul.islam.shadhin.77@gmail.com','league-custom-ontario-1234') as id", [commissioner]);
    const league = (await provision()).rows[0].id;
    assert.equal((await provision()).rows[0].id, league);
    await assert.rejects(db.query("select provision_admin_league('Duplicate domain','ontario.example.test','Winter 2026',$1,'other@example.test',null)", [stranger]), e => e.code === "23505");
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as count from leagues where name in ('Ontario Central League','Duplicate domain')")).rows[0].count, 1);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [commissioner]);
    assert.deepEqual((await db.query("select id from leagues")).rows, [{id: league}]);
    assert.equal((await db.query("select * from platform_administrators")).rows.length, 0);
    assert.equal((await db.query("select * from admin_league_settings")).rows.length, 1);
    await assert.rejects(db.query("insert into platform_administrators values($1,'super_admin')", [commissioner]), e => e.code === "42501");
    await assert.rejects(provision(), e => e.code === "42501");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [stranger]);
    assert.equal((await db.query("select * from leagues")).rows.length, 0);
    assert.equal((await db.query("select * from admin_league_settings")).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    assert.equal((await db.query("select role from platform_administrators")).rows[0].role, "super_admin");
    await db.query("insert into seasons(league_id,name) values($1,'Summer 2027')", [league]);
    assert.equal((await db.query("select public.is_league_commissioner($1) as allowed", [league])).rows[0].allowed, true);
  } finally { await db.close(); }
});
