-- ============================================================
--  Farmers Factory ERP — Shift Test Users (Per Hub)
--  Migration: 20260522_create_shift_test_users.sql
--  Run in Supabase Dashboard → SQL Editor
--
--  Creates 6 shift_employee test users (2 per hub):
--
--  PALIKARANI HUB:
--    shift.palikarani1@farmersfactory.in  → Shift@Pali1
--    shift.palikarani2@farmersfactory.in  → Shift@Pali2
--
--  VANAGARAM HUB:
--    shift.vanagaram1@farmersfactory.in   → Shift@Vana1
--    shift.vanagaram2@farmersfactory.in   → Shift@Vana2
--
--  HYDERABAD HUB:
--    shift.hyderabad1@farmersfactory.in   → Shift@Hyd1
--    shift.hyderabad2@farmersfactory.in   → Shift@Hyd2
--
--  Each user is:
--  - Created in auth.users + auth.identities
--  - Added to public.profiles with role = 'shift_employee'
--  - Assigned in shift_user_assignments (target_hours=8, max_hours=10)
-- ============================================================

DO $$
DECLARE
  uid uuid;
  admin_uid uuid;
BEGIN

  -- Get any admin user to use as 'assigned_by'
  SELECT id INTO admin_uid FROM auth.users
    JOIN public.profiles ON profiles.id = auth.users.id
    WHERE profiles.role = 'admin' LIMIT 1;

  -- Fallback if no admin found
  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
  END IF;

  -- ── PALIKARANI HUB — User 1 ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.palikarani1@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.palikarani1@farmersfactory.in',
      crypt('Shift@Pali1', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Palikarani Shift 1"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.palikarani1@farmersfactory.in'),
      'email', 'shift.palikarani1@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.palikarani1@farmersfactory.in', 'Palikarani Shift 1', 'shift_employee', 'Palikarani', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.palikarani1@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.palikarani1@farmersfactory.in';
  END IF;

  -- ── PALIKARANI HUB — User 2 ──────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.palikarani2@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.palikarani2@farmersfactory.in',
      crypt('Shift@Pali2', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Palikarani Shift 2"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.palikarani2@farmersfactory.in'),
      'email', 'shift.palikarani2@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.palikarani2@farmersfactory.in', 'Palikarani Shift 2', 'shift_employee', 'Palikarani', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.palikarani2@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.palikarani2@farmersfactory.in';
  END IF;

  -- ── VANAGARAM HUB — User 1 ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.vanagaram1@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.vanagaram1@farmersfactory.in',
      crypt('Shift@Vana1', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Vanagaram Shift 1"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.vanagaram1@farmersfactory.in'),
      'email', 'shift.vanagaram1@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.vanagaram1@farmersfactory.in', 'Vanagaram Shift 1', 'shift_employee', 'Vanagaram', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.vanagaram1@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.vanagaram1@farmersfactory.in';
  END IF;

  -- ── VANAGARAM HUB — User 2 ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.vanagaram2@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.vanagaram2@farmersfactory.in',
      crypt('Shift@Vana2', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Vanagaram Shift 2"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.vanagaram2@farmersfactory.in'),
      'email', 'shift.vanagaram2@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.vanagaram2@farmersfactory.in', 'Vanagaram Shift 2', 'shift_employee', 'Vanagaram', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.vanagaram2@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.vanagaram2@farmersfactory.in';
  END IF;

  -- ── HYDERABAD HUB — User 1 ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.hyderabad1@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.hyderabad1@farmersfactory.in',
      crypt('Shift@Hyd1', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Hyderabad Shift 1"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.hyderabad1@farmersfactory.in'),
      'email', 'shift.hyderabad1@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.hyderabad1@farmersfactory.in', 'Hyderabad Shift 1', 'shift_employee', 'Hyderabad', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.hyderabad1@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.hyderabad1@farmersfactory.in';
  END IF;

  -- ── HYDERABAD HUB — User 2 ───────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'shift.hyderabad2@farmersfactory.in') THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000',
      'shift.hyderabad2@farmersfactory.in',
      crypt('Shift@Hyd2', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"name":"Hyderabad Shift 2"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', 'shift.hyderabad2@farmersfactory.in'),
      'email', 'shift.hyderabad2@farmersfactory.in', now(), now(), now());
    INSERT INTO public.profiles (id, email, name, role, department, department_type, is_active, login_enabled, account_activated, status)
    VALUES (uid, 'shift.hyderabad2@farmersfactory.in', 'Hyderabad Shift 2', 'shift_employee', 'Hyderabad', 'operations', true, true, true, 'active');
    INSERT INTO public.shift_user_assignments (user_id, target_hours, max_hours, is_active, assigned_by, assigned_at)
    VALUES (uid, 8, 10, true, admin_uid, now());
    RAISE NOTICE 'Created: shift.hyderabad2@farmersfactory.in';
  ELSE
    RAISE NOTICE 'Already exists: shift.hyderabad2@farmersfactory.in';
  END IF;

END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT
  p.name,
  p.email,
  p.department AS hub,
  p.role,
  s.target_hours,
  s.max_hours,
  s.is_active AS shift_active
FROM public.profiles p
LEFT JOIN public.shift_user_assignments s ON s.user_id = p.id AND s.is_active = true
WHERE p.role = 'shift_employee'
ORDER BY p.department, p.name;
