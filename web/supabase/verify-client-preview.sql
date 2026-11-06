-- Read-only. Run as project owner in SQL Editor after migrations.
-- PASS requires zero returned rows. This does not replace signed-in browser tests.
with required_tables(name) as (values
 ('leagues'),('league_memberships'),('seasons'),('divisions'),('teams'),('team_entries'),
 ('season_settings'),('season_settings_audit'),('players'),('league_players'),
 ('roster_memberships'),('roster_audit'),('venues'),('rinks'),('games'),('schedule_audit'),
 ('game_officials'),('official_assignment_audit'),('player_registrations'),('registration_audit'),
 ('game_events'),('game_event_voids')
), issues as (
 select 'Missing table or disabled RLS: '||r.name as issue from required_tables r
 left join pg_catalog.pg_class c on c.oid=to_regclass('public.'||r.name)
 where c.oid is null or not c.relrowsecurity
 union all
 select 'Missing column: season_settings.standings_tiebreakers'
 where not exists(select 1 from information_schema.columns where table_schema='public' and table_name='season_settings' and column_name='standings_tiebreakers')
 union all
 select 'Missing scored-matchup trigger'
 where not exists(select 1 from pg_catalog.pg_trigger where tgname='scored_matchup_guard' and tgrelid=to_regclass('public.games') and tgenabled<>'D')
 union all
 select 'Missing RPC: '||signature from (values
 ('public.open_registration_seasons()'),
 ('public.submit_registration(uuid,text,text)'),
 ('public.decide_registration(uuid,text,integer,text)'),
 ('public.save_game_official(uuid,uuid,text,uuid,integer,text)'),
 ('public.list_game_score_roster(uuid)'),
 ('public.add_game_event(uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,integer)'),
 ('public.void_game_event(uuid,text)')
 ) f(signature) where to_regprocedure(signature) is null
)
select issue from issues order by issue;
