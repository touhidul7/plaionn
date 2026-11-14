begin;

-- ============================================================================
-- Migration: 202611160033_player_dashboard_portal.sql
-- Unified Player Hub Dashboard: aggregates teams, next games with RSVP status,
-- personal skater/goalie career stats, active invoices/balances, documents, and news.
-- ============================================================================

create or replace function public.get_player_portal_dashboard()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  curr_user uuid;
  p_rec public.players;
  res jsonb;
  teams_json jsonb;
  games_json jsonb;
  stats_json jsonb;
  invoices_json jsonb;
  docs_json jsonb;
  announcements_json jsonb;
  goals_count integer;
  assists_count integer;
  pim_count integer;
  gp_count integer;
begin
  curr_user := auth.uid();
  if curr_user is null then
    raise exception 'Authentication required.';
  end if;

  -- 1. Locate player profile claimed by this user
  select * into p_rec
  from public.players
  where owner_user_id = curr_user
  limit 1;

  if p_rec.id is null then
    -- Check if registered via player_registrations
    select p.* into p_rec
    from public.player_registrations pr
    join public.players p on p.id = pr.player_id
    where pr.user_id = curr_user
    order by pr.created_at desc
    limit 1;
  end if;

  if p_rec.id is null then
    return jsonb_build_object(
      'has_profile', false,
      'user_id', curr_user,
      'teams', '[]'::jsonb,
      'upcoming_games', '[]'::jsonb,
      'career_stats', jsonb_build_object('goals', 0, 'assists', 0, 'points', 0, 'pim', 0, 'games_played', 0),
      'invoices', '[]'::jsonb,
      'documents', '[]'::jsonb,
      'announcements', '[]'::jsonb
    );
  end if;

  -- 2. Teams and Roster Memberships
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'team_id', t.id,
        'team_name', t.name,
        'team_entry_id', te.id,
        'division_id', d.id,
        'division_name', d.name,
        'season_id', s.id,
        'season_name', s.name,
        'league_id', l.id,
        'league_name', l.name,
        'jersey_number', rm.jersey_number,
        'position', rm.position,
        'status', rm.status
      )
    ),
    '[]'::jsonb
  ) into teams_json
  from public.roster_memberships rm
  join public.team_entries te on te.id = rm.team_entry_id
  join public.teams t on t.id = te.team_id
  join public.divisions d on d.id = te.division_id
  join public.seasons s on s.id = d.season_id
  join public.leagues l on l.id = rm.league_id
  where rm.player_id = p_rec.id;

  -- 3. Upcoming Games (for any team this player is actively on)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'game_id', g.id,
        'starts_at', g.starts_at,
        'status', g.status,
        'my_team_name', case when g.home_entry_id = my_te.id then ht.name else at.name end,
        'opponent_team_name', case when g.home_entry_id = my_te.id then at.name else ht.name end,
        'is_home', (g.home_entry_id = my_te.id),
        'venue_name', coalesce(v.name, 'TBD Arena'),
        'rink_name', coalesce(r.name, 'Main Rink'),
        'my_rsvp', coalesce(att.status, 'unanswered'),
        'rsvp_note', coalesce(att.note, '')
      )
      order by g.starts_at asc
    ),
    '[]'::jsonb
  ) into games_json
  from public.roster_memberships my_rm
  join public.team_entries my_te on my_te.id = my_rm.team_entry_id
  join public.games g on (g.home_entry_id = my_te.id or g.away_entry_id = my_te.id)
  join public.team_entries home_entry on home_entry.id = g.home_entry_id
  join public.teams ht on ht.id = home_entry.team_id
  join public.team_entries away_entry on away_entry.id = g.away_entry_id
  join public.teams at on at.id = away_entry.team_id
  left join public.rinks r on r.id = g.rink_id
  left join public.venues v on v.id = r.venue_id
  left join public.game_attendance att on (att.game_id = g.id and att.player_id = p_rec.id)
  where my_rm.player_id = p_rec.id
    and g.status = 'scheduled'
    and g.starts_at >= (now() - interval '4 hours')
  limit 6;

  -- 4. Personal Career Statistics
  select coalesce(count(*), 0) into goals_count
  from public.game_events ge
  where ge.event_kind = 'goal'
    and ge.player_id = p_rec.id
    and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id);

  select coalesce(count(*), 0) into assists_count
  from public.game_events ge
  where ge.event_kind = 'goal'
    and (ge.assist_one_id = p_rec.id or ge.assist_two_id = p_rec.id)
    and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id);

  select coalesce(sum(penalty_minutes), 0) into pim_count
  from public.game_events ge
  where ge.event_kind = 'penalty'
    and ge.player_id = p_rec.id
    and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id);

  select coalesce(count(distinct game_id), 0) into gp_count
  from (
    select game_id from public.game_attendance where player_id = p_rec.id and status = 'attending'
    union
    select game_id from public.game_events where player_id = p_rec.id or assist_one_id = p_rec.id or assist_two_id = p_rec.id
  ) gp_union;

  stats_json := jsonb_build_object(
    'goals', goals_count,
    'assists', assists_count,
    'points', goals_count + assists_count,
    'pim', pim_count,
    'games_played', gp_count
  );

  -- 5. Player and Team Invoices
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', inv.id,
        'title', inv.title,
        'recipient_type', inv.recipient_type,
        'amount_cents', inv.amount_cents,
        'amount_paid_cents', inv.amount_paid_cents,
        'balance_cents', (inv.amount_cents - inv.amount_paid_cents),
        'currency', inv.currency,
        'due_date', inv.due_date,
        'status', inv.status
      )
      order by inv.due_date asc nulls last
    ),
    '[]'::jsonb
  ) into invoices_json
  from public.league_invoices inv
  where (inv.recipient_type = 'player' and inv.player_id = p_rec.id)
     or (inv.recipient_type = 'team' and inv.team_entry_id in (
       select team_entry_id from public.roster_memberships where player_id = p_rec.id
     ))
  limit 10;

  -- 6. Signed Documents / Waivers
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', da.id,
        'title', da.document_title,
        'version', da.document_version,
        'signer_name', da.signer_name,
        'accepted_at', da.accepted_at
      )
      order by da.accepted_at desc
    ),
    '[]'::jsonb
  ) into docs_json
  from public.registration_document_acceptances da
  where da.player_id = p_rec.id or da.user_id = curr_user;

  -- 7. Announcements
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'body', a.message,
        'priority', a.priority,
        'created_at', a.created_at
      )
      order by case a.priority when 'urgent' then 1 when 'important' then 2 else 3 end, a.created_at desc
    ),
    '[]'::jsonb
  ) into announcements_json
  from public.league_announcements a
  where a.league_id in (
    select distinct league_id from public.league_memberships where user_id = curr_user
  )
  and (a.expires_at is null or a.expires_at > now())
  limit 5;

  return jsonb_build_object(
    'has_profile', true,
    'player_id', p_rec.id,
    'display_name', p_rec.display_name,
    'teams', teams_json,
    'upcoming_games', games_json,
    'career_stats', stats_json,
    'invoices', invoices_json,
    'documents', docs_json,
    'announcements', announcements_json
  );
end;
$$;

grant execute on function public.get_player_portal_dashboard() to authenticated;

commit;
