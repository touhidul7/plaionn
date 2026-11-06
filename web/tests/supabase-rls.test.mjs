import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { getSupabaseConfig, isPublicSupabaseKey } from "../src/lib/supabase/config.ts";

const migration = await readFile(new URL("../supabase/migrations/202610260001_league_foundation.sql", import.meta.url), "utf8");
const leagueA = "00000000-0000-4000-8000-000000000001";
const leagueB = "00000000-0000-4000-8000-000000000002";
const admin = "10000000-0000-4000-8000-000000000001";
const player = "10000000-0000-4000-8000-000000000002";
const season = "20000000-0000-4000-8000-000000000001";
const division = "30000000-0000-4000-8000-000000000001";

test("Supabase config accepts only public publishable or anon keys", () => {
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(isPublicSupabaseKey("sb_publishable_example"), true);
  assert.equal(isPublicSupabaseKey(jwt("anon")), true);
  assert.equal(isPublicSupabaseKey(jwt("service_role")), false);
  assert.equal(isPublicSupabaseKey("ssb_publishable_example"), false);
  assert.equal(isPublicSupabaseKey("not-a-key"), false);

  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_ANON_KEY"];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    process.env.NEXT_PUBLIC_ANON_KEY = jwt("anon");
    assert.deepEqual(getSupabaseConfig(), { url: "https://example.supabase.co", key: "sb_publishable_example" });
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_example";
    assert.deepEqual(getSupabaseConfig(), { url: "https://example.supabase.co", key: jwt("anon") });
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("service_role");
    process.env.NEXT_PUBLIC_ANON_KEY = "";
    assert.throws(() => getSupabaseConfig(), /Secret\/service-role keys are not allowed/);
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("Supabase policies restrict anonymous, player, and cross-league operations", async () => {
  const db = new PGlite();
  try {
    // Reproduce the relevant Auth identity/roles locally; this does not test the hosted Auth service.
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    await db.exec(migration);
    await db.query("insert into auth.users(id) values($1),($2)", [admin, player]);
    await db.query("insert into public.leagues(id,name) values($1,'Other League')", [leagueB]);
    await db.query("insert into public.league_memberships values($1,$2,'commissioner'),($1,$3,'player')", [leagueA, admin, player]);
    await db.query("insert into public.seasons(id,league_id,name) values($1,$2,'Winter')", [season, leagueA]);
    await db.query("insert into public.divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier')", [division, leagueA, season]);

    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.leagues"), e => e.code === "42501");
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [player]);
    const visible = await db.query("select id from public.leagues");
    assert.deepEqual(visible.rows.map(r => r.id), [leagueA]);
    await assert.rejects(db.query("insert into public.seasons(league_id,name) values($1,'Unauthorized')", [leagueA]), e => e.code === "42501");
    await assert.rejects(db.query("insert into public.league_memberships values($1,$2,'commissioner')", [leagueA, player]), e => e.code === "42501");
    await assert.rejects(db.query("select public.create_team_with_entry($1,$2,'Player Team')", [leagueA, division]), e => e.code === "42501");

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    await db.query("insert into public.seasons(league_id,name) values($1,'Summer')", [leagueA]);
    await assert.rejects(db.query("insert into public.seasons(league_id,name) values($1,'Intrusion')", [leagueB]), e => e.code === "42501");
    await db.query("select public.create_team_with_entry($1,$2,'Northline HC')", [leagueA, division]);
    const teams = await db.query("select name from public.teams");
    assert.equal(teams.rows[0].name, "Northline HC");
    await assert.rejects(db.query("select public.create_team_with_entry($1,$2,'Orphan')", [leagueA, "30000000-0000-4000-8000-000000000099"]), e => e.code === "23503");
    const orphan = await db.query("select id from public.teams where name='Orphan'");
    assert.equal(orphan.rows.length, 0);
  } finally { await db.close(); }
});
