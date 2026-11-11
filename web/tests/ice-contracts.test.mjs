import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {calculateIceContractUsage} from '../src/lib/ice-contracts.ts';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('ice contract costs distinguish purchased, allocated, scheduled and draft hours',()=>{
 const contract={id:'c',rink_id:'r',title:'Winter package',reference:'',start_date:'2027-01-01',end_date:'2027-01-31',purchased_hours:2,total_cost_cents:10000,currency:'CAD',status:'active',cancellation_reason:null};
 const slots=[
  {id:'s1',contract_id:'c',starts_at:'2027-01-04T18:00:00Z',ends_at:'2027-01-04T19:00:00Z'},
  {id:'s2',contract_id:'c',starts_at:'2027-01-05T18:00:00Z',ends_at:'2027-01-05T19:30:00Z'},
  {id:'s3',contract_id:null,starts_at:'2027-01-06T18:00:00Z',ends_at:'2027-01-06T19:00:00Z'},
 ];
 const [usage]=calculateIceContractUsage([contract],slots,[
  {ice_slot_id:'s1',status:'scheduled'},{ice_slot_id:'s2',status:'draft'},
 ]);
 assert.equal(usage.allocatedHours,2.5);
 assert.equal(usage.usedHours,1);
 assert.equal(usage.draftHours,1.5);
 assert.equal(usage.unallocatedHours,0);
 assert.equal(usage.overAllocatedHours,0.5);
 assert.equal(usage.unusedHours,1);
 assert.equal(usage.estimatedUsedCostCents,5000);
 assert.equal(usage.unutilizedCostCents,5000);
});

test('ice contract records and slot assignments enforce commissioner, rink, date, and audit rules',async()=>{
 const db=new PGlite(),league=id(1),admin=id(2),viewer=id(3),season=id(4),division=id(5);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610260001_league_foundation.sql','202610270001_season_settings.sql','202610280001_rosters.sql','202610280002_scheduling.sql','202611120001_schedule_inventory_generator.sql','202611140001_ice_contracts_utilization.sql'])
   await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[admin,viewer]);
  await db.query("insert into leagues(id,name) values($1,'Other League')",[id(99)]);
  await db.query("insert into league_memberships values($1,$2,'commissioner'),($1,$3,'player')",[league,admin,viewer]);
  await db.query("insert into seasons(id,league_id,name) values($1,$2,'Winter')",[season,league]);
  await db.query("insert into divisions(id,league_id,season_id,name) values($1,$2,$3,'Premier')",[division,league,season]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  const venue=(await db.query("select create_venue($1,'Test Arena','','America/Toronto','Rink 1') as id",[league])).rows[0].id;
  const rink=(await db.query('select id from rinks where venue_id=$1',[venue])).rows[0].id;
  const otherRink=(await db.query("select create_rink($1,'Rink 2') as id",[venue])).rows[0].id;
  const contract=(await db.query("select create_ice_contract($1,$2,'Winter package','Ref 1','2027-01-05','2027-01-31',2,10000,'CAD') as id",[league,rink])).rows[0].id;
  await assert.rejects(db.query("select create_ice_slot_with_contract($1,$2,$3,'2027-01-04T18:00:00Z','2027-01-04T19:00:00Z','prime',true,$4)",[league,division,rink,contract]),e=>e.message==='ICE_CONTRACT_SLOT_MISMATCH');
  await assert.rejects(db.query("select create_ice_slot_with_contract($1,$2,$3,'2027-01-05T18:00:00Z','2027-01-05T19:00:00Z','prime',true,$4)",[league,division,otherRink,contract]),e=>e.message==='ICE_CONTRACT_SLOT_MISMATCH');
  const slot=(await db.query("select create_ice_slot_with_contract($1,$2,$3,'2027-01-05T18:00:00Z','2027-01-05T19:00:00Z','prime',true,$4) as id",[league,division,rink,contract])).rows[0].id;
  assert.equal((await db.query('select contract_id from ice_slots where id=$1',[slot])).rows[0].contract_id,contract);
  assert.equal((await db.query("select count(*)::int as count from ice_slot_contract_audit where slot_id=$1",[slot])).rows[0].count,1);
  await assert.rejects(db.query("select cancel_ice_contract($1,'No longer needed')",[contract]),e=>e.message==='ICE_CONTRACT_HAS_ASSIGNED_SLOTS');
  await db.query('select assign_ice_slot_contract($1,null,$2)',[slot,'Release this slot']);
  await db.query("select cancel_ice_contract($1,'No longer needed')",[contract]);
  assert.equal((await db.query("select status,cancellation_reason from ice_contracts where id=$1",[contract])).rows[0].status,'cancelled');
  assert.equal((await db.query("select count(*)::int as count from ice_contract_audit where contract_id=$1 and action='cancelled'",[contract])).rows[0].count,1);
  await assert.rejects(db.query("select assign_ice_slot_contract($1,$2,'Assign cancelled')",[slot,contract]),e=>e.message==='ICE_CONTRACT_UNAVAILABLE');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
  assert.equal((await db.query('select count(*)::int as count from ice_contracts')).rows[0].count,0);
  await assert.rejects(db.query("select create_ice_contract($1,$2,'Unauthorized','', '2027-01-01','2027-01-31',1,0,'CAD')",[league,rink]),e=>e.code==='42501');
 }finally{await db.close();}
});
