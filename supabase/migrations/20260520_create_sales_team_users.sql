-- ============================================================
--  Farmers Factory ERP — Sales Team User Creation
--  Migration: 20260520_create_sales_team_users.sql
--  Run in Supabase Dashboard → SQL Editor
--
--  Creates 8 sales team members (field_executive role)
--  with login credentials for the Sales module.
--
--  Default password for all: FF@2026
--  (Users should change on first login)
-- ============================================================

DO $$
DECLARE
  uid uuid;
BEGIN

  -- ── 1. PRIYANKA ────────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'priyanka@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Priyanka"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'priyanka@farmersfactory.in'),
      'email', 'priyanka@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'priyanka@farmersfactory.in', 'Priyanka', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 2. INDHUREKHA ──────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'indhurekha@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Indhurekha"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'indhurekha@farmersfactory.in'),
      'email', 'indhurekha@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'indhurekha@farmersfactory.in', 'Indhurekha', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 3. ARUN ────────────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'arun@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Arun"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'arun@farmersfactory.in'),
      'email', 'arun@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'arun@farmersfactory.in', 'Arun', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 4. AKASH ───────────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'akash@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Akash"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'akash@farmersfactory.in'),
      'email', 'akash@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'akash@farmersfactory.in', 'Akash', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 5. PARASA JAGADEESH ────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'parasajagadeesh@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Parasa Jagadeesh"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'parasajagadeesh@farmersfactory.in'),
      'email', 'parasajagadeesh@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'parasajagadeesh@farmersfactory.in', 'Parasa Jagadeesh', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 6. YAZHINI ────────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'yazhini@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Yazhini"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'yazhini@farmersfactory.in'),
      'email', 'yazhini@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'yazhini@farmersfactory.in', 'Yazhini', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 7. AMIRTHALINGAM S ─────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'amirthalingam@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Amirthalingam S"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'amirthalingam@farmersfactory.in'),
      'email', 'amirthalingam@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'amirthalingam@farmersfactory.in', 'Amirthalingam S', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── 8. ANUSIYA A ──────────────────────────────────────────
  uid := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'anusiya@farmersfactory.in',
    crypt('FF@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Anusiya A"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  IF FOUND THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'anusiya@farmersfactory.in'),
      'email', 'anusiya@farmersfactory.in', now(), now(), now());

    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'anusiya@farmersfactory.in', 'Anusiya A', 'field_executive', 'Sales', 'sales', true, true, true, 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

END $$;

-- ── Verify: show all created users ──────────────────────────
SELECT name, email, role, department, is_active, account_activated
FROM public.profiles
WHERE department_type = 'sales'
ORDER BY name;
