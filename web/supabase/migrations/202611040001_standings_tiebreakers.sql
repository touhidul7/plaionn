begin;

alter table public.season_settings
 add column standings_tiebreakers text[] not null default array[
  'wins','goal_difference','goals_for','head_to_head','fewest_penalties'
 ]::text[],
 add constraint season_settings_valid_standings_tiebreakers check(
  cardinality(standings_tiebreakers)=5
  and standings_tiebreakers @> array[
   'wins','head_to_head','goal_difference','goals_for','fewest_penalties'
  ]::text[]
 );

grant update(standings_tiebreakers) on public.season_settings to authenticated;

commit;
