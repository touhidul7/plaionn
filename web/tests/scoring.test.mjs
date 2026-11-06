import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {gameEventSchema} from '../src/lib/game-event-schema.ts';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const form={game_id:id(100),client_event_id:id(500),event_kind:'goal',team_entry_id:id(20),period:'1',clock_remaining:'19:42',player_id:id(30),assist_one_id:id(31),assist_two_id:'',penalty_minutes:''};

test('game-event form validates event kind, clock, assists, and penalty duration',()=>{
 const parsed=gameEventSchema.parse(form);
 assert.equal(parsed.clock_remaining,1182);
 assert.equal(parsed.assist_two_id,null);
 assert.equal(gameEventSchema.safeParse({...form,clock_remaining:'20:60'}).success,false);
 assert.equal(gameEventSchema.safeParse({...form,assist_one_id:id(30)}).success,false);
 assert.equal(gameEventSchema.safeParse({...form,event_kind:'goal',penalty_minutes:'2'}).success,false);
 assert.equal(gameEventSchema.safeParse({...form,event_kind:'penalty',penalty_minutes:'',assist_one_id:''}).success,false);
 assert.equal(gameEventSchema.safeParse({...form,event_kind:'penalty',penalty_minutes:'2',assist_one_id:'',assist_two_id:''}).success,true);
});

