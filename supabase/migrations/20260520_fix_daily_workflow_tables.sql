-- ============================================================
--  Farmers Factory ERP — Fix All Daily Workflow Tables
--  Migration: 20260520_fix_daily_workflow_tables.sql
--  Run in Supabase Dashboard → SQL Editor
--
--  Creates tables (IF NOT EXISTS) and fixes RLS so every
--  authenticated employee can access their own daily workflow data.
--  Covers: task_assignments, task_comments, sop_assignments,
--          escalations, payslips, company_announcements
-- ============================================================

-- ── 1. TASK ASSIGNMENTS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  assigned_to   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES public.profiles(id),
  due_date      date,
  priority      text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status        text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  progress      integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attachments   text[],
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON public.task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status      ON public.task_assignments(status);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own tasks"          ON public.task_assignments;
DROP POLICY IF EXISTS "Admins view all tasks"         ON public.task_assignments;
DROP POLICY IF EXISTS "Users update own tasks"        ON public.task_assignments;
DROP POLICY IF EXISTS "Admins manage all tasks"       ON public.task_assignments;

-- Any employee can view their own assigned tasks
CREATE POLICY "Users view own tasks"
  ON public.task_assignments FOR SELECT
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

-- Admin/HR/CEO/GM can see all tasks
CREATE POLICY "Admins view all tasks"
  ON public.task_assignments FOR SELECT
  USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director','Director'));

-- Employees can update their own task progress/status
CREATE POLICY "Users update own tasks"
  ON public.task_assignments FOR UPDATE
  USING (assigned_to = auth.uid());

-- Admin/HR/CEO can create, update, delete tasks
CREATE POLICY "Admins manage all tasks"
  ON public.task_assignments FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director','Director'));

-- ── 2. TASK COMMENTS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text,
  voice_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task members view comments"  ON public.task_comments;
DROP POLICY IF EXISTS "Task members add comments"   ON public.task_comments;

CREATE POLICY "Task members view comments"
  ON public.task_comments FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.task_assignments t
        WHERE t.id = task_id
          AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
      ) OR
      get_my_role() IN ('admin','ceo','gm','hr','boi','director','Director')
    )
  );

CREATE POLICY "Task members add comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 3. SOP ASSIGNMENTS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sop_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sop_id          uuid,
  title           text NOT NULL,
  description     text,
  category        text,
  document_url    text,
  status          text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  assigned_by     uuid REFERENCES public.profiles(id),
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sop_assignments_user_id ON public.sop_assignments(user_id);

ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sop assignments"    ON public.sop_assignments;
DROP POLICY IF EXISTS "Users update own sop assignments"  ON public.sop_assignments;
DROP POLICY IF EXISTS "Admins manage sop assignments"     ON public.sop_assignments;

CREATE POLICY "Users view own sop assignments"
  ON public.sop_assignments FOR SELECT
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','boi','director','Director'));

CREATE POLICY "Users update own sop assignments"
  ON public.sop_assignments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage sop assignments"
  ON public.sop_assignments FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director','Director'));

-- ── 4. ESCALATIONS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.escalations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to     uuid REFERENCES public.profiles(id),
  title           text NOT NULL,
  description     text,
  category        text,
  priority        text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status          text DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution      text,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_raised_by  ON public.escalations(raised_by);
CREATE INDEX IF NOT EXISTS idx_escalations_assigned_to ON public.escalations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalations_status      ON public.escalations(status);

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own escalations"     ON public.escalations;
DROP POLICY IF EXISTS "Users create escalations"       ON public.escalations;
DROP POLICY IF EXISTS "Admins manage all escalations"  ON public.escalations;

-- Any employee can view escalations they raised or are assigned to
CREATE POLICY "Users view own escalations"
  ON public.escalations FOR SELECT
  USING (raised_by = auth.uid() OR assigned_to = auth.uid() OR
         get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director','Director'));

-- Any employee can raise an escalation
CREATE POLICY "Users create escalations"
  ON public.escalations FOR INSERT
  WITH CHECK (raised_by = auth.uid());

-- Managers can manage all escalations
CREATE POLICY "Admins manage all escalations"
  ON public.escalations FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director','Director'));

-- ── 5. EMPLOYEE PAYSLIPS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_payslips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            integer NOT NULL,
  basic_salary    numeric DEFAULT 0,
  gross_salary    numeric DEFAULT 0,
  net_salary      numeric DEFAULT 0,
  lop_days        numeric DEFAULT 0,
  lop_deduction   numeric DEFAULT 0,
  allowances      jsonb DEFAULT '{}',
  deductions      jsonb DEFAULT '{}',
  status          text DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  paid_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_employee_payslips_employee_id ON public.employee_payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payslips_year_month  ON public.employee_payslips(year, month);

ALTER TABLE public.employee_payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees view own payslips"  ON public.employee_payslips;
DROP POLICY IF EXISTS "HR Admin manage payslips"     ON public.employee_payslips;

-- Any employee can view their own payslips
CREATE POLICY "Employees view own payslips"
  ON public.employee_payslips FOR SELECT
  USING (employee_id = auth.uid());

-- HR/Admin/CEO/Accounts can manage all payslips
CREATE POLICY "HR Admin manage payslips"
  ON public.employee_payslips FOR ALL
  USING (get_my_role() IN ('admin','ceo','hr','accounts','auditor','director','Director'));

-- ── 6. FIX EXISTING DAILY WORKFLOW TABLE POLICIES ────────────

-- Re-confirm day_starts, day_plans, hourly_reports, eod_reports
-- allow ANY authenticated user (not just 'employee' role)

DROP POLICY IF EXISTS "Users manage own day starts"    ON public.day_starts;
DROP POLICY IF EXISTS "Users manage own day plans"     ON public.day_plans;
DROP POLICY IF EXISTS "Users manage own hourly reports" ON public.hourly_reports;
DROP POLICY IF EXISTS "Users manage own EOD reports"   ON public.eod_reports;
DROP POLICY IF EXISTS "Users manage own leaves"        ON public.leave_requests;

CREATE POLICY "Users manage own day starts"
  ON public.day_starts FOR ALL
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE POLICY "Users manage own day plans"
  ON public.day_plans FOR ALL
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE POLICY "Users manage own hourly reports"
  ON public.hourly_reports FOR ALL
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE POLICY "Users manage own EOD reports"
  ON public.eod_reports FOR ALL
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE POLICY "Users manage own leaves"
  ON public.leave_requests FOR ALL
  USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── 7. VERIFY ────────────────────────────────────────────────

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'task_assignments','task_comments','sop_assignments',
  'escalations','employee_payslips',
  'day_starts','day_plans','hourly_reports','eod_reports','leave_requests'
)
ORDER BY tablename, cmd;
