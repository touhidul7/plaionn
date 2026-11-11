import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {liveScoreboardSchema} from '../src/lib/live-scoreboard.ts';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('live scoreboard shares only scheduled game events with league members',async()=>{
 const db=new PGlite(),league=id(1),member=id(2),outsider=id(3),home=id(4),away=id(5),game=id(6);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table public.memberships(league_id uuid,user_id uuid);
   create function public.is_league_member(target_league uuid) returns boolean language sql stable security definer set search_path=''
    as $$ select exists(select 1 from public.memberships where league_id=target_league and user_id=auth.uid()) $$;
   grant usage on schema auth,public to authenticated,anon;
   grant execute on function auth.uid(),public.is_league_member(uuid) to authenticated,anon;
   create table public.games(id uuid,league_id uuid,status text,home_entry_id uuid,away_entry_id uuid);
   create table public.game_events(id uuid,game_id uuid,league_id uuid,event_kind text,team_entry_id uuid,period integer,
    clock_seconds_remaining integer,penalty_minutes integer,recorded_at timestamptz,recorded_by uuid);
   create table public.game_event_voids(event_id uuid,game_id uuid,league_id uuid);
   grant select on public.games,public.game_events,public.game_event_voids to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611150001_live_scoreboard.sql',import.meta.url),'utf8'));
  await db.query('insert into public.memberships values($1,$2)',[league,member]);
  await db.query('insert into public.games values($1,$2,$3,$4,$5),($6,$2,$7,$4,$5)',[game,league,'scheduled',home,away,id(7),'draft']);
  await db.query(`insert into public.game_events values
   ($1,$2,$3,'goal',$4,1,600,null,'2026-11-09T10:00:00Z',$5),
   ($6,$2,$3,'goal',$4,2,500,null,'2026-11-09T10:01:00Z',$5),
   ($7,$2,$3,'penalty',$8,2,450,2,'2026-11-09T10:02:00Z',$5)`,
   [id(10),game,league,home,member,id(11),id(12),away]);
  await db.query('insert into public.game_event_voids values($1,$2,$3)',[id(11),game,league]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member]);
  const {rows}=await db.query('select public.get_live_scoreboard($1) as board',[game]);
  const board=rows[0].board;
  assert.equal(liveScoreboardSchema.safeParse(board).success,true);
  assert.equal(board.home_score,1);
  assert.equal(board.away_score,0);
  assert.deepEqual(board.events.map(event=>event.id),[id(12),id(10)]);
  assert.equal(JSON.stringify(board).includes('recorded_by'),false);
  await assert.rejects(db.query('select public.get_live_scoreboard($1)',[id(7)]),e=>e.code==='42501');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  await assert.rejects(db.query('select public.get_live_scoreboard($1)',[game]),e=>e.code==='42501');
 }finally{await db.close();}
});
