-- ============================================================================
-- Migration: 202611160016_notifications_and_sms.sql
-- Description: Push/SMS notifications with user opt-in preferences,
--              quiet hours suppression, delivery tracking, and player inbox.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Notification Preferences
-- ----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  notify_game_reminders boolean not null default true,
  notify_schedule_changes boolean not null default true,
  notify_spare_callups boolean not null default true,
  notify_announcements boolean not null default true,
  notify_discipline boolean not null default true,
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '08:00',
  time_zone text not null default 'America/Toronto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists idx_notification_preferences_lookup
  on public.notification_preferences(league_id, user_id);

alter table public.notification_preferences enable row level security;

drop policy if exists notif_pref_user_all on public.notification_preferences;
create policy notif_pref_user_all on public.notification_preferences
  for all using (
    auth.uid() = user_id
    or auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = notification_preferences.league_id and lm.role = 'commissioner'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Web Push Subscriptions
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_user on public.push_subscriptions;
create policy push_subs_user on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Notification Delivery Log
-- ----------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (
    category in (
      'game_reminder',
      'schedule_change',
      'spare_callup',
      'announcement',
      'discipline',
      'lineup_update'
    )
  ),
  channel text not null check (channel in ('push', 'sms', 'email', 'in_app')),
  title text not null,
  message text not null,
  target_url text,
  status text not null default 'queued' check (
    status in ('queued', 'delivered', 'suppressed_quiet_hours', 'failed')
  ),
  delivery_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_deliveries_recipient
  on public.notification_deliveries(recipient_user_id, created_at desc);

alter table public.notification_deliveries enable row level security;

drop policy if exists notif_deliveries_user_read on public.notification_deliveries;
create policy notif_deliveries_user_read on public.notification_deliveries
  for select using (
    auth.uid() = recipient_user_id
    or auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = notification_deliveries.league_id and lm.role = 'commissioner'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Preferences & Dispatch RPCs
-- ----------------------------------------------------------------------------

-- Fetch or initialize user preferences
create or replace function public.get_user_notification_preferences(
  target_league uuid
)
returns table (
  phone_number text,
  sms_enabled boolean,
  push_enabled boolean,
  email_enabled boolean,
  notify_game_reminders boolean,
  notify_schedule_changes boolean,
  notify_spare_callups boolean,
  notify_announcements boolean,
  notify_discipline boolean,
  quiet_hours_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  time_zone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to access notification preferences';
  end if;

  -- Ensure record exists with defaults
  insert into public.notification_preferences (
    league_id,
    user_id
  )
  values (
    target_league,
    v_caller
  )
  on conflict (league_id, user_id) do nothing;

  return query
  select
    np.phone_number,
    np.sms_enabled,
    np.push_enabled,
    np.email_enabled,
    np.notify_game_reminders,
    np.notify_schedule_changes,
    np.notify_spare_callups,
    np.notify_announcements,
    np.notify_discipline,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end,
    np.time_zone
  from public.notification_preferences np
  where np.league_id = target_league and np.user_id = v_caller;
end;
$$;

-- Save notification preferences
create or replace function public.save_notification_preferences(
  target_league uuid,
  new_phone text,
  sms_on boolean,
  push_on boolean,
  email_on boolean,
  reminders_on boolean,
  sched_on boolean,
  spares_on boolean,
  announcements_on boolean,
  discipline_on boolean,
  quiet_on boolean,
  q_start time,
  q_end time,
  tz text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to save notification preferences';
  end if;

  insert into public.notification_preferences (
    league_id,
    user_id,
    phone_number,
    sms_enabled,
    push_enabled,
    email_enabled,
    notify_game_reminders,
    notify_schedule_changes,
    notify_spare_callups,
    notify_announcements,
    notify_discipline,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    time_zone,
    updated_at
  )
  values (
    target_league,
    v_caller,
    new_phone,
    sms_on,
    push_on,
    email_on,
    reminders_on,
    sched_on,
    spares_on,
    announcements_on,
    discipline_on,
    quiet_on,
    q_start,
    q_end,
    tz,
    now()
  )
  on conflict (league_id, user_id)
  do update set
    phone_number = excluded.phone_number,
    sms_enabled = excluded.sms_enabled,
    push_enabled = excluded.push_enabled,
    email_enabled = excluded.email_enabled,
    notify_game_reminders = excluded.notify_game_reminders,
    notify_schedule_changes = excluded.notify_schedule_changes,
    notify_spare_callups = excluded.notify_spare_callups,
    notify_announcements = excluded.notify_announcements,
    notify_discipline = excluded.notify_discipline,
    quiet_hours_enabled = excluded.quiet_hours_enabled,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    time_zone = excluded.time_zone,
    updated_at = now();

  return true;
end;
$$;

-- Dispatch a notification to a player, respecting quiet hours and category opt-outs
create or replace function public.dispatch_league_notification(
  target_league uuid,
  recipient uuid,
  notif_category text,
  notif_title text,
  notif_message text,
  notif_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pref record;
  v_now_time time;
  v_in_quiet boolean := false;
  v_status text := 'delivered';
  v_delivery_id uuid;
  v_channel text := 'in_app';
begin
  -- Fetch user preferences if configured
  select * into v_pref
  from public.notification_preferences
  where league_id = target_league and user_id = recipient;

  -- Category check
  if v_pref.id is not null then
    if (notif_category = 'game_reminder' and not v_pref.notify_game_reminders)
      or (notif_category = 'schedule_change' and not v_pref.notify_schedule_changes)
      or (notif_category = 'spare_callup' and not v_pref.notify_spare_callups)
      or (notif_category = 'announcement' and not v_pref.notify_announcements)
      or (notif_category = 'discipline' and not v_pref.notify_discipline) then
      -- User opted out of this notification category
      return null;
    end if;

    -- Select channel
    if v_pref.push_enabled then
      v_channel := 'push';
    elsif v_pref.sms_enabled and v_pref.phone_number is not null then
      v_channel := 'sms';
    elsif v_pref.email_enabled then
      v_channel := 'email';
    end if;

    -- Quiet hours check
    if v_pref.quiet_hours_enabled then
      v_now_time := current_time;
      if v_pref.quiet_hours_start > v_pref.quiet_hours_end then
        -- Overnight quiet hours (e.g. 22:00 to 08:00)
        if v_now_time >= v_pref.quiet_hours_start or v_now_time < v_pref.quiet_hours_end then
          v_in_quiet := true;
        end if;
      else
        -- Same-day quiet hours (e.g. 13:00 to 15:00)
        if v_now_time >= v_pref.quiet_hours_start and v_now_time < v_pref.quiet_hours_end then
          v_in_quiet := true;
        end if;
      end if;
    end if;
  end if;

  if v_in_quiet then
    v_status := 'suppressed_quiet_hours';
  end if;

  insert into public.notification_deliveries (
    league_id,
    recipient_user_id,
    category,
    channel,
    title,
    message,
    target_url,
    status,
    sent_at
  )
  values (
    target_league,
    recipient,
    notif_category,
    v_channel,
    notif_title,
    notif_message,
    notif_url,
    v_status,
    case when v_status = 'delivered' then now() else null end
  )
  returning id into v_delivery_id;

  return v_delivery_id;
end;
$$;

-- Fetch user's notification inbox
create or replace function public.get_notification_inbox(
  target_league uuid,
  limit_count integer default 20
)
returns table (
  delivery_id uuid,
  category text,
  channel text,
  title text,
  message text,
  target_url text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required to view notification inbox';
  end if;

  return query
  select
    nd.id as delivery_id,
    nd.category,
    nd.channel,
    nd.title,
    nd.message,
    nd.target_url,
    nd.status,
    nd.created_at
  from public.notification_deliveries nd
  where nd.league_id = target_league
    and nd.recipient_user_id = v_caller
  order by nd.created_at desc
  limit limit_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------------------
grant select on public.notification_preferences to authenticated;
grant all on public.notification_preferences to authenticated;

grant select on public.notification_deliveries to authenticated;
grant all on public.notification_deliveries to authenticated;

revoke execute on function public.get_user_notification_preferences(uuid) from public, anon, authenticated;
grant execute on function public.get_user_notification_preferences(uuid) to authenticated;

revoke execute on function public.save_notification_preferences(uuid, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text) from public, anon, authenticated;
grant execute on function public.save_notification_preferences(uuid, text, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text) to authenticated;

revoke execute on function public.dispatch_league_notification(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.dispatch_league_notification(uuid, uuid, text, text, text, text) to authenticated;

revoke execute on function public.get_notification_inbox(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_notification_inbox(uuid, integer) to authenticated;

commit;
