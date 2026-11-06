import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {officialSchema} from '../src/lib/official-schema.ts';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('official form rejects invalid slot, identity, reason, and revision',()=>{
 const valid={game_id:id(100),slot:'timekeeper',user_id:id(8),revision:'1',reason:'Assign crew'};
 assert.equal(officialSchema.safeParse(valid).success,true);
 assert.equal(officialSchema.safeParse({...valid,user_id:''}).success,true);
 for(const v of [{slot:'commissioner'},{user_id:'wrong'},{revision:0},{reason:'  '}]) assert.equal(officialSchema.safeParse({...valid,...v}).success,false);
});
test('official assignments enforce roles, overlaps, revisions, rescheduling and private audit',async()=>{
 const db=new PGlite();
 const league=id(1),other=id(2),admin=id(3),viewer=id(4),season=id(5),division=id(6),otherDivision=id(7),official=id(8);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610260001_league_foundation.sql','202610270001_season_settings.sql','202610280001_rosters.sql','202610280002_scheduling.sql','202610310001_official_assignments.sql','202611040002_game_events.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[admin,viewer]);
  await db.query("insert into leagues(id,name) values($1,'Other League')",[other]);
  await db.query("insert into league_memberships values($1,$2,'commissioner'),($1,$3,'player')",[league,admin,viewer]);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Winter')",[season,league]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier'),($4,$2,$3,'Other')",[division,league,season,otherDivision]);
  for(let i=0;i<5;i++){
   await db.query('insert into teams(id,league_id,name) values($1,$2,$3)',[id(10+i),league,'Team '+i]);
   await db.query('insert into team_entries(id,league_id,team_id,division_id) values($1,$2,$3,$4)',[id(20+i),league,id(10+i),i===4?otherDivision:division]);
  }

  await db.query("insert into auth.users(id,email) values($1,'official@example.test')",[official]);
  await db.query("insert into league_memberships values($1,$2,'referee'),($1,$2,'timekeeper')",[league,official]);
  await db.exec('set role authenticated');
  const as=who=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);
  await as(admin);
  const venue=(await db.query("select create_venue($1,'Arena','','UTC','One') as id",[league])).rows[0].id;
  const rink=(await db.query('select id from rinks')).rows[0].id;
  const rink2=(await db.query("select create_rink($1,'Two') as id",[venue])).rows[0].id;
  const save=(game,time,status='draft',revision=0)=>db.query('select save_scheduled_game($1,$2,$3,$4,$5,$6,60,$7,$8,$9)',[id(game),league,id(game===100?20:22),id(game===100?21:23),game===100?rink:rink2,time,status,revision,'Fixture change']);
  const assign=(game,user=official,slot='timekeeper',revision=1)=>db.query('select save_game_official($1,$2,$3,$4,$5,$6)',[id(game),league,slot,user,revision,'Crew change']);
  await save(100,'2026-11-01T18:00:00Z');
  await save(101,'2026-11-01T18:30:00Z');
  assert.equal((await db.query('select * from list_league_officials($1)',[league])).rows.length,2);
  await assert.rejects(assign(100,viewer),e=>e.message==='OFFICIAL_ROLE_REQUIRED');
  await assign(100);
  await assert.rejects(assign(100,official,'referee_1',2),e=>e.message==='OFFICIAL_DUPLICATE');
  await assert.rejects(assign(100,null,'timekeeper',1),e=>e.message==='GAME_STALE');
  await assert.rejects(assign(101),e=>e.message==='OFFICIAL_CONFLICT');
  await save(101,'2026-11-01T19:00:00Z','scheduled',1);
  await assign(101,official,'referee_1',2);
  await assert.rejects(save(101,'2026-11-01T18:45:00Z','scheduled',3),e=>e.message==='OFFICIAL_CONFLICT');
  await as(official);
  assert.equal((await db.query('select * from game_officials')).rows.length,1,'draft crew hidden even from assigned official');
  assert.equal((await db.query('select * from official_assignment_audit')).rows.length,0);
  await assert.rejects(db.query('select * from list_league_officials($1)',[league]),e=>e.code==='42501');
  await assert.rejects(assign(100,null,'timekeeper',2),e=>e.code==='42501');
  await as(viewer);
  assert.equal((await db.query('select * from game_officials')).rows.length,0);
  await as(admin);
  await save(100,'2026-11-01T18:00:00Z','cancelled',2);
  await save(101,'2026-11-01T18:30:00Z','scheduled',3);
  await assert.rejects(save(100,'2026-11-01T18:00:00Z','scheduled',3),e=>e.message==='OFFICIAL_CONFLICT');
  await assert.rejects(assign(100,official,'referee_1',3),e=>e.message==='GAME_CANCELLED');
  await assign(100,null,'timekeeper',3);
  await save(100,'2026-11-01T18:00:00Z','scheduled',4);
  const audit=(await db.query('select * from official_assignment_audit order by changed_at')).rows;
  assert.equal(audit.length,3);
  assert.ok(audit.every(a=>a.actor_id===admin));
  assert.ok(audit.some(a=>a.new_record===null&&a.previous_record.user_id===official));
  await assert.rejects(db.query('delete from game_officials'),e=>e.code==='42501');
  await assert.rejects(db.query('delete from official_assignment_audit'),e=>e.code==='42501');
  await db.exec('reset role');
  await db.query("insert into league_memberships values($1,$2,'commissioner')",[other,viewer]);
  await db.exec('set role authenticated');
  await as(viewer);
  await assert.rejects(db.query('select save_game_official($1,$2,$3,$4,$5,$6)',[id(100),other,'referee_1',viewer,5,'Wrong league']),e=>e.code==='42501');
  // A shared official cannot be double-booked through another league either.
  await db.exec('reset role');
  await db.query("insert into league_memberships values($1,$2,'referee')",[other,official]);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Other season')",[id(200),other]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Division')",[id(201),other,id(200)]);
  for(let n=0;n<2;n++){
   await db.query('insert into teams(id,league_id,name) values($1,$2,$3)',[id(210+n),other,'Other '+n]);
   await db.query('insert into team_entries(id,league_id,team_id,division_id) values($1,$2,$3,$4)',[id(220+n),other,id(210+n),id(201)]);
  }
  await db.exec('set role authenticated');
  await as(viewer);
  const otherVenue=(await db.query("select create_venue($1,'Other Arena','','UTC','One') as id",[other])).rows[0].id;
  const otherRink=(await db.query('select id from rinks where venue_id=$1',[otherVenue])).rows[0].id;
  await db.query("select save_scheduled_game($1,$2,$3,$4,$5,'2026-11-01T18:45:00Z',60,'scheduled',0,'Initial')",[id(230),other,id(220),id(221),otherRink]);
  await assert.rejects(db.query("select save_game_official($1,$2,'referee_1',$3,1,'Other booking')",[id(230),other,official]),e=>e.message==='OFFICIAL_CONFLICT');
  assert.equal((await db.query('select * from game_officials')).rows.length,0,'other league crew stays private');
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from game_officials'),e=>e.code==='42501');
 }finally{await db.close();}
});
