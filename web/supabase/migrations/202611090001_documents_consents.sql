begin;

create table public.season_documents (
  id uuid primary key,
  league_id uuid not null,
  season_id uuid not null,
  document_type text not null check (document_type in ('waiver', 'code_of_conduct')),
  title text not null check (length(trim(title)) between 2 and 120),
  version integer not null check (version > 0),
  object_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 160),
  file_size integer not null check (file_size between 8 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (season_id, league_id) references public.seasons(id, league_id),
  unique (season_id, document_type, version)
);

create table public.registration_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.player_registrations(id),
  league_id uuid not null references public.leagues(id),
  user_id uuid not null references auth.users(id),
  player_id uuid not null references public.players(id),
  document_id uuid not null references public.season_documents(id),
  document_title text not null,
  document_version integer not null check (document_version > 0),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  signer_name text not null check (length(trim(signer_name)) between 2 and 100),
  accepted_at timestamptz not null default now(),
  unique (registration_id, document_id)
);

create table public.registration_consents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.player_registrations(id),
  league_id uuid not null references public.leagues(id),
  user_id uuid not null references auth.users(id),
  player_id uuid not null references public.players(id),
  consent_type text not null check (consent_type in ('public_profile', 'filming', 'marketing')),
  consent_version integer not null default 1 check (consent_version > 0),
  consent_text text not null check (length(consent_text) between 10 and 500),
  granted boolean not null,
  recorded_at timestamptz not null default now(),
  unique (registration_id, consent_type)
);

alter table public.season_documents enable row level security;
alter table public.registration_document_acceptances enable row level security;
alter table public.registration_consents enable row level security;
revoke all on public.season_documents, public.registration_document_acceptances, public.registration_consents from anon, authenticated;
grant select on public.season_documents, public.registration_document_acceptances, public.registration_consents to authenticated;

create function public.can_view_season_documents(target_season uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.season_settings s
      where s.season_id=target_season and s.registration_enabled
        and s.registration_opens is not null and s.registration_closes is not null
        and (now() at time zone 'UTC')::date between s.registration_opens and s.registration_closes
    )
    or exists (
      select 1 from public.player_registrations r
      where r.season_id=target_season and r.user_id=(select auth.uid())
    )
  );
$$;
revoke all on function public.can_view_season_documents(uuid) from public, anon;
grant execute on function public.can_view_season_documents(uuid) to authenticated;

create policy season_documents_read on public.season_documents for select to authenticated using (
  public.is_league_commissioner(league_id)
  or public.can_view_season_documents(season_id)
);
create policy document_acceptances_read on public.registration_document_acceptances for select to authenticated
  using (user_id=(select auth.uid()) or public.is_league_commissioner(league_id));
