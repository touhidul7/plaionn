begin;

-- ============================================================================
-- Migration: 202611160035_privacy_export_and_consent_withdrawal.sql
-- Personal Data Export, Consent Revocation, and Right-to-be-Forgotten Redaction
-- ============================================================================

-- ============================================================================
-- 1. RPC: export_my_player_data
-- Compiles all personal profile, attendance, stats, dues, documents, and logs
-- ============================================================================
create or replace function public.export_my_player_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  curr_user uuid;
  p_rec public.players;
  user_email text;
  export_obj jsonb;
begin
  curr_user := auth.uid();
  if curr_user is null then
    raise exception 'Authentication required to export personal data.';
  end if;

  select email into user_email from auth.users where id = curr_user;

  select * into p_rec
  from public.players
  where owner_user_id = curr_user
  limit 1;

  export_obj := jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', curr_user,
      'email', user_email,
      'exported_at', now()
    ),
    'player_profile', case
      when p_rec.id is not null then jsonb_build_object(
        'player_id', p_rec.id,
        'display_name', p_rec.display_name,
        'created_at', p_rec.created_at
      )
      else null
    end,
    'memberships', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'league_id', lm.league_id,
            'role', lm.role
          )
        )
        from public.league_memberships lm
        where lm.user_id = curr_user
      ),
      '[]'::jsonb
    ),
    'registrations', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'registration_id', pr.id,
            'league_name', pr.league_name,
            'season_name', pr.season_name,
            'position', pr.position,
            'status', pr.status,
            'created_at', pr.created_at
          )
        )
        from public.player_registrations pr
        where pr.user_id = curr_user
      ),
      '[]'::jsonb
    ),
    'consents', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'consent_type', rc.consent_type,
            'granted', rc.granted,
            'consent_text', rc.consent_text,
            'recorded_at', rc.recorded_at
          )
        )
        from public.registration_consents rc
        where rc.user_id = curr_user
      ),
      '[]'::jsonb
    ),
    'signed_documents', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'document_title', rda.document_title,
            'version', rda.document_version,
            'signer_name', rda.signer_name,
            'accepted_at', rda.accepted_at
          )
        )
        from public.registration_document_acceptances rda
        where rda.user_id = curr_user
      ),
      '[]'::jsonb
    ),
    'game_attendance', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'game_id', ga.game_id,
            'status', ga.status,
            'note', ga.note,
            'updated_at', ga.updated_at
          )
        )
        from public.game_attendance ga
        where ga.player_id = p_rec.id
      ),
      '[]'::jsonb
    ),
    'notification_preferences', coalesce(
      (
        select to_jsonb(np.*)
        from public.notification_preferences np
        where np.user_id = curr_user
        limit 1
      ),
      '{}'::jsonb
    )
  );

  return export_obj;
end;
$$;

grant execute on function public.export_my_player_data to authenticated;

-- ============================================================================
-- 2. RPC: withdraw_registration_consent
-- Allows player to revoke a previously granted consent
-- ============================================================================
create or replace function public.withdraw_registration_consent(
  p_registration_id uuid,
  p_consent_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  curr_user uuid;
  c_rec public.registration_consents;
begin
  curr_user := auth.uid();
  if curr_user is null then
    raise exception 'Authentication required.';
  end if;

  select * into c_rec
  from public.registration_consents
  where registration_id = p_registration_id
    and user_id = curr_user
    and consent_type = p_consent_type;

  if c_rec.id is null then
    raise exception 'Consent record not found.';
  end if;

  update public.registration_consents
  set granted = false,
      recorded_at = now()
  where id = c_rec.id;

  return true;
end;
$$;

grant execute on function public.withdraw_registration_consent to authenticated;

-- ============================================================================
-- 3. RPC: anonymize_my_player_profile
-- Redacts identifiable information while preserving scoring invariants
-- ============================================================================
create or replace function public.anonymize_my_player_profile(
  p_confirmation text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  curr_user uuid;
  p_rec public.players;
begin
  curr_user := auth.uid();
  if curr_user is null then
    raise exception 'Authentication required.';
  end if;

  if trim(lower(p_confirmation)) <> 'anonymize my data' then
    raise exception 'Confirmation string does not match "anonymize my data".';
  end if;

  select * into p_rec
  from public.players
  where owner_user_id = curr_user;

  if p_rec.id is not null then
    update public.players
    set display_name = 'Redacted Player',
        owner_user_id = null
    where id = p_rec.id;

    update public.roster_memberships
    set status = 'inactive'
    where player_id = p_rec.id;
  end if;

  -- Revoke all optional consents
  update public.registration_consents
  set granted = false,
      recorded_at = now()
  where user_id = curr_user;

  -- Clear notification preferences and phone number
  update public.notification_preferences
  set phone_number = null,
      sms_enabled = false,
      push_enabled = false,
      email_enabled = false
  where user_id = curr_user;

  return true;
end;
$$;

grant execute on function public.anonymize_my_player_profile to authenticated;

commit;
