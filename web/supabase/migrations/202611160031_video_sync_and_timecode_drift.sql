begin;

-- ============================================================================
-- Migration: 202611160031_video_sync_and_timecode_drift.sql
-- Adds video broadcast timecode calibration, period puck-drop sync, and automatic
-- conversion from scoreboard game clock to exact video playback seconds.
-- ============================================================================

create table if not exists public.game_video_period_syncs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  stream_id uuid not null references public.game_video_streams(id) on delete cascade,
  period integer not null check(period between 1 and 10),
  puck_drop_video_second integer not null check(puck_drop_video_second >= 0),
  period_end_video_second integer check(period_end_video_second >= puck_drop_video_second),
  created_at timestamptz not null default now(),
  unique(stream_id, period)
);

create index if not exists idx_video_syncs_game on public.game_video_period_syncs(game_id);

alter table public.game_video_period_syncs enable row level security;

grant select on public.game_video_period_syncs to anon, authenticated;
grant all on public.game_video_period_syncs to authenticated;

drop policy if exists syncs_public_read on public.game_video_period_syncs;
create policy syncs_public_read on public.game_video_period_syncs for select using (true);

drop policy if exists syncs_comm_manage on public.game_video_period_syncs;
create policy syncs_comm_manage on public.game_video_period_syncs for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: set_period_video_sync
-- Calibrates exact video timecode for a period's puck drop
-- ============================================================================
create or replace function public.set_period_video_sync(
  target_stream uuid,
  p_period integer,
  p_puck_drop_sec integer,
  p_period_end_sec integer default null
)
returns public.game_video_period_syncs
language plpgsql
security definer
set search_path=''
as $$
declare
  stream_rec public.game_video_streams;
  rec public.game_video_period_syncs;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into stream_rec
  from public.game_video_streams
  where id = target_stream;

  if stream_rec.id is null then
    raise exception using errcode='P0002', message='STREAM_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(stream_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  insert into public.game_video_period_syncs (
    game_id, league_id, stream_id, period, puck_drop_video_second, period_end_video_second
  )
  values (
    stream_rec.game_id, stream_rec.league_id, target_stream, p_period,
    coalesce(p_puck_drop_sec, 0), p_period_end_sec
  )
  on conflict (stream_id, period) do update
  set puck_drop_video_second = excluded.puck_drop_video_second,
      period_end_video_second = excluded.period_end_video_second
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.set_period_video_sync(uuid, integer, integer, integer) to authenticated;

-- ============================================================================
-- RPC: convert_game_clock_to_video_time
-- Converts game event period and clock remaining to video playback second
-- ============================================================================
create or replace function public.convert_game_clock_to_video_time(
  target_game uuid,
  p_period integer,
  p_clock_remaining_seconds integer,
  p_period_duration_minutes integer default 20
)
returns integer
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  sync_rec public.game_video_period_syncs;
  period_total_seconds integer;
  elapsed_in_period integer;
  video_target_second integer;
begin
  period_total_seconds := coalesce(p_period_duration_minutes, 20) * 60;
  elapsed_in_period := greatest(0, period_total_seconds - coalesce(p_clock_remaining_seconds, 0));

  select * into sync_rec
  from public.game_video_period_syncs
  where game_id = target_game and period = p_period
  order by created_at desc
  limit 1;

  if sync_rec.id is not null then
    video_target_second := sync_rec.puck_drop_video_second + elapsed_in_period;
  else
    -- Fallback: estimate assuming 20 min periods with 2 min intermission
    video_target_second := ((p_period - 1) * (period_total_seconds + 120)) + elapsed_in_period;
  end if;

  return video_target_second;
end;
$$;

grant execute on function public.convert_game_clock_to_video_time(uuid, integer, integer, integer) to anon, authenticated;

commit;
