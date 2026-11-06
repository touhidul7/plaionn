begin;
create table public.season_settings (
 season_id uuid primary key,
 league_id uuid not null,
 roster_limit integer not null check(roster_limit between 1 and 100),
 period_count integer not null check(period_count between 1 and 10),
 period_minutes integer not null check(period_minutes between 1 and 60),
 clock_mode text not null check(clock_mode in ('running','stop')),
 win_points integer not null check(win_points between 0 and 10),
 tie_points integer not null check(tie_points between 0 and 10),
 loss_points integer not null check(loss_points between 0 and 10),
 overtime_loss_points integer not null check(overtime_loss_points between 0 and 10),
 billing_model text not null check(billing_model in ('team','player','both')),
 currency text not null check(currency in ('CAD','USD')),
 team_fee_cents integer not null check(team_fee_cents between 0 and 100000000),
 player_fee_cents integer not null check(player_fee_cents between 0 and 100000000),
 registration_opens date,
 registration_closes date,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 foreign key(season_id,league_id) references public.seasons(id,league_id),
 check(registration_opens is null or registration_closes is null or registration_closes>=registration_opens)
);
create table public.season_settings_audit (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.season_settings(season_id),
 league_id uuid not null references public.leagues(id),
 actor_id uuid references auth.users(id),
 changed_at timestamptz not null default now(),
 previous_settings jsonb,
 new_settings jsonb not null
);
alter table public.season_settings enable row level security;
alter table public.season_settings_audit enable row level security;
revoke all on public.season_settings,public.season_settings_audit from anon,authenticated;
grant select,insert on public.season_settings to authenticated;
grant update(roster_limit,period_count,period_minutes,clock_mode,win_points,tie_points,loss_points,
 overtime_loss_points,billing_model,currency,team_fee_cents,player_fee_cents,registration_opens,registration_closes)
 on public.season_settings to authenticated;
grant select on public.season_settings_audit to authenticated;
create policy settings_read on public.season_settings for select to authenticated using(public.is_league_member(league_id));
create policy settings_insert on public.season_settings for insert to authenticated with check(public.is_league_commissioner(league_id));
create policy settings_update on public.season_settings for update to authenticated
 using(public.is_league_commissioner(league_id)) with check(public.is_league_commissioner(league_id));
create policy settings_audit_read on public.season_settings_audit for select to authenticated using(public.is_league_commissioner(league_id));

create function public.stamp_season_settings() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
 new.updated_at=now();
 new.updated_by=auth.uid();
 new.revision=case when TG_OP='INSERT' then 1 else old.revision+1 end;
 return new;
end; $$;
create trigger stamp_settings before insert or update on public.season_settings for each row execute function public.stamp_season_settings();
create function public.audit_season_settings() returns trigger language plpgsql
security definer set search_path='' as $$
begin
 insert into public.season_settings_audit(season_id,league_id,actor_id,previous_settings,new_settings)
 values(new.season_id,new.league_id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end; $$;
revoke all on function public.stamp_season_settings(),public.audit_season_settings() from public,anon,authenticated;
create trigger audit_settings after insert or update on public.season_settings for each row execute function public.audit_season_settings();
commit;