test('game scoring is assigned, idempotent, roster-validated, and corrected without deleting history',async()=>{
 const db=new PGlite();
 const league=id(1),admin=id(2),timekeeper=id(3),referee=id(4),viewer=id(5),season=id(6),division=id(7);
 const homeTeam=id(10),awayTeam=id(11),homeEntry=id(20),awayEntry=id(21);
 let scorer,assist,opponent,inactive;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610260001_league_foundation.sql','202610270001_season_settings.sql','202610280001_rosters.sql','202610280002_scheduling.sql','202610310001_official_assignments.sql','202611040001_standings_tiebreakers.sql','202611040002_game_events.sql']){
   await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  }
  await db.query('insert into auth.users(id) values($1),($2),($3),($4)',[admin,timekeeper,referee,viewer]);
  await db.query('insert into league_memberships values($1,$2,$3),($1,$4,$5),($1,$6,$7),($1,$8,$9)',[league,admin,'commissioner',timekeeper,'timekeeper',referee,'referee',viewer,'player']);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Winter')",[season,league]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier')",[division,league,season]);
  await db.query('insert into teams(id,league_id,name) values($1,$2,$3),($4,$2,$5)',[homeTeam,league,'Home',awayTeam,'Away']);
  await db.query('insert into team_entries(id,league_id,team_id,division_id) values($1,$2,$3,$4),($5,$2,$6,$4)',[homeEntry,league,homeTeam,division,awayEntry,awayTeam]);
  await db.query(`insert into season_settings(season_id,league_id,roster_limit,period_count,period_minutes,clock_mode,
   win_points,tie_points,loss_points,overtime_loss_points,billing_model,currency,team_fee_cents,player_fee_cents,
   registration_opens,registration_closes,standings_tiebreakers)
   values($1,$2,20,3,20,'stop',2,1,0,1,'both','CAD',0,0,null,null,array['wins','goal_difference','goals_for','head_to_head','fewest_penalties'])`,[season,league]);
  await db.exec('set role authenticated');
  const as=who=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);
  await as(admin);
  const players={};
  for(const name of ['Scorer','Assist','Opponent','Inactive']){
   players[name]=(await db.query('select create_league_player($1,$2) as id',[league,name])).rows[0].id;
  }
  scorer=players.Scorer;assist=players.Assist;opponent=players.Opponent;inactive=players.Inactive;
  for(const [name,playerId] of Object.entries(players)){
   const entry=name==='Opponent'?awayEntry:homeEntry;
   await db.query('select save_roster_member($1,$2,null,$3,$4,0)',[entry,playerId,'F',name==='Inactive'?'inactive':'active']);
  }
  const otherPlayer=(await db.query("select create_league_player($1,'Away player') as id",[league])).rows[0].id;
  await db.query('select save_roster_member($1,$2,null,$3,$4,0)',[awayEntry,otherPlayer,'F','active']);
  await db.query("select create_venue($1,'Arena','','UTC','One') as id",[league]);
  const rink=(await db.query('select id from rinks')).rows[0].id;
  await db.query("select save_scheduled_game($1,$2,$3,$4,$5,'2026-11-01T18:00:00Z',60,'scheduled',0,'Initial')",[id(100),league,homeEntry,awayEntry,rink]);
  await db.query("select save_game_official($1,$2,'timekeeper',$3,1,'Assign scorer')",[id(100),league,timekeeper]);
  await db.query("select save_game_official($1,$2,'referee_1',$3,2,'Assign referee')",[id(100),league,referee]);
  const add=(eventId,values={})=>{
   const args=[id(100),eventId,'goal',homeEntry,1,1182,scorer,assist,null,null];
   for(const [index,value] of Object.entries(values)) args[Number(index)]=value;
   return db.query('select add_game_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as id',args);
  };
  await as(timekeeper);
  const goal=(await add(id(500))).rows[0].id;
  assert.equal((await add(id(500))).rows[0].id,goal,'retry returns the original event');
  await assert.rejects(add(id(500),{5:1170}),e=>e.message==='EVENT_IDEMPOTENCY_CONFLICT');
  await assert.rejects(add(id(501),{6:inactive}),e=>e.message==='PLAYER_NOT_ACTIVE_ON_TEAM');
  await assert.rejects(add(id(502),{7:opponent}),e=>e.message==='INVALID_ASSIST');
  await assert.rejects(add(id(504),{4:4}),e=>e.message==='INVALID_GAME_EVENT');
  await assert.rejects(add(id(505),{5:1201}),e=>e.message==='INVALID_GAME_EVENT');
  await assert.rejects(add(id(506),{2:'penalty',7:null,9:null}),e=>e.message==='INVALID_PENALTY');
  const penalty=(await db.query('select add_game_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as id',[id(100),id(503),'penalty',awayEntry,1,1100,otherPlayer,null,null,2])).rows[0].id;
  assert.equal((await db.query('select * from game_events')).rows.length,2);
  await assert.rejects(db.query("select void_game_event($1,'Wrong role')",[goal]),e=>e.code==='42501');
  assert.equal((await db.query('select * from game_events')).rows.length,2,'timekeeper cannot void events');
  await as(viewer);
  assert.equal((await db.query('select * from game_events')).rows.length,0,'unassigned player cannot read private event feed');
  await assert.rejects(add(id(504)),e=>e.code==='42501');
  await as(referee);
  await db.query("select void_game_event($1,'Correct scorer entry')",[goal]);
  assert.equal((await db.query('select * from game_events')).rows.length,2,'void does not delete original event');
  assert.equal((await db.query('select * from game_event_voids')).rows.length,1);
  await assert.rejects(db.query("select void_game_event($1,'Duplicate correction')",[goal]),e=>e.code==='23505');
  await as(admin);
  await db.query("select void_game_event($1,'Commissioner correction')",[penalty]);
  assert.equal((await db.query('select * from game_event_voids')).rows.length,2,'commissioners can void events');
  assert.equal((await db.query(`select count(*) from game_events e
   where e.event_kind='goal' and not exists(select 1 from game_event_voids v where v.event_id=e.id)`)).rows[0].count,0,
   'voided goals do not contribute to the effective score');
  await as(referee);
  const original=(await db.query('select recorded_by,player_id from game_events where id=$1',[goal])).rows[0];
  assert.equal(original.recorded_by,timekeeper);
  assert.equal(original.player_id,scorer);
  await assert.rejects(db.query('delete from game_events'),e=>e.code==='42501');
  await assert.rejects(db.query('delete from game_event_voids'),e=>e.code==='42501');
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from game_events'),e=>e.code==='42501');
 }finally{await db.close();}
});
