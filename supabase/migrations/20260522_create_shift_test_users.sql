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

-- ── Create shift_user_assignments table if not exists ────────
CREATE TABLE IF NOT EXISTS public.shift_user_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_hours numeric NOT NULL DEFAULT 8,
  max_hours    numeric NOT NULL DEFAULT 10,
  is_active    boolean NOT NULL DEFAULT true,
  assigned_by  uuid REFERENCES public.profiles(id),
  assigned_at  timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_user_assignments_user_id ON public.shift_user_assignments(user_id);

ALTER TABLE public.shift_user_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage shift assignments" ON public.shift_user_assignments;
DROP POLICY IF EXISTS "Users view own shift assignment"  ON public.shift_user_assignments;

CREATE POLICY "Admins manage shift assignments"
  ON public.shift_user_assignments FOR ALL
  USING (get_my_role() IN ('admin','ceo','hr','gm'));

CREATE POLICY "Users view own shift assignment"
  ON public.shift_user_assignments FOR SELECT
  USING (user_id = auth.uid());

-- ── Create shift_sessions table if not exists ────────────────
CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  login_time   timestamptz,
  logout_time  timestamptz,
  total_hours  numeric DEFAULT 0,
  status       text DEFAULT 'active',
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_user_id ON public.shift_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_date    ON public.shift_sessions(date);

ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shift sessions"  ON public.shift_sessions;
DROP POLICY IF EXISTS "Admins view all shift sessions"   ON public.shift_sessions;

CREATE POLICY "Users manage own shift sessions"
  ON public.shift_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all shift sessions"
  ON public.shift_sessions FOR SELECT
  USING (get_my_role() IN ('admin','ceo','hr','gm'));

-- ── Create shift_hourly_slots table if not exists ────────────
CREATE TABLE IF NOT EXISTS public.shift_hourly_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  slot_hour   integer NOT NULL,
  task        text,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.shift_hourly_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own hourly slots" ON public.shift_hourly_slots;
DROP POLICY IF EXISTS "Admins view all hourly slots"  ON public.shift_hourly_slots;

CREATE POLICY "Users manage own hourly slots"
  ON public.shift_hourly_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shift_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all hourly slots"
  ON public.shift_hourly_slots FOR SELECT
  USING (get_my_role() IN ('admin','ceo','hr','gm'));

-- ── Create shift_eod_reports table if not exists ─────────────
CREATE TABLE IF NOT EXISTS public.shift_eod_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  summary     text,
  highlights  text,
  challenges  text,
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE public.shift_eod_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own eod reports" ON public.shift_eod_reports;
DROP POLICY IF EXISTS "Admins view all eod reports"  ON public.shift_eod_reports;

CREATE POLICY "Users manage own eod reports"
  ON public.shift_eod_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shift_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all eod reports"
  ON public.shift_eod_reports FOR SELECT
  USING (get_my_role() IN ('admin','ceo','hr','gm'));

-- ── Create shift_assignment_history table if not exists ───────
CREATE TABLE IF NOT EXISTS public.shift_assignment_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      text NOT NULL,
  changed_by  uuid REFERENCES public.profiles(id),
  changed_at  timestamptz DEFAULT now(),
  notes       text
);

ALTER TABLE public.shift_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage shift history" ON public.shift_assignment_history;

CREATE POLICY "Admins manage shift history"
  ON public.shift_assignment_history FOR ALL
  USING (get_my_role() IN ('admin','ceo','hr','gm'));

-- ── Now create the test users ─────────────────────────────────

DO $$
DECLARE
  uid uuid;
  admin_uid uuid;
BEGIN

  -- Get any admin user to use as 'assigned_by'
  SELECT profiles.id INTO admin_uid
    FROM public.profiles
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
