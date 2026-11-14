begin;

-- ============================================================================
-- Migration: 202611160023_whitelabel_and_branding.sql
-- Adds white-label branding, custom colors, logos, banners, and domain resolution
-- for independent tenant leagues across the Plaionn Hockey Network.
-- ============================================================================

create table if not exists public.league_branding_profiles (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  custom_domain text check(custom_domain is null or length(trim(custom_domain)) between 3 and 120),
  brand_name text check(brand_name is null or length(trim(brand_name)) between 2 and 100),
  primary_color text not null default '#0f172a',
  secondary_color text not null default '#10b981',
  accent_color text not null default '#f59e0b',
  logo_url text,
  favicon_url text,
  hero_headline text,
  hero_subheadline text,
  footer_text text,
  is_custom_domain_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id),
  unique(custom_domain)
);

create index if not exists idx_branding_custom_domain on public.league_branding_profiles(custom_domain) where custom_domain is not null;

alter table public.league_branding_profiles enable row level security;

grant select on public.league_branding_profiles to anon, authenticated;
grant all on public.league_branding_profiles to authenticated;

drop policy if exists branding_public_read on public.league_branding_profiles;
create policy branding_public_read on public.league_branding_profiles for select using (true);

drop policy if exists branding_comm_manage on public.league_branding_profiles;
create policy branding_comm_manage on public.league_branding_profiles for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: update_league_branding
-- ============================================================================
create or replace function public.update_league_branding(
  target_league uuid,
  p_brand_name text default null,
  p_custom_domain text default null,
  p_primary_color text default '#0f172a',
  p_secondary_color text default '#10b981',
  p_accent_color text default '#f59e0b',
  p_logo_url text default null,
  p_hero_headline text default null,
  p_hero_subheadline text default null
)
returns public.league_branding_profiles
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.league_branding_profiles;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  insert into public.league_branding_profiles (
    league_id, brand_name, custom_domain, primary_color, secondary_color,
    accent_color, logo_url, hero_headline, hero_subheadline, updated_at
  )
  values (
    target_league,
    nullif(trim(p_brand_name), ''),
    nullif(lower(trim(p_custom_domain)), ''),
    coalesce(nullif(trim(p_primary_color), ''), '#0f172a'),
    coalesce(nullif(trim(p_secondary_color), ''), '#10b981'),
    coalesce(nullif(trim(p_accent_color), ''), '#f59e0b'),
    nullif(trim(p_logo_url), ''),
    nullif(trim(p_hero_headline), ''),
    nullif(trim(p_hero_subheadline), ''),
    now()
  )
  on conflict (league_id) do update
  set brand_name = coalesce(excluded.brand_name, public.league_branding_profiles.brand_name),
      custom_domain = coalesce(excluded.custom_domain, public.league_branding_profiles.custom_domain),
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      accent_color = excluded.accent_color,
      logo_url = coalesce(excluded.logo_url, public.league_branding_profiles.logo_url),
      hero_headline = coalesce(excluded.hero_headline, public.league_branding_profiles.hero_headline),
      hero_subheadline = coalesce(excluded.hero_subheadline, public.league_branding_profiles.hero_subheadline),
      updated_at = now()
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.update_league_branding(uuid, text, text, text, text, text, text, text, text) to authenticated;

-- ============================================================================
-- RPC: resolve_league_by_domain
-- Resolves league tenant by incoming custom domain or sub-host
-- ============================================================================
create or replace function public.resolve_league_by_domain(host_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  cleaned_host text;
  b_rec public.league_branding_profiles;
  l_rec public.leagues;
begin
  cleaned_host := lower(trim(host_domain));
  if cleaned_host is null or length(cleaned_host) = 0 then
    return null;
  end if;

  select * into b_rec
  from public.league_branding_profiles
  where custom_domain = cleaned_host
  limit 1;

  if b_rec.league_id is not null then
    select * into l_rec from public.leagues where id = b_rec.league_id;
    return jsonb_build_object(
      'league_id', l_rec.id,
      'league_name', l_rec.name,
      'brand_name', coalesce(b_rec.brand_name, l_rec.name),
      'primary_color', b_rec.primary_color,
      'secondary_color', b_rec.secondary_color,
      'logo_url', b_rec.logo_url,
      'hero_headline', b_rec.hero_headline,
      'custom_domain', b_rec.custom_domain
    );
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_league_by_domain(text) to anon, authenticated;

commit;
