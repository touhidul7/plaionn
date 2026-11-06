begin;
-- Preserve the team meaning of previously recorded events, including voids.
create function public.guard_scored_matchup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.home_entry_id is distinct from old.home_entry_id or new.away_entry_id is distinct from old.away_entry_id)
 and exists(select 1 from public.game_events where game_id=old.id) then
  raise exception using errcode='P0001',message='SCORED_MATCHUP_LOCKED';
 end if;
 return new;
end; $$;
revoke all on function public.guard_scored_matchup() from public,anon,authenticated;
create trigger scored_matchup_guard before update of home_entry_id,away_entry_id on public.games
for each row execute function public.guard_scored_matchup();
commit;
