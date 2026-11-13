begin;

-- ============================================================================
-- Migration: 202611160004_game_attendance_rsvp.sql
-- Adds game attendance & player RSVP for upcoming games, giving captains
-- and commissioners headcounts (skaters, goalies) and availability notes.
-- ============================================================================

create table public.game_attendance (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  game_id uuid not null references public.games(id),
  team_entry_id uuid not null,
  player_id uuid not null references public.players(id),
  status text not null check(status in ('attending', 'out', 'tentative')),
  note text not null default '' check(length(note) <= 150),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(team_entry_id, league_id) references public.team_entries(id, league_id),
  unique(game_id, player_id)
);

alter table public.game_attendance enable row level security;

revoke all on public.game_attendance from anon, authenticated;
grant select on public.game_attendance to authenticated;

-- Policies:
-- 1. Commissioners and league members can read attendance for their league's games
create policy game_attendance_read on public.game_attendance for select to authenticated
  using(public.is_league_member(league_id));

-- RPC: save_game_rsvp
create or replace function public.save_game_rsvp(
  target_game uuid,
  target_player uuid,
  rsvp_status text,
  rsvp_note text default ''
)
returns public.game_attendance
language plpgsql
security definer
set search_path=''
as $$
declare
  game_rec public.games;
  roster_rec public.roster_memberships;
  saved public.game_attendance;
  clean_note text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into game_rec from public.games where id = target_game;
  if game_rec.id is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if game_rec.status not in ('draft', 'scheduled') then
    raise exception using errcode='22023', message='Cannot update RSVP for completed or cancelled games';
  end if;

  -- Validate player is on active roster of one of the competing teams
  select * into roster_rec from public.roster_memberships
  where player_id = target_player
    and league_id = game_rec.league_id
    and team_entry_id in (game_rec.home_entry_id, game_rec.away_entry_id)
    and status = 'active';

  if roster_rec.id is null then
    raise exception using errcode='42501', message='Player is not on an active roster for this game';
  end if;

  -- Verify permissions: commissioner, or player owned by auth.uid(), or captain
  if not public.is_league_commissioner(game_rec.league_id)
    and not exists (
      select 1 from public.players p
      where p.id = target_player and p.owner_user_id = auth.uid()
    )
    and not exists (
      select 1 from public.league_memberships lm
      where lm.league_id = game_rec.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
    ) then
    raise exception using errcode='42501', message='Permission denied to update RSVP for this player';
  end if;

  if rsvp_status not in ('attending', 'out', 'tentative') then
    raise exception using errcode='22023', message='Invalid RSVP status';
  end if;

  clean_note := coalesce(substring(trim(rsvp_note) from 1 for 150), '');

  insert into public.game_attendance (
    league_id,
    game_id,
    team_entry_id,
    player_id,
    status,
    note,
    updated_by,
    updated_at
  )
  values (
    game_rec.league_id,
    target_game,
    roster_rec.team_entry_id,
    target_player,
    rsvp_status,
    clean_note,
    auth.uid(),
    now()
  )
  on conflict (game_id, player_id)
  do update set
    status = excluded.status,
    note = excluded.note,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into saved;

  return saved;
end;
$$;

-- RPC: list_game_attendance
create or replace function public.list_game_attendance(
  target_game uuid,
  target_entry uuid
)
returns table(
  player_id uuid,
  display_name text,
  jersey_number integer,
  player_position text,
  rsvp_status text,
  note text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  game_rec public.games;
begin
  select * into game_rec from public.games where id = target_game;
  if game_rec.id is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if auth.uid() is null or not public.is_league_member(game_rec.league_id) then
    raise exception using errcode='42501', message='League membership required';
  end if;

  return query
  select
    p.id as player_id,
    p.display_name,
    rm.jersey_number,
    rm.position as player_position,
    coalesce(ga.status, 'unconfirmed') as rsvp_status,
    coalesce(ga.note, '') as note,
    ga.updated_at
  from public.roster_memberships rm
  join public.players p on p.id = rm.player_id
  left join public.game_attendance ga on ga.game_id = target_game and ga.player_id = rm.player_id
  where rm.team_entry_id = target_entry
    and rm.league_id = game_rec.league_id
    and rm.status = 'active'
  order by
    case rm.position when 'G' then 0 when 'D' then 1 else 2 end,
    rm.jersey_number nulls last,
    p.display_name asc;
end;
$$;

revoke all on function public.save_game_rsvp(uuid, uuid, text, text),
  public.list_game_attendance(uuid, uuid) from public, anon, authenticated;

grant execute on function public.save_game_rsvp(uuid, uuid, text, text),
  public.list_game_attendance(uuid, uuid) to authenticated;

commit;
