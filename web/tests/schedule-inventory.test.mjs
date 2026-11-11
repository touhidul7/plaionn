import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('ice inventory, schedule generation, review, and publishing are tenant- and rule-guarded',async()=>{
 const db=new PGlite(),league=id(1),admin=id(2),viewer=id(3),season=id(4),division=id(5),otherDivision=id(6);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610260001_league_foundation.sql','202610270001_season_settings.sql','202610280001_rosters.sql','202610280002_scheduling.sql','202611120001_schedule_inventory_generator.sql'])
   await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[admin,viewer]);
  await db.query("insert into leagues(id,name) values($1,'Other League')",[id(99)]);
  await db.query("insert into league_memberships values($1,$2,'commissioner'),($1,$3,'player')",[league,admin,viewer]);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Winter')",[season,league]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier'),($4,$2,$3,'Other')",[division,league,season,otherDivision]);
  for(let i=0;i<5;i++){
   await db.query('insert into teams(id,league_id,name) values($1,$2,$3)',[id(10+i),league,'Team '+i]);
   await db.query('insert into team_entries(id,league_id,team_id,division_id) values($1,$2,$3,$4)',[id(20+i),league,id(10+i),i===4?otherDivision:division]);
  }
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  const venue=(await db.query("select create_venue($1,'Test Arena','','America/Toronto','Rink 1') as id",[league])).rows[0].id;
  const rink=(await db.query('select id from rinks where venue_id=$1',[venue])).rows[0].id;
  const dates=['2027-01-04','2027-01-05','2027-01-11','2027-01-12','2027-01-18','2027-01-19'];
  const slots=[];
  for(const date of dates){
   const slot=(await db.query("select create_ice_slot($1,$2,$3,$4,$5,'prime',true) as id",
    [league,division,rink,date+'T18:00:00Z',date+'T19:00:00Z'])).rows[0].id;
   slots.push(slot);
  }
  const optional=(await db.query("select create_ice_slot($1,$2,$3,$4,$5,'late',false) as id",
   [league,division,rink,'2027-01-25T18:00:00Z','2027-01-25T19:00:00Z'])).rows[0].id;
  const pairs=[[20,21],[22,23],[20,22],[21,23],[20,23],[21,22]];
  const fixtures=pairs.map(([home,away],i)=>({game_id:id(100+i),slot_id:slots[i],home_entry_id:id(home),away_entry_id:id(away)}));
  await db.query('select save_schedule_blackout($1,$2,$3,false)',[division,id(20),'2027-01-04']);
  await assert.rejects(
   db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],false,$2::jsonb)",[division,JSON.stringify(fixtures)]),
   e=>e.message==='TEAM_BLACKOUT'
  );
  await db.query('select save_schedule_blackout($1,$2,$3,true)',[division,id(20),'2027-01-04']);
  const extraRequired=(await db.query("select create_ice_slot($1,$2,$3,$4,$5,'late',true) as id",
   [league,division,rink,'2027-01-26T18:00:00Z','2027-01-26T19:00:00Z'])).rows[0].id;
  await assert.rejects(
   db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],false,$2::jsonb)",[division,JSON.stringify(fixtures)]),
   e=>e.message==='REQUIRED_SLOT_UNUSED'
  );
  await db.query('select remove_ice_slot($1)',[extraRequired]);
  assert.equal((await db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],false,$2::jsonb) as count",[division,JSON.stringify(fixtures)])).rows[0].count,6);
  assert.equal((await db.query("select count(*)::int as count from games where status='draft'")).rows[0].count,6);
  await assert.rejects(db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],false,$2::jsonb)",[division,JSON.stringify(fixtures.map((fixture,index)=>({...fixture,game_id:id(300+index)})))]),e=>e.message==='REPLACEMENT_CONFIRMATION_REQUIRED');
  const replacement=fixtures.map((fixture,index)=>({...fixture,game_id:id(300+index)}));
  assert.equal((await db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],true,$2::jsonb) as count",[division,JSON.stringify(replacement)])).rows[0].count,6);
  assert.equal((await db.query("select count(*)::int as count from games where status='cancelled' and generated_schedule")).rows[0].count,6);
  assert.equal((await db.query('select count(*)::int as count from schedule_audit')).rows[0].count,18);
  const savedRules=(await db.query('select preferred_weekdays from schedule_generation_rules where division_id=$1',[division])).rows[0];
  assert.deepEqual(savedRules.preferred_weekdays,[2]);
  await db.query('select save_schedule_blackout($1,$2,$3,false)',[division,id(20),'2027-01-31']);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
  await assert.rejects(db.query('select save_schedule_blackout($1,$2,$3,false)',[division,id(20),'2027-02-01']),e=>e.code==='42501');
  assert.equal((await db.query('select count(*)::int as count from ice_slots')).rows[0].count,7);
  assert.equal((await db.query('select count(*)::int as count from schedule_team_blackouts')).rows[0].count,0);
  await assert.rejects(db.query("select publish_schedule_drafts($1,'2027-01-01','2027-01-31')",[division]),e=>e.code==='42501');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  assert.equal((await db.query("select publish_schedule_drafts($1,'2027-01-01','2027-01-31') as count",[division])).rows[0].count,6);
  assert.equal((await db.query("select count(*)::int as count from games where status='scheduled' and revision=2")).rows[0].count,6);
  assert.equal((await db.query("select count(*)::int as count from schedule_audit where reason='Published generated schedule' and previous_record->>'status'='draft'")).rows[0].count,6);
  await assert.rejects(
   db.query("select generate_schedule_drafts($1,'2027-01-01','2027-01-31',1,1,20,ARRAY[2]::smallint[],true,$2::jsonb)",[division,JSON.stringify(replacement.map((fixture,index)=>({...fixture,game_id:id(400+index)})))]),
   e=>e.message==='PUBLISHED_SCHEDULE_EXISTS'
  );
  const manualGame=id(200);
  await db.query("select save_scheduled_game($1,$2,$3,$4,$5,'2027-01-25T18:00:00Z',60,'draft',0,'')",
   [manualGame,league,id(20),id(21),rink]);
  assert.equal((await db.query('select ice_slot_id from games where id=$1',[manualGame])).rows[0].ice_slot_id,optional);
  await db.query("select save_scheduled_game($1,$2,$3,$4,$5,'2027-01-25T18:00:00Z',60,'cancelled',1,'Cancel manual fixture')",
   [manualGame,league,id(20),id(21),rink]);
  assert.equal((await db.query('select ice_slot_id from games where id=$1',[manualGame])).rows[0].ice_slot_id,null);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from ice_slots'),e=>e.code==='42501');
  await assert.rejects(db.query('select * from schedule_generation_rules'),e=>e.code==='42501');
  await assert.rejects(db.query("select create_ice_slot($1,$2,$3,$4,$5,'early',true)",[id(99),division,rink,'2027-02-01T18:00:00Z','2027-02-01T19:00:00Z']),e=>e.code==='42501');
 }finally{await db.close();}
});
