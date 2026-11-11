begin;

create table public.game_results (
 game_id uuid not null,
 league_id uuid not null,
 home_entry_id uuid not null,
 away_entry_id uuid not null,
 home_score integer not null check(home_score>=0),
 away_score integer not null check(away_score>=0),
 home_penalty_minutes integer not null check(home_penalty_minutes>=0),
 away_penalty_minutes integer not null check(away_penalty_minutes>=0),
 decision text not null check(decision in ('regulation','overtime','shootout','tie')),
 status text not null check(status in ('pending','approved','correction')),
 revision integer not null default 1 check(revision>0),
 submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 correction_reason text,
 primary key(game_id),
 foreign key(game_id,league_id) references public.games(id,league_id),
 foreign key(home_entry_id,league_id) references public.team_entries(id,league_id),
 foreign key(away_entry_id,league_id) references public.team_entries(id,league_id),
 check(home_entry_id<>away_entry_id),
 check((status='approved' and reviewed_by is not null and reviewed_at is not null)
  or (status<>'approved' and reviewed_by is null and reviewed_at is null))
);

create table public.game_result_audit (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 game_id uuid not null references public.games(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('submitted','approved','returned_for_correction','reopened','resubmitted')),
 reason text not null check(length(trim(reason)) between 3 and 500),
 previous_result jsonb,
 new_result jsonb,
 changed_at timestamptz not null default now()
);

alter table public.game_results enable row level security;
alter table public.game_result_audit enable row level security;
revoke all on public.game_results,public.game_result_audit from anon,authenticated;
grant select on public.game_results,public.game_result_audit to authenticated;
create policy game_results_member_read on public.game_results for select to authenticated
 using(public.is_league_member(league_id));
create policy game_result_audit_read on public.game_result_audit for select to authenticated using(
 public.is_league_commissioner(league_id) or exists(
  select 1 from public.game_officials o where o.game_id=game_result_audit.game_id and o.user_id=auth.uid()
 )
);

create function public.guard_game_event_result_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.game_results r where r.game_id=new.game_id and r.status<>'correction') then
  raise exception using errcode='P0001',message='GAME_RESULT_LOCKED';
 end if;
 return new;
end; $$;
create trigger game_event_result_lock before insert on public.game_events
 for each row execute function public.guard_game_event_result_lock();
create trigger game_event_void_result_lock before insert on public.game_event_voids
 for each row execute function public.guard_game_event_result_lock();
revoke all on function public.guard_game_event_result_lock() from public,anon,authenticated;

create function public.guard_game_result_fixture_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.game_results r where r.game_id=old.id) then
  raise exception using errcode='P0001',message='GAME_RESULT_EXISTS';
 end if;
 return new;
end; $$;
create trigger game_result_fixture_guard before update of home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status
 on public.games for each row execute function public.guard_game_result_fixture_changes();
revoke all on function public.guard_game_result_fixture_changes() from public,anon,authenticated;

create function public.submit_game_result(target_game uuid,result_decision text,change_reason text default null)
returns integer language plpgsql security definer set search_path='' as $$
declare
 fixture public.games;
 existing public.game_results;
 saved public.game_results;
 target_season uuid;
 v_home_score integer;
 v_away_score integer;
 v_home_penalties integer;
 v_away_penalties integer;
 action_name text;
 reason_value text;
