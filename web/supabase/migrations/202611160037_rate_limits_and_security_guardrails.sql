begin;

-- ============================================================================
-- Migration: 202611160037_rate_limits_and_security_guardrails.sql
-- Security Guardrails, Sliding-Window Rate Limiting, and Audit Trail
-- ============================================================================

-- 1. Table: security_rate_limits
create table if not exists public.security_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ip_address text,
  action text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 1
);

create index if not exists idx_security_rate_limits_user_action_window
  on public.security_rate_limits (user_id, action, window_start);

alter table public.security_rate_limits enable row level security;

-- 2. Table: security_audit_logs
create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'security_alert')),
  ip_address text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_audit_logs_league_created
  on public.security_audit_logs (league_id, created_at desc);

alter table public.security_audit_logs enable row level security;

create policy security_audit_logs_commissioner_read on public.security_audit_logs
  for select
  using (
    league_id is null or public.is_league_commissioner(league_id)
  );

-- 3. Function: check_rate_limit and enforce_rate_limit
create or replace function public.check_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  curr_user uuid;
  current_window_start timestamptz;
  current_count integer;
  window_cutoff timestamptz;
begin
  curr_user := auth.uid();
  if curr_user is null then
    return true;
  end if;

  window_cutoff := now() - (p_window_seconds || ' seconds')::interval;

  -- Delete expired rate limit windows for this user and action
  delete from public.security_rate_limits
  where user_id = curr_user
    and action = p_action
    and window_start < window_cutoff;

  -- Check existing active window
  select window_start, request_count
  into current_window_start, current_count
  from public.security_rate_limits
  where user_id = curr_user
    and action = p_action
    and window_start >= window_cutoff
  order by window_start desc
  limit 1;

  if current_count is not null then
    if current_count >= p_max_requests then
      -- Rate limit reached
      update public.security_rate_limits
      set request_count = request_count + 1
      where user_id = curr_user
        and action = p_action
        and window_start = current_window_start;

      return false;
    else
      update public.security_rate_limits
      set request_count = request_count + 1
      where user_id = curr_user
        and action = p_action
        and window_start = current_window_start;

      return true;
    end if;
  else
    insert into public.security_rate_limits (
      user_id,
      action,
      window_start,
      request_count
    ) values (
      curr_user,
      p_action,
      now(),
      1
    );

    return true;
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

create or replace function public.enforce_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.check_rate_limit(p_action, p_max_requests, p_window_seconds) then
    raise exception using
      errcode = '42900',
      message = 'Rate limit exceeded for action ' || p_action || '. Please wait before retrying.';
  end if;
  return true;
end;
$$;

revoke all on function public.enforce_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.enforce_rate_limit(text, integer, integer) to authenticated;

-- 4. Function: log_security_audit_event
create or replace function public.log_security_audit_event(
  p_league_id uuid,
  p_action text,
  p_severity text default 'info',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  curr_user uuid;
  cleaned_details jsonb;
  new_id uuid;
begin
  curr_user := auth.uid();
  
  -- Sanitize details to guarantee secret handling: strip out sensitive credential keys
  cleaned_details := coalesce(p_details, '{}'::jsonb)
    - 'password'
    - 'secret'
    - 'token'
    - 'key'
    - 'apiKey'
    - 'access_token';

  insert into public.security_audit_logs (
    league_id,
    actor_user_id,
    action,
    severity,
    details
  ) values (
    p_league_id,
    curr_user,
    p_action,
    case when p_severity in ('info', 'warning', 'security_alert') then p_severity else 'info' end,
    cleaned_details
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.log_security_audit_event(uuid, text, text, jsonb) from public, anon;
grant execute on function public.log_security_audit_event(uuid, text, text, jsonb) to authenticated;

-- 5. Function: get_league_security_audit_trail
create or replace function public.get_league_security_audit_trail(
  target_league uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  league_id uuid,
  actor_user_id uuid,
  action text,
  severity text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode = '42501', message = 'Commissioner permissions required.';
  end if;

  return query
  select
    l.id,
    l.league_id,
    l.actor_user_id,
    l.action,
    l.severity,
    l.details,
    l.created_at
  from public.security_audit_logs l
  where l.league_id = target_league or (l.league_id is null and l.action = 'rate_limit_exceeded')
  order by l.created_at desc
  limit coalesce(p_limit, 50);
end;
$$;

revoke all on function public.get_league_security_audit_trail(uuid, integer) from public, anon;
grant execute on function public.get_league_security_audit_trail(uuid, integer) to authenticated;

commit;
