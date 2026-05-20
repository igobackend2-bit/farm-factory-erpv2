-- ============================================================
--  Farmers Factory ERP — Sales Team (BDE) User Creation
--  Migration: 20260520_create_sales_team_users.sql
--  Run in Supabase Dashboard → SQL Editor
--
--  Creates 7 Business Development Executives (role: bde)
--  with access to the Sales module only.
--
--  Passwords (name-based):
--  Priyanka        → Priya@2026
--  Indhurekha      → Indhu@2026
--  Arun            → Arun@2026
--  Akash           → Akash@2026
--  Parasa Jagadeesh→ Parasa@2026
--  Yazhini         → Yazhi@2026
--  Anusiya A       → Anusi@2026
-- ============================================================

DO $$
DECLARE
  uid uuid;
BEGIN

  -- ── 1. PRIYANKA  (password: Priya@2026) ───────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'priyanka@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'priyanka@farmersfactory.in',
      crypt('Priya@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Priyanka"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'priyanka@farmersfactory.in'),
      'email', 'priyanka@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'priyanka@farmersfactory.in', 'Priyanka', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: priyanka@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: priyanka@farmersfactory.in';
  END IF;

  -- ── 2. INDHUREKHA  (password: Indhu@2026) ─────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'indhurekha@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'indhurekha@farmersfactory.in',
      crypt('Indhu@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Indhurekha"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'indhurekha@farmersfactory.in'),
      'email', 'indhurekha@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'indhurekha@farmersfactory.in', 'Indhurekha', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: indhurekha@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: indhurekha@farmersfactory.in';
  END IF;

  -- ── 3. ARUN  (password: Arun@2026) ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arun@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'arun@farmersfactory.in',
      crypt('Arun@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Arun"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'arun@farmersfactory.in'),
      'email', 'arun@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'arun@farmersfactory.in', 'Arun', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: arun@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: arun@farmersfactory.in';
  END IF;

  -- ── 4. AKASH  (password: Akash@2026) ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'akash@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'akash@farmersfactory.in',
      crypt('Akash@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Akash"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'akash@farmersfactory.in'),
      'email', 'akash@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'akash@farmersfactory.in', 'Akash', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: akash@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: akash@farmersfactory.in';
  END IF;

  -- ── 5. PARASA JAGADEESH  (password: Parasa@2026) ──────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'parasajagadeesh@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'parasajagadeesh@farmersfactory.in',
      crypt('Parasa@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Parasa Jagadeesh"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'parasajagadeesh@farmersfactory.in'),
      'email', 'parasajagadeesh@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'parasajagadeesh@farmersfactory.in', 'Parasa Jagadeesh', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: parasajagadeesh@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: parasajagadeesh@farmersfactory.in';
  END IF;

  -- ── 6. YAZHINI  (password: Yazhi@2026) ───────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'yazhini@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'yazhini@farmersfactory.in',
      crypt('Yazhi@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Yazhini"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'yazhini@farmersfactory.in'),
      'email', 'yazhini@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'yazhini@farmersfactory.in', 'Yazhini', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: yazhini@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: yazhini@farmersfactory.in';
  END IF;

  -- ── 7. ANUSIYA A  (password: Anusi@2026) ─────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'anusiya@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'anusiya@farmersfactory.in',
      crypt('Anusi@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Anusiya A"}',
      'authenticated', 'authenticated',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'anusiya@farmersfactory.in'),
      'email', 'anusiya@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'anusiya@farmersfactory.in', 'Anusiya A', 'bde', 'Sales', 'sales', true, true, true, 'active');
    RAISE NOTICE 'Created: anusiya@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: anusiya@farmersfactory.in';
  END IF;

END $$;

-- ── Verify: show all created BDE users ──────────────────────
SELECT name, email, role, is_active, account_activated
FROM public.profiles
WHERE role = 'bde'
ORDER BY name;