begin
 select * into fixture from public.games where id=target_game for update;
 if auth.uid() is null or fixture.id is null or fixture.status<>'scheduled'
  or (not public.is_league_commissioner(fixture.league_id) and not exists(
   select 1 from public.game_officials o where o.game_id=fixture.id and o.user_id=auth.uid() and o.role='timekeeper'
  )) then
  raise exception using errcode='42501',message='Assigned timekeeper access required';
 end if;
 select * into existing from public.game_results where game_id=fixture.id for update;
 if existing.game_id is not null and existing.status<>'correction' then
  raise exception using errcode='P0001',message='RESULT_NOT_READY_FOR_SUBMISSION';
 end if;
 if result_decision is null or result_decision not in ('regulation','overtime','shootout','tie') then
  raise exception using errcode='22023',message='INVALID_RESULT_DECISION';
 end if;
 if existing.game_id is not null and (change_reason is null or length(trim(change_reason)) not between 3 and 500) then
  raise exception using errcode='22023',message='CORRECTION_REASON_REQUIRED';
 end if;
 reason_value=coalesce(nullif(trim(change_reason),''),'Final score submitted for review');

 select count(*) filter(where e.team_entry_id=fixture.home_entry_id and e.event_kind='goal'),
  count(*) filter(where e.team_entry_id=fixture.away_entry_id and e.event_kind='goal'),
  coalesce(sum(e.penalty_minutes) filter(where e.team_entry_id=fixture.home_entry_id and e.event_kind='penalty'),0),
  coalesce(sum(e.penalty_minutes) filter(where e.team_entry_id=fixture.away_entry_id and e.event_kind='penalty'),0)
 into v_home_score,v_away_score,v_home_penalties,v_away_penalties
 from public.game_events e
 where e.game_id=fixture.id and not exists(select 1 from public.game_event_voids v where v.event_id=e.id);
 if (result_decision='tie' and v_home_score<>v_away_score)
  or (result_decision<>'tie' and v_home_score=v_away_score) then
  raise exception using errcode='22023',message='RESULT_DECISION_SCORE_MISMATCH';
 end if;

 if existing.game_id is null then
  insert into public.game_results(game_id,league_id,home_entry_id,away_entry_id,home_score,away_score,
   home_penalty_minutes,away_penalty_minutes,decision,status,submitted_by,correction_reason)
  values(fixture.id,fixture.league_id,fixture.home_entry_id,fixture.away_entry_id,v_home_score,v_away_score,
   v_home_penalties,v_away_penalties,result_decision,'pending',auth.uid(),null)
  returning * into saved;
  action_name='submitted';
 else
  update public.game_results set home_score=v_home_score,away_score=v_away_score,
   home_penalty_minutes=v_home_penalties,away_penalty_minutes=v_away_penalties,decision=result_decision,
   status='pending',revision=revision+1,submitted_by=auth.uid(),submitted_at=now(),
   reviewed_by=null,reviewed_at=null,correction_reason=reason_value
  where game_id=fixture.id returning * into saved;
  action_name='resubmitted';
 end if;
 insert into public.game_result_audit(league_id,game_id,actor_id,action,reason,previous_result,new_result)
 values(fixture.league_id,fixture.id,auth.uid(),action_name,reason_value,
  case when existing.game_id is null then null else to_jsonb(existing) end,to_jsonb(saved));
 return saved.revision;
end; $$;

