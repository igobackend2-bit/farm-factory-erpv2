-- ============================================================
--  Farmers Factory ERP — Standard Credential Seed
--  Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================
--
--  Credentials created:
--  ┌──────────────────────────┬───────────────────────────────────┬──────────────────────┐
--  │ Role                     │ Email                             │ Password             │
--  ├──────────────────────────┼───────────────────────────────────┼──────────────────────┤
--  │ admin                    │ admin@farmersfactory.com           │ Admin@FF2025!        │
--  │ ceo                      │ ceo@farmersfactory.com             │ Ceo@FF2025!          │
--  │ gm                       │ gm@farmersfactory.com              │ Gm@FF2025!           │
--  │ ff_operations_manager    │ ffops@farmersfactory.com           │ FFOps@2026           │
--  │ hr                       │ hr@farmersfactory.com              │ HR@2026              │
--  └──────────────────────────┴───────────────────────────────────┴──────────────────────┘
--
--  Change passwords after first login via Supabase Dashboard → Auth → Users
-- ============================================================

DO $$
DECLARE
  v_admin_id  uuid := gen_random_uuid();
  v_ceo_id    uuid := gen_random_uuid();
  v_gm_id     uuid := gen_random_uuid();
  v_ffops_id  uuid := gen_random_uuid();
  v_hr_id     uuid := gen_random_uuid();
  v_instance  uuid := '00000000-0000-0000-0000-000000000000';
BEGIN

  -- ── ADMIN ────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@farmersfactory.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_admin_id, v_instance,
      'admin@farmersfactory.com',
      crypt('Admin@FF2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"FF Admin"}',
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, email, role, office_number, department)
    VALUES (
      v_admin_id,
      'FF Admin',
      'admin@farmersfactory.com',
      'admin',
      'FF-ADMIN-001',
      'Administration'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Admin user created: admin@farmersfactory.com';
  ELSE
    RAISE NOTICE 'Admin user already exists — skipped.';
  END IF;

  -- ── CEO ──────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ceo@farmersfactory.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_ceo_id, v_instance,
      'ceo@farmersfactory.com',
      crypt('Ceo@FF2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"FF CEO"}',
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, email, role, office_number, department)
    VALUES (
      v_ceo_id,
      'FF CEO',
      'ceo@farmersfactory.com',
      'ceo',
      'FF-CEO-001',
      'Executive'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'CEO user created: ceo@farmersfactory.com';
  ELSE
    RAISE NOTICE 'CEO user already exists — skipped.';
  END IF;

  -- ── GM ───────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gm@farmersfactory.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_gm_id, v_instance,
      'gm@farmersfactory.com',
      crypt('Gm@FF2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"FF GM"}',
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, email, role, office_number, department)
    VALUES (
      v_gm_id,
      'FF General Manager',
      'gm@farmersfactory.com',
      'gm',
      'FF-GM-001',
      'Operations'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'GM user created: gm@farmersfactory.com';
  ELSE
    RAISE NOTICE 'GM user already exists — skipped.';
  END IF;

  -- ── FF OPERATIONS MANAGER ────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ffops@farmersfactory.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_ffops_id, v_instance,
      'ffops@farmersfactory.com',
      crypt('FFOps@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"FF Operations Manager"}',
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, email, role, office_number, department)
    VALUES (
      v_ffops_id,
      'FF Operations Manager',
      'ffops@farmersfactory.com',
      'ff_operations_manager',
      'FFOPS-001',
      'Operations'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'FF Operations Manager created: ffops@farmersfactory.com';
  ELSE
    RAISE NOTICE 'FF Operations Manager already exists — skipped.';
  END IF;

  -- ── HR MANAGER ───────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'hr@farmersfactory.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_hr_id, v_instance,
      'hr@farmersfactory.com',
      crypt('HR@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"HR Manager"}',
      false, 'authenticated', 'authenticated',
      '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, email, role, office_number, department)
    VALUES (
      v_hr_id,
      'HR Manager',
      'hr@farmersfactory.com',
      'hr',
      'HR-001',
      'Human Resources'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'HR Manager created: hr@farmersfactory.com';
  ELSE
    RAISE NOTICE 'HR Manager already exists — skipped.';
  END IF;

END $$;
