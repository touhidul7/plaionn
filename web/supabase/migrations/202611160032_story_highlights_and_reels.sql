begin;

-- ============================================================================
-- Migration: 202611160032_story_highlights_and_reels.sql
-- Mobile vertical story clips (9:16 format) for dynamic game recaps, play swipe
-- sequences, player recognition tags, and Game Center story reel integration.
-- ============================================================================

create table if not exists public.mobile_story_clips (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  highlight_id uuid references public.game_highlights(id) on delete set null,
  title text not null,
  caption text,
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '1:1', '16:9')),
  media_url text not null,
  thumbnail_url text,
  duration_seconds numeric(6,2) not null check (duration_seconds > 0 and duration_seconds <= 120),
  sequence_order integer not null default 0,
  is_published boolean not null default true,
  tagged_player_ids uuid[] default '{}',
  view_count integer not null default 0,
  like_count integer not null default 0,
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_mobile_stories_game on public.mobile_story_clips(game_id, sequence_order);
create index if not exists idx_mobile_stories_league on public.mobile_story_clips(league_id, created_at desc);

alter table public.mobile_story_clips enable row level security;

grant select on public.mobile_story_clips to anon, authenticated;
grant all on public.mobile_story_clips to authenticated;

drop policy if exists stories_public_read on public.mobile_story_clips;
create policy stories_public_read on public.mobile_story_clips for select
  using (is_published = true or (auth.uid() is not null and public.is_league_commissioner(league_id)));

drop policy if exists stories_comm_manage on public.mobile_story_clips;
create policy stories_comm_manage on public.mobile_story_clips for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: publish_mobile_story_clip
-- Creates and sequences a new vertical story highlight clip
-- ============================================================================
create or replace function public.publish_mobile_story_clip(
  target_league uuid,
  clip_title text,
  clip_url text,
  clip_duration numeric,
  target_game uuid default null,
  target_highlight uuid default null,
  clip_caption text default null,
  clip_thumb text default null,
  clip_aspect text default '9:16',
  tagged_players uuid[] default '{}'
)
returns public.mobile_story_clips
language plpgsql
security definer
set search_path=''
as $$
declare
  is_comm boolean;
  next_seq integer;
  res public.mobile_story_clips;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select public.is_league_commissioner(target_league) into is_comm;
  if not coalesce(is_comm, false) then
    raise exception 'Commissioner permissions required to publish mobile stories.';
  end if;

  if target_game is not null then
    select coalesce(max(sequence_order), 0) + 1 into next_seq
    from public.mobile_story_clips
    where game_id = target_game;
  else
    next_seq := 1;
  end if;

  insert into public.mobile_story_clips (
    league_id,
    game_id,
    highlight_id,
    title,
    caption,
    aspect_ratio,
    media_url,
    thumbnail_url,
    duration_seconds,
    sequence_order,
    tagged_player_ids
  ) values (
    target_league,
    target_game,
    target_highlight,
    clip_title,
    clip_caption,
    clip_aspect,
    clip_url,
    clip_thumb,
    clip_duration,
    next_seq,
    coalesce(tagged_players, '{}')
  )
  returning * into res;

  return res;
end;
$$;

grant execute on function public.publish_mobile_story_clip to authenticated;

-- ============================================================================
-- RPC: get_game_story_reel
-- Fetches chronological vertical stories for a game with tagged player profiles
-- ============================================================================
create or replace function public.get_game_story_reel(target_game uuid)
returns table (
  id uuid,
  league_id uuid,
  game_id uuid,
  title text,
  caption text,
  aspect_ratio text,
  media_url text,
  thumbnail_url text,
  duration_seconds numeric,
  sequence_order integer,
  view_count integer,
  like_count integer,
  tagged_players jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  select
    c.id,
    c.league_id,
    c.game_id,
    c.title,
    c.caption,
    c.aspect_ratio,
    c.media_url,
    c.thumbnail_url,
    c.duration_seconds,
    c.sequence_order,
    c.view_count,
    c.like_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'player_id', p.id,
            'display_name', p.display_name
          )
        )
        from public.players p
        where p.id = any(c.tagged_player_ids)
      ),
      '[]'::jsonb
    ) as tagged_players,
    c.created_at
  from public.mobile_story_clips c
  where c.game_id = target_game
    and c.is_published = true
  order by c.sequence_order asc, c.created_at asc;
end;
$$;

grant execute on function public.get_game_story_reel to anon, authenticated;

-- ============================================================================
-- RPC: record_story_engagement
-- Increments view or like counter safely
-- ============================================================================
create or replace function public.record_story_engagement(
  target_clip uuid,
  engagement_type text
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  new_count integer;
begin
  if engagement_type = 'like' then
    update public.mobile_story_clips
    set like_count = like_count + 1
    where id = target_clip
    returning like_count into new_count;
  elsif engagement_type = 'view' then
    update public.mobile_story_clips
    set view_count = view_count + 1
    where id = target_clip
    returning view_count into new_count;
  else
    raise exception 'Invalid engagement type. Must be "like" or "view".';
  end if;

  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.record_story_engagement to anon, authenticated;

commit;