create function public.review_game_result(target_game uuid,approve_result boolean,review_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare existing public.game_results; saved public.game_results; action_name text;
begin
 select * into existing from public.game_results where game_id=target_game for update;
 if existing.game_id is null then raise exception using errcode='P0002',message='RESULT_NOT_FOUND'; end if;
 if auth.uid() is null or (not public.is_league_commissioner(existing.league_id) and not exists(
  select 1 from public.game_officials o where o.game_id=target_game and o.user_id=auth.uid() and o.role='referee'
 )) then
  raise exception using errcode='42501',message='Assigned referee access required';
 end if;
 if existing.status<>'pending' then raise exception using errcode='P0001',message='RESULT_NOT_PENDING'; end if;
 if auth.uid()=existing.submitted_by then raise exception using errcode='42501',message='INDEPENDENT_REVIEW_REQUIRED'; end if;
 if review_reason is null or length(trim(review_reason)) not between 3 and 500 then
  raise exception using errcode='22023',message='REVIEW_REASON_REQUIRED';
 end if;
 update public.game_results set status=case when approve_result then 'approved' else 'correction' end,
  reviewed_by=case when approve_result then auth.uid() else null end,
  reviewed_at=case when approve_result then now() else null end,
  correction_reason=case when approve_result then correction_reason else trim(review_reason) end
 where game_id=target_game returning * into saved;
 action_name=case when approve_result then 'approved' else 'returned_for_correction' end;
 insert into public.game_result_audit(league_id,game_id,actor_id,action,reason,previous_result,new_result)
 values(saved.league_id,target_game,auth.uid(),action_name,trim(review_reason),to_jsonb(existing),to_jsonb(saved));
 return saved.revision;
end; $$;

create function public.reopen_game_result(target_game uuid,change_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare existing public.game_results; saved public.game_results;
begin
 select * into existing from public.game_results where game_id=target_game for update;
 if existing.game_id is null then raise exception using errcode='P0002',message='RESULT_NOT_FOUND'; end if;
 if auth.uid() is null or (not public.is_league_commissioner(existing.league_id) and not exists(
  select 1 from public.game_officials o where o.game_id=target_game and o.user_id=auth.uid() and o.role='referee'
 )) then
  raise exception using errcode='42501',message='Assigned referee access required';
 end if;
 if existing.status<>'approved' then raise exception using errcode='P0001',message='RESULT_NOT_APPROVED'; end if;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
  raise exception using errcode='22023',message='CORRECTION_REASON_REQUIRED';
 end if;
 update public.game_results set status='correction',reviewed_by=null,reviewed_at=null,
  correction_reason=trim(change_reason)
 where game_id=target_game returning * into saved;
 insert into public.game_result_audit(league_id,game_id,actor_id,action,reason,previous_result,new_result)
 values(saved.league_id,target_game,auth.uid(),'reopened',trim(change_reason),to_jsonb(existing),to_jsonb(saved));
 return saved.revision;
end; $$;

revoke all on function public.submit_game_result(uuid,text,text),
 public.review_game_result(uuid,boolean,text),public.reopen_game_result(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_game_result(uuid,text,text),
 public.review_game_result(uuid,boolean,text),public.reopen_game_result(uuid,text) to authenticated;

create function public.get_season_standings(target_season uuid)
returns table(
 division_id uuid,division_name text,team_entry_id uuid,team_name text,rank bigint,
 games_played bigint,wins bigint,ties bigint,losses bigint,overtime_losses bigint,
 goals_for bigint,goals_against bigint,goal_difference bigint,penalty_minutes bigint,
 points bigint,head_to_head_points bigint
) language plpgsql stable security definer set search_path='' as $$
declare target_league uuid;
begin
 select league_id into target_league from public.seasons where id=target_season;
 if auth.uid() is null or target_league is null or not public.is_league_member(target_league) then
  raise exception using errcode='42501',message='League membership required';
 end if;
 return query
 with teams as (
  select e.id team_entry_id,e.division_id,d.name division_name,t.name team_name,s.league_id,
   coalesce(ss.win_points,2) win_points,coalesce(ss.tie_points,1) tie_points,
   coalesce(ss.loss_points,0) loss_points,coalesce(ss.overtime_loss_points,1) overtime_loss_points,
   coalesce(ss.standings_tiebreakers,array['wins','goal_difference','goals_for','head_to_head','fewest_penalties']::text[]) tie_order
  from public.team_entries e
  join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  join public.teams t on t.id=e.team_id and t.league_id=e.league_id
  join public.seasons s on s.id=d.season_id and s.league_id=d.league_id
  left join public.season_settings ss on ss.season_id=s.id and ss.league_id=s.league_id
  where s.id=target_season
 ), approved_games as (
  select r.game_id,r.home_entry_id,r.away_entry_id,r.home_score,r.away_score,
   r.home_penalty_minutes,r.away_penalty_minutes,r.decision
  from public.game_results r where r.league_id=target_league and r.status='approved'
 ), sides as (
  select t.division_id,t.team_entry_id,r.away_entry_id opponent_id,r.home_score goals_for,r.away_score goals_against,
   r.home_penalty_minutes penalty_minutes,r.decision,
   case when r.home_score=r.away_score then 'tie'
    when r.home_score>r.away_score then 'win'
    when r.decision in ('overtime','shootout') then 'overtime_loss' else 'loss' end outcome,
   case when r.home_score=r.away_score then t.tie_points
    when r.home_score>r.away_score then t.win_points
    when r.decision in ('overtime','shootout') then t.overtime_loss_points else t.loss_points end awarded_points
  from approved_games r join teams t on t.team_entry_id=r.home_entry_id
  union all
  select t.division_id,t.team_entry_id,r.home_entry_id opponent_id,r.away_score goals_for,r.home_score goals_against,
   r.away_penalty_minutes penalty_minutes,r.decision,
   case when r.home_score=r.away_score then 'tie'
    when r.away_score>r.home_score then 'win'
    when r.decision in ('overtime','shootout') then 'overtime_loss' else 'loss' end outcome,
   case when r.home_score=r.away_score then t.tie_points
    when r.away_score>r.home_score then t.win_points
    when r.decision in ('overtime','shootout') then t.overtime_loss_points else t.loss_points end awarded_points
  from approved_games r join teams t on t.team_entry_id=r.away_entry_id
 ), totals as (
  select t.division_id,t.team_entry_id,t.division_name,t.team_name,t.tie_order,
   count(s.team_entry_id)::bigint games_played,
   count(*) filter(where s.outcome='win')::bigint wins,
   count(*) filter(where s.outcome='tie')::bigint ties,
   count(*) filter(where s.outcome='loss')::bigint losses,
   count(*) filter(where s.outcome='overtime_loss')::bigint overtime_losses,
   coalesce(sum(s.goals_for),0)::bigint goals_for,
   coalesce(sum(s.goals_against),0)::bigint goals_against,
   coalesce(sum(s.goals_for-s.goals_against),0)::bigint goal_difference,
   coalesce(sum(s.penalty_minutes),0)::bigint penalty_minutes,
   coalesce(sum(s.awarded_points),0)::bigint points
  from teams t left join sides s on s.team_entry_id=t.team_entry_id
  group by t.division_id,t.team_entry_id,t.division_name,t.team_name,t.tie_order
 ), head_to_head as (
  select s.team_entry_id,coalesce(sum(s.awarded_points),0)::bigint head_to_head_points
  from sides s join totals own on own.team_entry_id=s.team_entry_id
  join totals opponent on opponent.team_entry_id=s.opponent_id
   and opponent.division_id=own.division_id and opponent.points=own.points
  group by s.team_entry_id
 ), ranked as (
  select t.*,coalesce(h.head_to_head_points,0)::bigint head_to_head_points,
   row_number() over(partition by t.division_id order by t.points desc,
    case when t.tie_order[1]='wins' then t.wins end desc,
    case when t.tie_order[1]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[1]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[1]='goals_for' then t.goals_for end desc,
    case when t.tie_order[1]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[2]='wins' then t.wins end desc,
    case when t.tie_order[2]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[2]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[2]='goals_for' then t.goals_for end desc,
    case when t.tie_order[2]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[3]='wins' then t.wins end desc,
    case when t.tie_order[3]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[3]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[3]='goals_for' then t.goals_for end desc,
    case when t.tie_order[3]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[4]='wins' then t.wins end desc,
    case when t.tie_order[4]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[4]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[4]='goals_for' then t.goals_for end desc,
    case when t.tie_order[4]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[5]='wins' then t.wins end desc,
    case when t.tie_order[5]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[5]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[5]='goals_for' then t.goals_for end desc,
    case when t.tie_order[5]='fewest_penalties' then t.penalty_minutes end asc,
    lower(t.team_name),t.team_entry_id) rank
  from totals t left join head_to_head h on h.team_entry_id=t.team_entry_id
 )
 select r.division_id,r.division_name,r.team_entry_id,r.team_name,r.rank,
  r.games_played,r.wins,r.ties,r.losses,r.overtime_losses,r.goals_for,r.goals_against,
  r.goal_difference,r.penalty_minutes,r.points,r.head_to_head_points
 from ranked r order by r.division_name,r.rank;
end; $$;
revoke all on function public.get_season_standings(uuid) from public,anon,authenticated;
grant execute on function public.get_season_standings(uuid) to authenticated;

commit;
