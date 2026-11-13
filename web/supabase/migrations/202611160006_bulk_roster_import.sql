begin;

-- ============================================================================
-- Migration: 202611160006_bulk_roster_import.sql
-- Enables commissioners to import complete team rosters from CSV/JSON
-- with duplicate checks, position validation, limit guards, and audit history.
-- ============================================================================

create or replace function public.bulk_import_roster(
  target_entry uuid,
  rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  target_season uuid;
  max_players integer;
  current_count integer;
  batch_count integer;
  item jsonb;
  p_name text;
  p_jersey integer;
  p_pos text;
  resolved_player_id uuid;
  prev_membership public.roster_memberships;
  saved_membership public.roster_memberships;
  imported_n integer := 0;
  updated_n integer := 0;
  seen_jerseys integer[];
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select e.league_id, d.season_id into target_league, target_season
  from public.team_entries e
  join public.divisions d on d.id = e.division_id and d.league_id = e.league_id
  where e.id = target_entry;

  if target_league is null then
    raise exception using errcode='P0002', message='TEAM_ENTRY_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
    raise exception using errcode='22023', message='Import rows must be a non-empty array';
  end if;

  batch_count := jsonb_array_length(rows);

  -- Acquire settings lock before team entry lock
  select roster_limit into max_players
  from public.season_settings
  where season_id = target_season
  for share;

  perform 1 from public.team_entries where id = target_entry for update;

  select count(*) into current_count
  from public.roster_memberships
  where team_entry_id = target_entry and status = 'active';

  seen_jerseys := array[]::integer[];

  -- First pass: validate all items in the batch
  for item in select * from jsonb_array_elements(rows) loop
    p_name := trim(item->>'name');
    if p_name is null or length(p_name) < 2 or length(p_name) > 100 then
      raise exception using errcode='22023', message='Player name must be between 2 and 100 characters';
    end if;

    if item ? 'jersey' and item->>'jersey' is not null and item->>'jersey' <> '' then
      p_jersey := (item->>'jersey')::integer;
      if p_jersey < 0 or p_jersey > 99 then
        raise exception using errcode='22023', message='Jersey number must be between 0 and 99';
      end if;

      if p_jersey = any(seen_jerseys) then
        raise exception using errcode='22023', message='Duplicate jersey number ' || p_jersey || ' within import batch';
      end if;
      seen_jerseys := array_append(seen_jerseys, p_jersey);
    else
      p_jersey := null;
    end if;

    p_pos := upper(trim(coalesce(item->>'position', 'F')));
    if p_pos not in ('F', 'D', 'G', 'C', 'LW', 'RW') then
      raise exception using errcode='22023', message='Invalid position ' || p_pos || '. Allowed: F, D, G, C, LW, RW';
    end if;
  end loop;

  -- Check roster limits
  if max_players is not null and (current_count + batch_count) > max_players then
    raise exception using errcode='P0001', message='ROSTER_FULL';
  end if;

  -- Second pass: insert/update players and memberships
  for item in select * from jsonb_array_elements(rows) loop
    p_name := trim(item->>'name');
    if item ? 'jersey' and item->>'jersey' is not null and item->>'jersey' <> '' then
      p_jersey := (item->>'jersey')::integer;
    else
      p_jersey := null;
    end if;
    p_pos := upper(trim(coalesce(item->>'position', 'F')));

    -- Find existing player in league or create new
    select p.id into resolved_player_id
    from public.players p
    join public.league_players lp on lp.player_id = p.id
    where lp.league_id = target_league
      and lower(p.display_name) = lower(p_name)
    limit 1;

    if resolved_player_id is null then
      insert into public.players (display_name)
      values (p_name)
      returning id into resolved_player_id;

      insert into public.league_players (league_id, player_id)
      values (target_league, resolved_player_id);
    end if;

    -- Check if already a member of this team entry
    select * into prev_membership
    from public.roster_memberships
    where team_entry_id = target_entry and player_id = resolved_player_id;

    if prev_membership.id is null then
      insert into public.roster_memberships (
        league_id,
        team_entry_id,
        player_id,
        jersey_number,
        position,
        status
      )
      values (
        target_league,
        target_entry,
        resolved_player_id,
        p_jersey,
        p_pos,
        'active'
      )
      returning * into saved_membership;

      imported_n := imported_n + 1;
    else
      update public.roster_memberships
      set jersey_number = p_jersey,
          position = p_pos,
          status = 'active',
          revision = prev_membership.revision + 1,
          updated_at = now()
      where id = prev_membership.id
      returning * into saved_membership;

      updated_n := updated_n + 1;
    end if;

    insert into public.roster_audit (
      league_id,
      team_entry_id,
      actor_id,
      previous_record,
      new_record
    )
    values (
      target_league,
      target_entry,
      auth.uid(),
      case when prev_membership.id is null then null else to_jsonb(prev_membership) end,
      to_jsonb(saved_membership)
    );
  end loop;

  select count(*) into current_count
  from public.roster_memberships
  where team_entry_id = target_entry and status = 'active';

  return jsonb_build_object(
    'imported_count', imported_n,
    'updated_count', updated_n,
    'total_roster_count', current_count
  );
end;
$$;

revoke all on function public.bulk_import_roster(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.bulk_import_roster(uuid, jsonb) to authenticated;

commit;

