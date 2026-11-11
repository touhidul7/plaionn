-- Remove only the seeded Client Demo tenant after its replacement exists.
-- Before running: export a database backup, create the real league in the app,
-- verify your commissioner membership there, and remove only the demo league's
-- Storage folder (60000000-0000-4000-8000-000000000001/) in the Storage UI.
-- Auth users and user-owned player profiles are intentionally preserved.
begin;
do $$
declare
  demo_league constant uuid := '60000000-0000-4000-8000-000000000001';
begin
  if not exists(
    select 1 from public.leagues
    where id=demo_league and name='PLAIONN Client Demo'
  ) then
    raise exception 'Expected PLAIONN Client Demo tenant not found; no demo data removed.';
  end if;
  if not exists(
    select 1
    from public.league_memberships demo_membership
    join public.league_memberships real_membership
      on real_membership.user_id=demo_membership.user_id
     and real_membership.role='commissioner'
     and real_membership.league_id<>demo_league
    where demo_membership.league_id=demo_league
      and demo_membership.role='commissioner'
  ) then
    raise exception 'Create and verify your real league first; cleanup would otherwise remove your commissioner access.';
  end if;

  create temporary table demo_preview_player_ids on commit drop as
    select distinct player_id from public.league_players where league_id=demo_league;

  delete from public.registration_document_acceptances where league_id=demo_league;
  delete from public.registration_consents where league_id=demo_league;
  delete from public.registration_audit where league_id=demo_league;
  delete from public.player_registrations where league_id=demo_league;
  delete from public.game_event_voids where league_id=demo_league;
  delete from public.game_events where league_id=demo_league;
  delete from public.player_eligibility_overrides where league_id=demo_league;
  delete from public.official_assignment_audit where league_id=demo_league;
  delete from public.game_officials where league_id=demo_league;
  delete from public.schedule_audit where league_id=demo_league;
  delete from public.roster_audit where league_id=demo_league;
  delete from public.roster_memberships where league_id=demo_league;
  delete from public.season_settings_audit where league_id=demo_league;
  delete from public.season_settings where league_id=demo_league;
  delete from public.season_documents where league_id=demo_league;
  delete from public.games where league_id=demo_league;
  delete from public.rinks where league_id=demo_league;
  delete from public.venues where league_id=demo_league;
  delete from public.team_entries where league_id=demo_league;
  delete from public.teams where league_id=demo_league;
  delete from public.divisions where league_id=demo_league;
  delete from public.seasons where league_id=demo_league;
  delete from public.league_players where league_id=demo_league;
  delete from public.players player
  using demo_preview_player_ids seeded
  where player.id=seeded.player_id
    and player.owner_user_id is null
    and not exists(select 1 from public.league_players where player_id=player.id)
    and not exists(select 1 from public.player_registrations where player_id=player.id)
    and not exists(select 1 from public.roster_memberships where player_id=player.id);
  delete from public.league_memberships where league_id=demo_league;
  delete from public.leagues where id=demo_league;
end;
$$;
commit;
