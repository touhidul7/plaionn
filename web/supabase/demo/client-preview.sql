-- Run manually in Supabase SQL Editor after ALL migrations.
-- First create/confirm the client's account in Supabase Auth.
-- Replace the email below. This grants commissioner access ONLY to this demo league.
-- No passwords, auth bypass, resets, or deletions. Reruns preserve edited demo records.
begin;
do $$
declare
 reviewer uuid;
 tenant constant uuid := '60000000-0000-4000-8000-000000000001';
 season constant uuid := '60000000-0000-4000-8000-000000000002';
 division constant uuid := '60000000-0000-4000-8000-000000000003';
 venue constant uuid := '60000000-0000-4000-8000-000000000004';
 rink constant uuid := '60000000-0000-4000-8000-000000000005';
 fixture constant uuid := '60000000-0000-4000-8000-000000000006';
 team uuid; entry uuid; player uuid; i integer; j integer;
begin
 select id into reviewer from auth.users where lower(email)=lower('REPLACE_WITH_CLIENT_EMAIL') and email_confirmed_at is not null;
 if reviewer is null then raise exception 'Create and confirm the client Auth account, then replace REPLACE_WITH_CLIENT_EMAIL in this script.'; end if;
 if exists(select 1 from public.leagues where id=tenant and name<>'PLAIONN Client Demo') then raise exception 'Demo league ID is already in use; no changes made.'; end if;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 insert into public.leagues(id,name) values(tenant,'PLAIONN Client Demo') on conflict(id) do nothing;
 insert into public.league_memberships(league_id,user_id,role) values(tenant,reviewer,'commissioner') on conflict do nothing;
 insert into public.seasons(id,league_id,name) values(season,tenant,'Client Review Season') on conflict(id) do nothing;
 insert into public.season_settings(season_id,league_id,roster_limit,period_count,period_minutes,clock_mode,win_points,tie_points,loss_points,overtime_loss_points,billing_model,currency,team_fee_cents,player_fee_cents,registration_opens,registration_closes,registration_enabled)
 values(season,tenant,20,3,20,'stop',2,1,0,1,'both','CAD',100000,15000,(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date+30,true)
 on conflict(season_id) do nothing;
 insert into public.divisions(id,league_id,season_id,name) values(division,tenant,season,'Premier') on conflict(id) do nothing;
 insert into public.venues(id,league_id,name,address,time_zone) values(venue,tenant,'Demo Arena','Test venue','America/Toronto') on conflict(id) do nothing;
 insert into public.rinks(id,league_id,venue_id,name) values(rink,tenant,venue,'Rink 1') on conflict(id) do nothing;
 for i in 1..2 loop
  team=('60000000-0000-4000-8000-'||lpad((10+i)::text,12,'0'))::uuid;
  entry=('60000000-0000-4000-8000-'||lpad((20+i)::text,12,'0'))::uuid;
  insert into public.teams(id,league_id,name) values(team,tenant,case i when 1 then 'Northline HC' else 'Harbour Wolves' end) on conflict(id) do nothing;
  insert into public.team_entries(id,league_id,team_id,division_id) values(entry,tenant,team,division) on conflict(id) do nothing;
  for j in 1..3 loop
   player=('60000000-0000-4000-8000-'||lpad((100+i*10+j)::text,12,'0'))::uuid;
   insert into public.players(id,display_name) values(player,case i when 1 then 'Northline Demo Player ' else 'Wolves Demo Player ' end||j) on conflict(id) do nothing;
   insert into public.league_players(league_id,player_id) values(tenant,player) on conflict do nothing;
   if not exists(select 1 from public.roster_memberships where team_entry_id=entry and player_id=player) then
    perform public.save_roster_member(entry,player,10+j,case j when 3 then 'G' else 'F' end,'active',0);
   end if;
  end loop;
 end loop;
 if not exists(select 1 from public.games where id=fixture) then
  perform public.save_scheduled_game(fixture,tenant,'60000000-0000-4000-8000-000000000021','60000000-0000-4000-8000-000000000022',rink,
   (((now() at time zone 'UTC')::date+7)+time '23:00') at time zone 'UTC',60,'scheduled',0,'Demo fixture');
 end if;
end; $$;
commit;
