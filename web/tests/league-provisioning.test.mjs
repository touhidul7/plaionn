import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('authenticated user can create a league and becomes commissioner, and can join demo',async()=>{
 const db=new PGlite();
 const league=id(10),commissioner=id(2),player=id(3),demoTenant='60000000-0000-4000-8000-000000000001';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611110001_league_provisioning.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160001_onboarding_and_demo_access.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[commissioner,player]);
  await db.query("insert into leagues(id,name) values($1,'Existing league')",[league]);
  await db.query("insert into leagues(id,name) values($1,'PLAIONN Client Demo')",[demoTenant]);
  await db.query("insert into league_memberships values($1,$2,'commissioner'),($1,$3,'player')",[league,commissioner,player]);
  await db.exec('set role authenticated');
  const as=user=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);

  await as(commissioner);
  await assert.rejects(db.query("select create_league('x')"),e=>e.code==='22023');
  const created=(await db.query("select create_league('Real League') as id")).rows[0].id;
  assert.notEqual(created,league);
  assert.equal((await db.query('select name from leagues where id=$1',[created])).rows[0].name,'Real League');
  assert.equal((await db.query("select role from league_memberships where league_id=$1 and user_id=$2",[created,commissioner])).rows[0].role,'commissioner');

  // Any authenticated user can now bootstrap their own league without requiring existing commissioner status
  await as(player);
  const playerLeague=(await db.query("select create_league('Player Own League') as id")).rows[0].id;
  assert.equal((await db.query('select name from leagues where id=$1',[playerLeague])).rows[0].name,'Player Own League');
  assert.equal((await db.query("select role from league_memberships where league_id=$1 and user_id=$2",[playerLeague,player])).rows[0].role,'commissioner');

  // Reviewer can join the demo league
  const joinedDemo=(await db.query("select join_demo_league() as id")).rows[0].id;
  assert.equal(joinedDemo,demoTenant);
  assert.equal((await db.query("select role from league_memberships where league_id=$1 and user_id=$2",[demoTenant,player])).rows[0].role,'commissioner');

  // Anonymous user is rejected
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query("select create_league('Anonymous league')"),e=>e.code==='42501');
  await assert.rejects(db.query("select join_demo_league()"),e=>e.code==='42501');
 }finally{await db.close();}
});
