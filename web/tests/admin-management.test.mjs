import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Admin Management: Appointing and revoking commissioner and staff members by email", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text
    );
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      bucket_id text not null,
      name text not null,
      primary key(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public, storage to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant select, insert, delete on storage.objects to authenticated;
  `);

  const migrationsDir = path.join(__dirname, "../supabase/migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    await pg.exec(sql);
  }

  // Setup test users in auth.users
  const commUserId = "11111111-1111-1111-1111-111111111111";
  const newAdminId = "22222222-2222-2222-2222-222222222222";
  const refereeId  = "33333333-3333-3333-3333-333333333333";

  await pg.query(`
    insert into auth.users (id, email) values
    ('${commUserId}', 'commissioner@league.com'),
    ('${newAdminId}', 'newadmin@league.com'),
    ('${refereeId}', 'ref@officials.org')
    on conflict (id) do nothing;
  `);

  // Set commissioner session
  await pg.exec(`set request.jwt.claim.sub = '${commUserId}';`);

  const createdLeague = await pg.query(`
    select public.create_league('Metro Hockey Circuit') as league_id;
  `);
  const leagueId = createdLeague.rows[0].league_id;

  // 1. Initial staff list should have 1 commissioner
  const staffInitial = await pg.query(`
    select * from public.get_league_staff_members('${leagueId}');
  `);
  assert.equal(staffInitial.rows.length, 1);
  assert.equal(staffInitial.rows[0].email, 'commissioner@league.com');
  assert.equal(staffInitial.rows[0].role, 'commissioner');

  // 2. Commissioner adds another commissioner by email
  const addRes = await pg.query(`
    select public.add_league_member_by_email('${leagueId}', 'newadmin@league.com', 'commissioner') as result;
  `);
  assert.equal(addRes.rows[0].result.success, true);
  assert.equal(addRes.rows[0].result.email, 'newadmin@league.com');

  // 3. Commissioner adds a referee by email
  await pg.query(`
    select public.add_league_member_by_email('${leagueId}', 'ref@officials.org', 'referee');
  `);

  // 4. Verify staff list has 3 members
  const staffUpdated = await pg.query(`
    select * from public.get_league_staff_members('${leagueId}');
  `);
  assert.equal(staffUpdated.rows.length, 3);
  const roles = staffUpdated.rows.map(r => `${r.role}:${r.email}`).sort();
  assert.ok(roles.includes('commissioner:commissioner@league.com'));
  assert.ok(roles.includes('commissioner:newadmin@league.com'));
  assert.ok(roles.includes('referee:ref@officials.org'));

  // 5. Test unknown email throws P0002
  await assert.rejects(
    async () => {
      await pg.query(`
        select public.add_league_member_by_email('${leagueId}', 'unknown@nobody.com', 'commissioner');
      `);
    },
    (err) => err.message.includes("No account exists with this email address")
  );

  // 6. Test removing a referee
  await pg.query(`
    select public.remove_league_member('${leagueId}', '${refereeId}', 'referee');
  `);

  const staffAfterRemove = await pg.query(`
    select * from public.get_league_staff_members('${leagueId}');
  `);
  assert.equal(staffAfterRemove.rows.length, 2);

  // 7. Test removing commissioner (allowed because 2 commissioners exist)
  await pg.query(`
    select public.remove_league_member('${leagueId}', '${newAdminId}', 'commissioner');
  `);

  // 8. Test safety guard: cannot remove the sole remaining commissioner
  await assert.rejects(
    async () => {
      await pg.query(`
        select public.remove_league_member('${leagueId}', '${commUserId}', 'commissioner');
      `);
    },
    (err) => err.message.includes("Cannot remove the only remaining commissioner")
  );

  console.log("Admin Management verification passed successfully!");
});
