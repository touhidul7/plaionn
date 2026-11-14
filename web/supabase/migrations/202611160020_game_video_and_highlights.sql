begin;

-- ============================================================================
-- Migration: 202611160020_game_video_and_highlights.sql
-- Adds Phase 3 licensed video streaming, full-game recordings, and event-linked
-- highlight clips with player reels and Game Center broadcast playback.
-- ============================================================================

create table if not exists public.game_video_streams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  stream_provider text not null check(stream_provider in ('youtube', 'vimeo', 'hls_stream', 'mp4_direct', 'livebarn')),
  stream_url text not null check(length(trim(stream_url)) > 5),
  video_title text not null default 'Full Game Broadcast',
  rink_camera_angle text default 'Main Center Ice',
  sync_offset_seconds integer not null default 0,
  is_live boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_highlights (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  stream_id uuid references public.game_video_streams(id) on delete set null,
  event_id uuid references public.game_events(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  team_entry_id uuid references public.team_entries(id) on delete set null,
  title text not null check(length(trim(title)) between 2 and 120),
  clip_url text not null check(length(trim(clip_url)) > 5),
  thumbnail_url text,
  start_seconds integer not null default 0 check(start_seconds >= 0),
  duration_seconds integer not null default 15 check(duration_seconds between 3 and 300),
  highlight_tag text not null default 'goal' check(highlight_tag in ('goal', 'save', 'play_of_the_game', 'shootout', 'hit', 'celebration')),
  views_count integer not null default 0 check(views_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_video_streams_game on public.game_video_streams(game_id);
create index if not exists idx_highlights_game on public.game_highlights(game_id);
create index if not exists idx_highlights_player on public.game_highlights(player_id);

alter table public.game_video_streams enable row level security;
alter table public.game_highlights enable row level security;

grant select on public.game_video_streams, public.game_highlights to anon, authenticated;
grant all on public.game_video_streams, public.game_highlights to authenticated;

drop policy if exists streams_public_read on public.game_video_streams;
create policy streams_public_read on public.game_video_streams for select using (is_public = true);

drop policy if exists highlights_public_read on public.game_highlights;
create policy highlights_public_read on public.game_highlights for select using (true);

drop policy if exists streams_comm_all on public.game_video_streams;
create policy streams_comm_all on public.game_video_streams for all
  to authenticated using (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = game_video_streams.league_id and lm.user_id = auth.uid() and lm.role in ('commissioner', 'media')
    )
  )
  with check (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = game_video_streams.league_id and lm.user_id = auth.uid() and lm.role in ('commissioner', 'media')
    )
  );

drop policy if exists highlights_comm_all on public.game_highlights;
create policy highlights_comm_all on public.game_highlights for all
  to authenticated using (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = game_highlights.league_id and lm.user_id = auth.uid() and lm.role in ('commissioner', 'media')
    )
  )
  with check (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = game_highlights.league_id and lm.user_id = auth.uid() and lm.role in ('commissioner', 'media')
    )
  );

-- ============================================================================
-- RPC: register_game_video_stream
-- ============================================================================
create or replace function public.register_game_video_stream(
  target_game uuid,
  p_provider text,
  p_url text,
  p_title text default 'Full Game Broadcast',
  p_camera_angle text default 'Main Center Ice',
  p_sync_offset integer default 0,
  p_is_live boolean default false
)
returns public.game_video_streams
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  rec public.game_video_streams;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select league_id into target_league
  from public.games
  where id = target_game;

  if target_league is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if not (
    public.is_league_commissioner(target_league) or
    exists (
      select 1 from public.league_memberships
      where league_id = target_league and user_id = auth.uid() and role in ('commissioner', 'media')
    )
  ) then
    raise exception using errcode='42501', message='Commissioner or media access required';
  end if;

  insert into public.game_video_streams (
    game_id, league_id, stream_provider, stream_url, video_title,
    rink_camera_angle, sync_offset_seconds, is_live, updated_at
  )
  values (
    target_game, target_league, p_provider, trim(p_url), coalesce(nullif(trim(p_title), ''), 'Full Game Broadcast'),
    coalesce(nullif(trim(p_camera_angle), ''), 'Main Center Ice'), coalesce(p_sync_offset, 0), coalesce(p_is_live, false), now()
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.register_game_video_stream(uuid, text, text, text, text, integer, boolean) to authenticated;

-- ============================================================================
-- RPC: create_game_highlight
-- ============================================================================
create or replace function public.create_game_highlight(
  target_game uuid,
  p_title text,
  p_clip_url text,
  p_tag text default 'goal',
  p_event_id uuid default null,
  p_player_id uuid default null,
  p_team_entry_id uuid default null,
  p_start_sec integer default 0,
  p_duration_sec integer default 15,
  p_thumbnail_url text default null
)
returns public.game_highlights
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  rec public.game_highlights;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select league_id into target_league
  from public.games
  where id = target_game;

  if target_league is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if not (
    public.is_league_commissioner(target_league) or
    exists (
      select 1 from public.league_memberships
      where league_id = target_league and user_id = auth.uid() and role in ('commissioner', 'media')
    )
  ) then
    raise exception using errcode='42501', message='Commissioner or media access required';
  end if;

  insert into public.game_highlights (
    game_id, league_id, event_id, player_id, team_entry_id, title,
    clip_url, thumbnail_url, start_seconds, duration_seconds, highlight_tag
  )
  values (
    target_game, target_league, p_event_id, p_player_id, p_team_entry_id,
    trim(p_title), trim(p_clip_url), p_thumbnail_url,
    coalesce(p_start_sec, 0), coalesce(p_duration_sec, 15), coalesce(p_tag, 'goal')
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.create_game_highlight(uuid, text, text, text, uuid, uuid, uuid, integer, integer, text) to authenticated;

-- ============================================================================
-- RPC: get_game_video_package
-- Returns streams and highlight clips for a game
-- ============================================================================
create or replace function public.get_game_video_package(target_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  streams_json jsonb;
  highlights_json jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'provider', s.stream_provider,
        'url', s.stream_url,
        'title', s.video_title,
        'camera_angle', s.rink_camera_angle,
        'is_live', s.is_live,
        'sync_offset_seconds', s.sync_offset_seconds
      ) order by s.created_at asc
    ),
    '[]'::jsonb
  )
  into streams_json
  from public.game_video_streams s
  where s.game_id = target_game and s.is_public = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'title', h.title,
        'clip_url', h.clip_url,
        'thumbnail_url', h.thumbnail_url,
        'tag', h.highlight_tag,
        'start_seconds', h.start_seconds,
        'duration_seconds', h.duration_seconds,
        'player_id', h.player_id,
        'player_name', p.display_name,
        'event_id', h.event_id,
        'views', h.views_count
      ) order by h.created_at desc
    ),
    '[]'::jsonb
  )
  into highlights_json
  from public.game_highlights h
  left join public.players p on p.id = h.player_id
  where h.game_id = target_game;

  return jsonb_build_object(
    'game_id', target_game,
    'streams', streams_json,
    'highlights', highlights_json
  );
end;
$$;

grant execute on function public.get_game_video_package(uuid) to anon, authenticated;

commit;
