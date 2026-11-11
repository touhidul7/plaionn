begin;

create table public.ice_contracts (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 rink_id uuid not null,
 title text not null check(length(trim(title)) between 2 and 100),
 reference text not null default '' check(length(reference)<=100),
 start_date date not null,
 end_date date not null,
 purchased_hours numeric(9,2) not null check(purchased_hours>0 and purchased_hours<=100000 and purchased_hours*4=trunc(purchased_hours*4)),
 total_cost_cents integer not null check(total_cost_cents between 0 and 100000000),
 currency text not null check(currency in ('CAD','USD')),
 status text not null default 'active' check(status in ('active','cancelled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 cancelled_by uuid references auth.users(id),
 cancelled_at timestamptz,
 cancellation_reason text,
 foreign key(rink_id,league_id) references public.rinks(id,league_id),
 unique(id,league_id),
 check(end_date>=start_date),
 check((status='cancelled' and cancelled_by is not null and cancelled_at is not null and length(trim(cancellation_reason)) between 3 and 500)
  or (status='active' and cancelled_by is null and cancelled_at is null and cancellation_reason is null))
);

create table public.ice_contract_audit (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 contract_id uuid not null references public.ice_contracts(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('created','cancelled')),
 reason text not null check(length(trim(reason)) between 3 and 500),
 previous_record jsonb,
 new_record jsonb not null,
 changed_at timestamptz not null default now()
);

create table public.ice_slot_contract_audit (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 slot_id uuid not null references public.ice_slots(id),
 actor_id uuid not null references auth.users(id),
 previous_contract_id uuid references public.ice_contracts(id),
 new_contract_id uuid references public.ice_contracts(id),
 reason text not null check(length(trim(reason)) between 3 and 500),
 changed_at timestamptz not null default now()
);

alter table public.ice_slots add column contract_id uuid;
alter table public.ice_slots add constraint ice_slots_contract_league_fk
 foreign key(contract_id,league_id) references public.ice_contracts(id,league_id);
create index ice_contracts_rink_period_index on public.ice_contracts(league_id,rink_id,start_date,end_date);
create index ice_slots_contract_index on public.ice_slots(contract_id) where contract_id is not null;
alter table public.ice_contracts enable row level security;
alter table public.ice_contract_audit enable row level security;
alter table public.ice_slot_contract_audit enable row level security;
revoke all on public.ice_contracts,public.ice_contract_audit,public.ice_slot_contract_audit from anon,authenticated;
grant select on public.ice_contracts,public.ice_contract_audit,public.ice_slot_contract_audit to authenticated;
create policy ice_contracts_commissioner_read on public.ice_contracts for select to authenticated
 using(public.is_league_commissioner(league_id));
create policy ice_contract_audit_commissioner_read on public.ice_contract_audit for select to authenticated
 using(public.is_league_commissioner(league_id));
create policy ice_slot_contract_audit_commissioner_read on public.ice_slot_contract_audit for select to authenticated
 using(public.is_league_commissioner(league_id));

create function public.create_ice_contract(target_league uuid,target_rink uuid,contract_title text,contract_reference text,
 contract_start date,contract_end date,contract_hours numeric,contract_cost_cents integer,contract_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;saved public.ice_contracts;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=target_league for update;
 if not exists(select 1 from public.rinks where id=target_rink and league_id=target_league) then
  raise exception using errcode='42501',message='Rink is not in this league';
 end if;
 if contract_title is null or length(trim(contract_title)) not between 2 and 100
  or contract_reference is null or length(contract_reference)>100
  or contract_start is null or contract_end is null or contract_end<contract_start
  or contract_hours is null or contract_hours<=0 or contract_hours>100000 or contract_hours*4<>trunc(contract_hours*4)
  or contract_cost_cents is null or contract_cost_cents not between 0 and 100000000
  or contract_currency is null or contract_currency not in('CAD','USD') then
  raise exception using errcode='22023',message='INVALID_ICE_CONTRACT';
 end if;
 insert into public.ice_contracts(league_id,rink_id,title,reference,start_date,end_date,purchased_hours,total_cost_cents,currency,created_by)
 values(target_league,target_rink,trim(contract_title),trim(contract_reference),contract_start,contract_end,contract_hours,contract_cost_cents,contract_currency,auth.uid())
 returning * into saved;
 saved_id=saved.id;
 insert into public.ice_contract_audit(league_id,contract_id,actor_id,action,reason,previous_record,new_record)
 values(target_league,saved_id,auth.uid(),'created','Initial contract entry',null,to_jsonb(saved));
 return saved_id;
end; $$;

create function public.assign_ice_slot_contract(target_slot uuid,target_contract uuid,change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare slot_row public.ice_slots;contract_row public.ice_contracts;previous_id uuid;
begin
 select * into slot_row from public.ice_slots where id=target_slot for update;
 if slot_row.id is null or auth.uid() is null or not public.is_league_commissioner(slot_row.league_id) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=slot_row.league_id for update;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
  raise exception using errcode='22023',message='CHANGE_REASON_REQUIRED';
 end if;
 previous_id=slot_row.contract_id;
 if target_contract is not null then
  select * into contract_row from public.ice_contracts where id=target_contract and league_id=slot_row.league_id;
  if contract_row.id is null or contract_row.status<>'active' then
   raise exception using errcode='22023',message='ICE_CONTRACT_UNAVAILABLE';
  end if;
  if contract_row.rink_id<>slot_row.rink_id or slot_row.local_date not between contract_row.start_date and contract_row.end_date then
   raise exception using errcode='22023',message='ICE_CONTRACT_SLOT_MISMATCH';
  end if;
 end if;
 update public.ice_slots set contract_id=target_contract where id=target_slot;
 insert into public.ice_slot_contract_audit(league_id,slot_id,actor_id,previous_contract_id,new_contract_id,reason)
 values(slot_row.league_id,target_slot,auth.uid(),previous_id,target_contract,trim(change_reason));
end; $$;

create function public.cancel_ice_contract(target_contract uuid,change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare target_league uuid;existing public.ice_contracts;saved public.ice_contracts;
begin
 select league_id into target_league from public.ice_contracts where id=target_contract;
 if target_league is null or auth.uid() is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=target_league for update;
 select * into existing from public.ice_contracts where id=target_contract for update;
 if existing.id is null then raise exception using errcode='42501',message='Commissioner access required'; end if;
 if existing.status<>'active' then raise exception using errcode='P0001',message='ICE_CONTRACT_ALREADY_CANCELLED'; end if;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
  raise exception using errcode='22023',message='CANCELLATION_REASON_REQUIRED';
 end if;
 if exists(select 1 from public.ice_slots where contract_id=target_contract) then
  raise exception using errcode='P0001',message='ICE_CONTRACT_HAS_ASSIGNED_SLOTS';
 end if;
 update public.ice_contracts set status='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),
  cancellation_reason=trim(change_reason) where id=target_contract returning * into saved;
 insert into public.ice_contract_audit(league_id,contract_id,actor_id,action,reason,previous_record,new_record)
 values(saved.league_id,saved.id,auth.uid(),'cancelled',trim(change_reason),to_jsonb(existing),to_jsonb(saved));
end; $$;

create function public.create_ice_slot_with_contract(target_league uuid,target_division uuid,target_rink uuid,
 start_time timestamptz,end_time timestamptz,slot_tier text,slot_required boolean,target_contract uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_slot uuid;slot_date date;contract_row public.ice_contracts;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=target_league for update;
 if target_contract is not null then
  select * into contract_row from public.ice_contracts where id=target_contract and league_id=target_league;
  if contract_row.id is null or contract_row.status<>'active' then
   raise exception using errcode='22023',message='ICE_CONTRACT_UNAVAILABLE';
  end if;
  select (start_time at time zone v.time_zone)::date into slot_date
   from public.rinks r join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
   where r.id=target_rink and r.league_id=target_league;
  if contract_row.rink_id<>target_rink or slot_date not between contract_row.start_date and contract_row.end_date then
   raise exception using errcode='22023',message='ICE_CONTRACT_SLOT_MISMATCH';
  end if;
 end if;
 saved_slot=public.create_ice_slot(target_league,target_division,target_rink,start_time,end_time,slot_tier,slot_required);
 if target_contract is not null then
  update public.ice_slots set contract_id=target_contract where id=saved_slot;
  insert into public.ice_slot_contract_audit(league_id,slot_id,actor_id,new_contract_id,reason)
  values(target_league,saved_slot,auth.uid(),target_contract,'Assigned during slot creation');
 end if;
 return saved_slot;
end; $$;

revoke all on function public.create_ice_contract(uuid,uuid,text,text,date,date,numeric,integer,text),
 public.assign_ice_slot_contract(uuid,uuid,text),public.cancel_ice_contract(uuid,text),
 public.create_ice_slot_with_contract(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean,uuid)
 from public,anon,authenticated;
grant execute on function public.create_ice_contract(uuid,uuid,text,text,date,date,numeric,integer,text),
 public.assign_ice_slot_contract(uuid,uuid,text),public.cancel_ice_contract(uuid,text),
 public.create_ice_slot_with_contract(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean,uuid)
 to authenticated;

commit;
