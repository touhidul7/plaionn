begin;

create function public.get_live_scoreboard(target_game uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare fixture public.games;board jsonb;
begin
 select * into fixture from public.games where id=target_game;
 if auth.uid() is null or fixture.id is null or fixture.status<>'scheduled'
  or not public.is_league_member(fixture.league_id) then
  raise exception using errcode='42501',message='Scheduled league-member access required';
 end if;

 select jsonb_build_object(
  'game_id',fixture.id,
  'home_entry_id',fixture.home_entry_id,
  'away_entry_id',fixture.away_entry_id,
  'home_score',(select count(*) from public.game_events e
   where e.game_id=fixture.id and e.league_id=fixture.league_id
    and e.event_kind='goal' and e.team_entry_id=fixture.home_entry_id
    and not exists(select 1 from public.game_event_voids v where v.event_id=e.id)),
  'away_score',(select count(*) from public.game_events e
   where e.game_id=fixture.id and e.league_id=fixture.league_id
    and e.event_kind='goal' and e.team_entry_id=fixture.away_entry_id
    and not exists(select 1 from public.game_event_voids v where v.event_id=e.id)),
  'events',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',recent.id,'event_kind',recent.event_kind,'team_entry_id',recent.team_entry_id,
    'period',recent.period,'clock_seconds_remaining',recent.clock_seconds_remaining,
    'penalty_minutes',recent.penalty_minutes,'recorded_at',recent.recorded_at
   ) order by recent.recorded_at desc,recent.id desc)
   from (
    select e.id,e.event_kind,e.team_entry_id,e.period,e.clock_seconds_remaining,e.penalty_minutes,e.recorded_at
    from public.game_events e
    where e.game_id=fixture.id and e.league_id=fixture.league_id
     and not exists(select 1 from public.game_event_voids v where v.event_id=e.id)
    order by e.recorded_at desc,e.id desc limit 50
   ) recent
  ),'[]'::jsonb),
  'snapshot_at',statement_timestamp()
 ) into board;
 return board;
end; $$;

revoke all on function public.get_live_scoreboard(uuid) from public,anon,authenticated;
grant execute on function public.get_live_scoreboard(uuid) to authenticated;

commit;
