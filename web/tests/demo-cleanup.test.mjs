import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('demo cleanup requires replacement commissioner access and preserves other tenants and owned profiles',async()=>{
 const db=new PGlite();
 const demoLeague='60000000-0000-4000-8000-000000000001';
 const reviewer='70000000-0000-4000-8000-000000000001';
 const player=id(300);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text not null,name text not null,primary key(bucket_id,name));
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   grant select,insert,delete on storage.objects to authenticated;`);
  const migrationDir=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(migrationDir)).filter(file=>file.endsWith('.sql')).sort()){
   await db.exec(await readFile(new URL(name,migrationDir),'utf8'));
  }
  await db.query("insert into auth.users values($1,'reviewer@example.test',now())",[reviewer]);
  const seed=(await readFile(new URL('../supabase/demo/client-preview.sql',import.meta.url),'utf8')).replaceAll('REPLACE_WITH_CLIENT_EMAIL','reviewer@example.test');
  await db.exec(seed);
  const cleanup=await readFile(new URL('../supabase/demo/remove-client-preview.sql',import.meta.url),'utf8');

  await assert.rejects(db.exec(cleanup),/Create and verify your real league first/);
  await db.exec('rollback');
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[reviewer]);
  const realLeague=(await db.query("select create_league('Real Hockey League') as id")).rows[0].id;
  await db.exec('reset role');
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Real Season')",[id(302),realLeague]);
  await db.query("insert into auth.users values($1,'player@example.test',now())",[id(301)]);
  await db.query("insert into players(id,display_name,owner_user_id) values($1,'Owned player',$2)",[player,id(301)]);
  await db.query("insert into league_players(league_id,player_id) values($1,$2)",[demoLeague,player]);
  await db.exec(cleanup);

  assert.equal((await db.query('select count(*) from leagues where id=$1',[demoLeague])).rows[0].count,0);
  assert.equal((await db.query('select count(*) from league_memberships where league_id=$1',[demoLeague])).rows[0].count,0);
  assert.equal((await db.query('select count(*) from roster_memberships where league_id=$1',[demoLeague])).rows[0].count,0);
  assert.equal((await db.query('select count(*) from leagues where id=$1',[realLeague])).rows[0].count,1);
  assert.equal((await db.query('select count(*) from seasons where id=$1',[id(302)])).rows[0].count,1);
  assert.equal((await db.query('select count(*) from league_memberships where league_id=$1 and user_id=$2 and role=$3',[realLeague,reviewer,'commissioner'])).rows[0].count,1);
  assert.equal((await db.query('select count(*) from auth.users')).rows[0].count,2);
  assert.equal((await db.query('select count(*) from players where id=$1 and owner_user_id=$2',[player,id(301)])).rows[0].count,1);
 }finally{await db.close();}
});
