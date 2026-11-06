import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('demo setup requires a confirmed reviewer, reruns without duplicates, and protects scored matchups',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
  const script=(await readFile(new URL('../supabase/demo/client-preview.sql',import.meta.url),'utf8')).replaceAll('REPLACE_WITH_CLIENT_EMAIL','reviewer@example.test');
  await assert.rejects(db.exec(script),/Create and confirm/);
  await db.exec('rollback');
  const reviewer='70000000-0000-4000-8000-000000000001';
  await db.query("insert into auth.users values($1,'reviewer@example.test',now())",[reviewer]);
  await db.exec(script);await db.exec(script);
  assert.equal((await db.query('select * from roster_memberships')).rows.length,6);
  assert.equal((await db.query('select * from games')).rows.length,1);
  assert.equal((await db.query('select * from league_memberships')).rows.length,1);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[reviewer]);
  const game=(await db.query('select * from games')).rows[0];
  const roster=(await db.query('select * from list_game_score_roster($1)',[game.id])).rows;
  assert.equal(roster.length,6);
  const player=roster.find(p=>p.team_entry_id===game.home_entry_id);
  await db.query("select add_game_event($1,gen_random_uuid(),'goal',$2,1,600,$3,null,null,null)",[game.id,game.home_entry_id,player.player_id]);
  await assert.rejects(db.query("select save_scheduled_game($1,$2,$3,$4,$5,$6,60,'scheduled',1,'Swap teams')",[game.id,game.league_id,game.away_entry_id,game.home_entry_id,game.rink_id,game.starts_at]),e=>e.message==='SCORED_MATCHUP_LOCKED');
  assert.equal((await db.query('select * from games')).rows[0].home_entry_id,game.home_entry_id);
 }finally{await db.close();}
});
