begin;

-- ============================================================================
-- Migration: 202611160034_league_communications_and_delivery_logs.sql
-- Commissioner Communication Broadcast Engine & Multi-Channel Delivery Audit
-- ============================================================================

create or replace function public.broadcast_league_notification(
  target_league uuid,
  target_scope text, -- 'all_league', 'division', 'team'
  target_scope_id uuid default null,
  notif_category text default 'announcement',
  notif_title text default 'League Announcement',
  notif_message text default '',
  notif_url text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_comm boolean;
  rec record;
  recipients_count integer := 0;
  dispatched_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select public.is_league_commissioner(target_league) into is_comm;
  if not coalesce(is_comm, false) then
    raise exception 'Commissioner permissions required to broadcast notifications.';
  end if;

  if target_scope = 'all_league' then
    for rec in
      select distinct lm.user_id
      from public.league_memberships lm
      where lm.league_id = target_league
    loop
      dispatched_id := public.dispatch_league_notification(
        target_league,
        rec.user_id,
        notif_category,
        notif_title,
        notif_message,
        notif_url
      );
      if dispatched_id is not null then
        recipients_count := recipients_count + 1;
      end if;
    end loop;

  elsif target_scope = 'team' and target_scope_id is not null then
    for rec in
      select distinct p.owner_user_id as user_id
      from public.roster_memberships rm
      join public.players p on p.id = rm.player_id
      where rm.team_entry_id = target_scope_id
        and rm.status = 'active'
        and p.owner_user_id is not null
    loop
      dispatched_id := public.dispatch_league_notification(
        target_league,
        rec.user_id,
        notif_category,
        notif_title,
        notif_message,
        notif_url
      );
      if dispatched_id is not null then
        recipients_count := recipients_count + 1;
      end if;
    end loop;

  elsif target_scope = 'division' and target_scope_id is not null then
    for rec in
      select distinct p.owner_user_id as user_id
      from public.team_entries te
      join public.roster_memberships rm on rm.team_entry_id = te.id
      join public.players p on p.id = rm.player_id
      where te.division_id = target_scope_id
        and rm.status = 'active'
        and p.owner_user_id is not null
    loop
      dispatched_id := public.dispatch_league_notification(
        target_league,
        rec.user_id,
        notif_category,
        notif_title,
        notif_message,
        notif_url
      );
      if dispatched_id is not null then
        recipients_count := recipients_count + 1;
      end if;
    end loop;
  end if;

  return recipients_count;
end;
$$;

grant execute on function public.broadcast_league_notification to authenticated;

-- ============================================================================
-- RPC: get_league_delivery_logs
-- Provides commissioner with an audited history of all notification dispatches
-- ============================================================================
create or replace function public.get_league_delivery_logs(
  target_league uuid,
  limit_count integer default 50
)
returns table (
  delivery_id uuid,
  recipient_email text,
  recipient_user_id uuid,
  category text,
  channel text,
  title text,
  message text,
  target_url text,
  status text,
  sent_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_comm boolean;
begin
  select public.is_league_commissioner(target_league) into is_comm;
  if not coalesce(is_comm, false) then
    raise exception 'Commissioner permissions required to view delivery logs.';
  end if;

  return query
  select
    nd.id as delivery_id,
    coalesce(u.email, 'Anonymous Member') as recipient_email,
    nd.recipient_user_id,
    nd.category,
    nd.channel,
    nd.title,
    nd.message,
    nd.target_url,
    nd.status,
    nd.sent_at,
    nd.created_at
  from public.notification_deliveries nd
  left join auth.users u on u.id = nd.recipient_user_id
  where nd.league_id = target_league
  order by nd.created_at desc
  limit limit_count;
end;
$$;

grant execute on function public.get_league_delivery_logs to authenticated;

commit;
