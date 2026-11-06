import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {startInUtc,localGameTime,gameSchema,venueSchema} from '../src/lib/schedule-schema.ts';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('game times use venue zones and reject ambiguous or missing DST times',()=>{
 assert.equal(startInUtc('2026-10-28T21:30','America/Toronto'),'2026-10-29T01:30:00Z');
 assert.equal(startInUtc('2027-01-28T21:30','America/Toronto'),'2027-01-29T02:30:00Z');
 assert.equal(localGameTime('2026-10-29T01:30:00Z','America/Toronto'),'2026-10-28T21:30');
 assert.throws(()=>startInUtc('2026-03-08T02:30','America/Toronto'));
 assert.throws(()=>startInUtc('2026-11-01T01:30','America/Toronto'));
 assert.throws(()=>startInUtc('2026-02-30T21:30','America/Toronto'));
 assert.equal(venueSchema.safeParse({name:'Arena',address:'',time_zone:'Not/AZone',rink_name:'1'}).success,false);
 const form={id:id(100),home_entry_id:id(10),away_entry_id:id(11),rink_id:id(12),local_start:'2026-10-28T21:30',duration:'60',status:'draft',revision:'0',reason:''};
 assert.equal(gameSchema.safeParse(form).success,true);
 for(const changes of [{away_entry_id:id(10)},{duration:'0'},{duration:'60.5'},{revision:'1'},{status:'final'}]) assert.equal(gameSchema.safeParse({...form,...changes}).success,false);
});

test('schedule enforces conflicts, draft privacy, revisions, cancellation, and tenant boundaries',async()=>{
 const db=new PGlite();
 const league=id(1),other=id(2),admin=id(3),viewer=id(4),season=id(5),division=id(6),otherDivision=id(7);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610260001_league_foundation.sql','202610270001_season_settings.sql','202610280001_rosters.sql','202610280002_scheduling.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[admin,viewer]);
  await db.query("insert into leagues(id,name) values($1,'Other League')",[other]);
  await db.query("insert into league_memberships values($1,$2,'commissioner'),($1,$3,'player')",[league,admin,viewer]);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Winter')",[season,league]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier'),($4,$2,$3,'Other')",[division,league,season,otherDivision]);
  for(let i=0;i<5;i++){
   await db.query('insert into teams(id,league_id,name) values($1,$2,$3)',[id(10+i),league,'Team '+i]);
   await db.query('insert into team_entries(id,league_id,team_id,division_id) values($1,$2,$3,$4)',[id(20+i),league,id(10+i),i===4?otherDivision:division]);
  }
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await assert.rejects(db.query("select create_venue($1,'Invalid Arena','','Not/AZone','Rink 1')",[league]),e=>e.code==='22023');
  assert.equal((await db.query('select count(*)::int as n from venues')).rows[0].n,0);
  const venue=(await db.query("select create_venue($1,'Test Arena','Test Address','America/Toronto','Rink 1') as id",[league])).rows[0].id;
  const rink=(await db.query('select id from rinks')).rows[0].id;
  const rink2=(await db.query("select create_rink($1,'Rink 2') as id",[venue])).rows[0].id;
  const save=(game,home=20,away=21,arena=rink,time='2026-10-28T18:00:00Z',status='draft',revision=0,reason='')=>db.query('select save_scheduled_game($1,$2,$3,$4,$5,$6,60,$7,$8,$9) as revision',[id(game),league,id(home),id(away),arena,time,status,revision,reason]);
  await save(100);
  await assert.rejects(save(102,22,23,rink,'2026-10-28T18:30:00Z'),e=>e.message==='RINK_CONFLICT');
  await assert.rejects(save(102,20,22,rink2,'2026-10-28T18:30:00Z'),e=>e.message==='TEAM_CONFLICT');
  await assert.rejects(save(102,20,20),e=>e.message==='INVALID_MATCHUP');
  await assert.rejects(save(102,20,24),e=>e.message==='INVALID_MATCHUP');
  await assert.rejects(save(102,22,23,id(999)),e=>e.code==='42501');
  await save(101,20,21,rink,'2026-10-28T19:00:00Z');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
  assert.equal((await db.query('select * from games')).rows.length,0,'drafts must not be visible to players');
  await assert.rejects(save(103),e=>e.code==='42501');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await assert.rejects(save(100,20,21,rink,'2026-10-28T18:00:00Z','scheduled',1,''),e=>e.message==='CHANGE_REASON_REQUIRED');
  await save(100,20,21,rink,'2026-10-28T18:00:00Z','scheduled',1,'Publish fixture');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
  assert.equal((await db.query('select * from games')).rows.length,1);
  assert.equal((await db.query('select * from schedule_audit')).rows.length,0);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await save(100,20,21,rink,'2026-10-28T18:00:00Z','cancelled',2,'Rink unavailable');
  await save(102,22,23,rink,'2026-10-28T18:00:00Z');
  await assert.rejects(save(100,20,21,rink,'2026-10-28T20:00:00Z','scheduled',2,'Stale edit'),e=>e.message==='GAME_STALE');
  await assert.rejects(save(100,20,21,rink,'2026-10-28T18:00:00Z','scheduled',3,'Reinstate fixture'),e=>e.message==='RINK_CONFLICT');
  await save(100,20,21,rink,'2026-10-28T20:00:00Z','scheduled',3,'New ice time');
  const history=await db.query('select * from schedule_audit where game_id=$1',[id(100)]);
  assert.equal(history.rows.length,4);
  assert.ok(history.rows.some(r=>r.new_record.status==='cancelled'));
  assert.ok(history.rows.every(r=>r.actor_id===admin));
  await assert.rejects(db.query("update games set status='cancelled'"),e=>e.code==='42501');
  await assert.rejects(db.query('delete from schedule_audit'),e=>e.code==='42501');
  await db.exec('reset role');
  await db.query('delete from league_memberships where user_id=$1',[viewer]);
  await db.query("insert into league_memberships values($1,$2,'commissioner')",[other,viewer]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
  assert.equal((await db.query('select * from games')).rows.length,0);
  await assert.rejects(save(103),e=>e.code==='42501');
  await assert.rejects(db.query("select create_rink($1,'Intrusion')",[venue]),e=>e.code==='42501');
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from games'),e=>e.code==='42501');
 }finally{await db.close();}
});