create policy registration_consents_read on public.registration_consents for select to authenticated
  using (user_id=(select auth.uid()) or public.is_league_commissioner(league_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('league-documents', 'league-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Supabase manages RLS on storage.objects; add bucket-specific policies without altering the managed table.
create function public.can_manage_document_object(target_name text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare parts text[];
begin
  if auth.uid() is null then return false; end if;
  parts:=string_to_array(target_name,'/');
  if array_length(parts,1)<>3
    or parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$' then
    return false;
  end if;
  return exists (
    select 1 from public.seasons s
    where s.id=parts[2]::uuid and s.league_id=parts[1]::uuid
      and public.is_league_commissioner(s.league_id)
  );
end;
$$;

create function public.can_read_document_object(target_name text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
begin
  return auth.uid() is not null and (
    public.can_manage_document_object(target_name)
    or exists (
      select 1 from public.season_documents d
      where d.object_path=target_name
        and (
        public.is_league_commissioner(d.league_id)
        or exists (
          select 1 from public.season_settings s
          where s.season_id=d.season_id and s.registration_enabled
            and s.registration_opens is not null and s.registration_closes is not null
            and (now() at time zone 'UTC')::date between s.registration_opens and s.registration_closes
        )
        or exists (
          select 1 from public.player_registrations r
          where r.season_id=d.season_id and r.user_id=(select auth.uid())
        )
      )
    )
  );
end;
$$;

create function public.can_delete_document_object(target_name text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
begin
  return public.can_manage_document_object(target_name)
    and not exists (select 1 from public.season_documents d where d.object_path=target_name);
end;
$$;

revoke all on function public.can_manage_document_object(text), public.can_read_document_object(text), public.can_delete_document_object(text) from public, anon;
grant execute on function public.can_manage_document_object(text), public.can_read_document_object(text), public.can_delete_document_object(text) to authenticated;

create policy league_documents_read on storage.objects for select to authenticated
  using (bucket_id='league-documents' and public.can_read_document_object(name));
create policy league_documents_upload on storage.objects for insert to authenticated
  with check (bucket_id='league-documents' and public.can_manage_document_object(name));
create policy league_documents_cleanup on storage.objects for delete to authenticated
  using (bucket_id='league-documents' and public.can_delete_document_object(name));

create function public.create_season_document(
  target_season uuid,
  target_document uuid,
  target_document_type text,
  document_title text,
  object_path text,
  original_file_name text,
  file_size integer,
  file_sha256 text
)
returns integer language plpgsql security definer set search_path=''
as $$
declare target_league uuid; next_version integer; expected_path text;
begin
  select s.league_id into target_league from public.seasons s where s.id=target_season for update;
  if auth.uid() is null or target_league is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501',message='Commissioner access required';
  end if;
  if target_document is null or target_document_type not in ('waiver','code_of_conduct')
    or document_title is null or length(trim(document_title)) not between 2 and 120
    or original_file_name is null or length(original_file_name) not between 1 and 160
    or file_size is null or file_size not between 8 and 10485760
    or file_sha256 is null or file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='Invalid document details';
  end if;
  expected_path:=target_league::text||'/'||target_season::text||'/'||target_document::text||'.pdf';
  if object_path is distinct from expected_path
    or not exists(select 1 from storage.objects o where o.bucket_id='league-documents' and o.name=expected_path) then
    raise exception using errcode='22023',message='Uploaded document not found';
  end if;
  select coalesce(max(d.version),0)+1 into next_version
    from public.season_documents d
    where d.season_id=target_season and d.document_type=target_document_type;
  insert into public.season_documents(
    id,league_id,season_id,document_type,title,version,object_path,file_name,file_size,sha256,created_by
  ) values (
    target_document,target_league,target_season,target_document_type,trim(document_title),next_version,
    expected_path,original_file_name,file_size,file_sha256,auth.uid()
  );
  return next_version;
end;
$$;

drop function public.submit_registration(uuid,text,text);
create function public.submit_registration(
  target_season uuid,
  player_name text,
  preferred_position text,
  accepted_documents uuid[],
  signer_name text,
  consent_public_profile boolean,
  consent_filming boolean,
  consent_marketing boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare settings public.season_settings; player uuid; request_id uuid; current_document_count integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if signer_name is null or length(trim(signer_name)) not between 2 and 100
    or consent_public_profile is null or consent_filming is null or consent_marketing is null then
    raise exception using errcode='22023',message='Document signature and consent choices are required';
  end if;
  perform 1 from auth.users where id=auth.uid() for update;
  select * into settings from public.season_settings where season_id=target_season for share;
  if settings.season_id is null or not settings.registration_enabled or settings.registration_opens is null or settings.registration_closes is null
    or (now() at time zone 'UTC')::date not between settings.registration_opens and settings.registration_closes then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  perform 1 from public.seasons where id=target_season for share;
  if exists(select 1 from public.player_registrations where season_id=target_season and user_id=auth.uid()) then
    raise exception 'REGISTRATION_EXISTS';
  end if;
  select count(*) into current_document_count
  from public.season_documents d
  where d.season_id=target_season
    and d.version=(select max(d2.version) from public.season_documents d2
      where d2.season_id=d.season_id and d2.document_type=d.document_type);
  if not exists (
    select 1 from public.season_documents d where d.season_id=target_season and d.document_type='waiver'
      and d.version=(select max(d2.version) from public.season_documents d2
        where d2.season_id=d.season_id and d2.document_type=d.document_type)
  ) then raise exception 'REGISTRATION_DOCUMENTS_REQUIRED'; end if;
  if accepted_documents is null or cardinality(accepted_documents)<>current_document_count
    or exists (
      select 1 from public.season_documents d
      where d.season_id=target_season
        and d.version=(select max(d2.version) from public.season_documents d2
          where d2.season_id=d.season_id and d2.document_type=d.document_type)
        and not (d.id=any(accepted_documents))
    )
    or exists (
      select 1 from unnest(accepted_documents) selected(id)
      where not exists (
        select 1 from public.season_documents d
        where d.id=selected.id and d.season_id=target_season
          and d.version=(select max(d2.version) from public.season_documents d2
            where d2.season_id=d.season_id and d2.document_type=d.document_type)
      )
    ) then raise exception 'REGISTRATION_DOCUMENTS_STALE'; end if;

  select id into player from public.players where owner_user_id=auth.uid();
  if player is null then
    insert into public.players(display_name,owner_user_id) values(trim(player_name),auth.uid()) returning id into player;
  end if;
  insert into public.player_registrations(league_id,season_id,user_id,player_id,position,season_name,league_name)
  values(settings.league_id,target_season,auth.uid(),player,preferred_position,
    (select name from public.seasons where id=target_season),(select name from public.leagues where id=settings.league_id))
  returning id into request_id;

  insert into public.registration_audit(registration_id,league_id,actor_id,new_status,reason)
  values(request_id,settings.league_id,auth.uid(),'pending','Player submitted application');
  insert into public.registration_document_acceptances(
    registration_id,league_id,user_id,player_id,document_id,document_title,document_version,document_sha256,signer_name
  )
  select request_id,settings.league_id,auth.uid(),player,d.id,d.title,d.version,d.sha256,trim(signer_name)
  from public.season_documents d where d.id=any(accepted_documents);
  insert into public.registration_consents(registration_id,league_id,user_id,player_id,consent_type,consent_text,granted)
  values
    (request_id,settings.league_id,auth.uid(),player,'public_profile','Allow my player profile to appear on public league pages.',consent_public_profile),
    (request_id,settings.league_id,auth.uid(),player,'filming','Allow game footage featuring me to be captured and used by the league.',consent_filming),
    (request_id,settings.league_id,auth.uid(),player,'marketing','Allow the league to use my information for marketing communications.',consent_marketing);
  return request_id;
end;
$$;

revoke all on function public.create_season_document(uuid,uuid,text,text,text,text,integer,text),
  public.submit_registration(uuid,text,text,uuid[],text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.create_season_document(uuid,uuid,text,text,text,text,integer,text),
  public.submit_registration(uuid,text,text,uuid[],text,boolean,boolean,boolean) to authenticated;
commit;
