begin;

-- ============================================================================
-- Migration: 202611160010_announcements_and_messaging.sql
-- Adds league-wide announcements, team locker room notices,
-- priority badges (urgent/important/standard), and pinned alerts.
-- ============================================================================

create table public.league_announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid references public.seasons(id),
  team_entry_id uuid references public.team_entries(id),
  author_id uuid references auth.users(id),
  title text not null check(length(trim(title)) between 2 and 150),
  message text not null check(length(trim(message)) >= 2),
  priority text not null default 'standard' check(priority in ('urgent', 'important', 'standard')),
  is_pinned boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.league_announcements enable row level security;

revoke all on public.league_announcements from anon, authenticated;
grant select on public.league_announcements to anon, authenticated;
grant insert, update, delete on public.league_announcements to authenticated;

-- Policies
create policy announcements_read on public.league_announcements
  for select to anon, authenticated
  using(expires_at is null or expires_at > now());

create policy announcements_manage on public.league_announcements
  for all to authenticated
  using(
    public.is_league_commissioner(league_id)
    or author_id = auth.uid()
  )
  with check(
    public.is_league_commissioner(league_id)
    or author_id = auth.uid()
  );

-- RPC: publish_announcement
create or replace function public.publish_announcement(
  target_league uuid,
  notice_title text,
  notice_message text,
  notice_priority text default 'standard',
  target_entry uuid default null,
  pinned boolean default false,
  expire_time timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  ann_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required to publish announcements';
  end if;

  if length(trim(notice_title)) < 2 then
    raise exception using errcode='22023', message='Announcement title must be at least 2 characters';
  end if;

  if length(trim(notice_message)) < 2 then
    raise exception using errcode='22023', message='Announcement message must be at least 2 characters';
  end if;

  if notice_priority not in ('urgent', 'important', 'standard') then
    raise exception using errcode='22023', message='Invalid announcement priority';
  end if;

  insert into public.league_announcements (
    league_id,
    team_entry_id,
    author_id,
    title,
    message,
    priority,
    is_pinned,
    expires_at
  ) values (
    target_league,
    target_entry,
    auth.uid(),
    trim(notice_title),
    trim(notice_message),
    notice_priority,
    coalesce(pinned, false),
    expire_time
  )
  returning id into ann_id;

  return ann_id;
end;
$$;

-- RPC: list_active_announcements
create or replace function public.list_active_announcements(
  target_league uuid,
  target_entry uuid default null
)
returns table(
  announcement_id uuid,
  league_id uuid,
  team_entry_id uuid,
  team_name text,
  title text,
  message text,
  priority text,
  is_pinned boolean,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select
    la.id as announcement_id,
    la.league_id,
    la.team_entry_id,
    t.name as team_name,
    la.title,
    la.message,
    la.priority,
    la.is_pinned,
    la.expires_at,
    la.created_at
  from public.league_announcements la
  left join public.team_entries te on te.id = la.team_entry_id
  left join public.teams t on t.id = te.team_id
  where la.league_id = target_league
    and (la.expires_at is null or la.expires_at > now())
    and (target_entry is null or la.team_entry_id is null or la.team_entry_id = target_entry)
  order by
    case when la.priority = 'urgent' then 0 when la.is_pinned then 1 else 2 end,
    la.created_at desc;
end;
$$;

-- RPC: delete_announcement
create or replace function public.delete_announcement(target_announcement uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  ann_rec public.league_announcements;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into ann_rec from public.league_announcements where id = target_announcement;
  if ann_rec.id is null then
    return false;
  end if;

  if not (public.is_league_commissioner(ann_rec.league_id) or ann_rec.author_id = auth.uid()) then
    raise exception using errcode='42501', message='Unauthorized to delete this announcement';
  end if;

  delete from public.league_announcements where id = target_announcement;
  return true;
end;
$$;

revoke all on function public.publish_announcement(uuid, text, text, text, uuid, boolean, timestamptz),
  public.list_active_announcements(uuid, uuid),
  public.delete_announcement(uuid) from public, anon, authenticated;

grant execute on function public.publish_announcement(uuid, text, text, text, uuid, boolean, timestamptz),
  public.delete_announcement(uuid) to authenticated;

grant execute on function public.list_active_announcements(uuid, uuid) to anon, authenticated;

commit;

