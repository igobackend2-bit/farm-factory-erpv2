-- ============================================================
--  Farmers Factory ERP — Fix LOP Tables & BDE Role Policies
--  Migration: 20260520_fix_lop_tables_and_bde_policies.sql
--  Run in Supabase Dashboard → SQL Editor
--
--  1. Creates lop_entries table (IF NOT EXISTS) with full schema
--  2. Creates lop_audit_logs table (IF NOT EXISTS)
--  3. Enables RLS + correct SELECT policies on both tables
--  4. Adds 'bde' role to all sales-related RLS policies
-- ============================================================

-- ── 1. CREATE lop_entries TABLE ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.lop_entries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lop_type                  text NOT NULL CHECK (lop_type IN ('1_day','0.5_day','0.25_day','0.1_day')),
  reason                    text,
  auto_reason               text,
  evidence_url              text,
  lop_date                  date NOT NULL,
  created_by                uuid REFERENCES public.profiles(id),
  status                    text NOT NULL DEFAULT 'pending_admin'
                              CHECK (status IN ('pending_admin','pending_ceo','approved','rejected')),
  source                    text DEFAULT 'manual',
  admin_verified_at         timestamptz,
  admin_verified_by         uuid REFERENCES public.profiles(id),
  ceo_approved_at           timestamptz,
  ceo_approved_by           uuid REFERENCES public.profiles(id),
  rejection_reason          text,
  reversal_requested        boolean DEFAULT false,
  reversal_reason           text,
  reversal_proof_url        text,
  reversal_status           text,
  reversal_requested_at     timestamptz,
  reversal_admin_reviewed_at timestamptz,
  reversal_admin_reviewed_by uuid REFERENCES public.profiles(id),
  reversal_boi_reviewed_by  uuid REFERENCES public.profiles(id),
  reversal_ceo_reviewed_at  timestamptz,
  reversal_ceo_reviewed_by  uuid REFERENCES public.profiles(id),
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lop_entries_employee_id ON public.lop_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_lop_entries_lop_date    ON public.lop_entries(lop_date);
CREATE INDEX IF NOT EXISTS idx_lop_entries_status      ON public.lop_entries(status);

-- ── 2. CREATE lop_audit_logs TABLE ──────────────────────────

CREATE TABLE IF NOT EXISTS public.lop_audit_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lop_date         date NOT NULL,
  lop_days         numeric NOT NULL DEFAULT 0,
  reason           text,
  reversal_reason  text,
  reversed_at      timestamptz DEFAULT now(),
  reversed_by      uuid REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lop_audit_employee_id ON public.lop_audit_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_lop_audit_lop_date    ON public.lop_audit_logs(lop_date);

-- ── 3. ENABLE RLS ────────────────────────────────────────────

ALTER TABLE public.lop_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS POLICIES — lop_entries ───────────────────────────

-- Drop existing policies (idempotent re-run)
DROP POLICY IF EXISTS "Users can view their own LOP entries"   ON public.lop_entries;
DROP POLICY IF EXISTS "HR users can view all LOP entries"      ON public.lop_entries;
DROP POLICY IF EXISTS "HR users can insert LOP entries"        ON public.lop_entries;
DROP POLICY IF EXISTS "HR users can update LOP entries"        ON public.lop_entries;
DROP POLICY IF EXISTS "HR users can delete LOP entries"        ON public.lop_entries;
DROP POLICY IF EXISTS "Employees view own lop entries"         ON public.lop_entries;
DROP POLICY IF EXISTS "HR Admin view all lop entries"          ON public.lop_entries;
DROP POLICY IF EXISTS "HR Admin manage lop entries"            ON public.lop_entries;
DROP POLICY IF EXISTS "Employees update own lop reversal"      ON public.lop_entries;

-- Any authenticated user can view their own LOP entries
CREATE POLICY "Employees view own lop entries"
  ON public.lop_entries FOR SELECT
  USING (employee_id = auth.uid());

-- HR / Admin / CEO / BOI can view ALL lop entries
CREATE POLICY "HR Admin view all lop entries"
  ON public.lop_entries FOR SELECT
  USING (get_my_role() IN ('admin','ceo','hr','gm','boi','auditor','director'));

-- HR / Admin / System can insert
CREATE POLICY "HR Admin manage lop entries"
  ON public.lop_entries FOR ALL
  USING (get_my_role() IN ('admin','ceo','hr','gm','boi','auditor','director'));

-- Employees can UPDATE only their own reversal fields
CREATE POLICY "Employees update own lop reversal"
  ON public.lop_entries FOR UPDATE
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- ── 5. RLS POLICIES — lop_audit_logs ────────────────────────

DROP POLICY IF EXISTS "Employees view own lop audit logs" ON public.lop_audit_logs;
DROP POLICY IF EXISTS "HR Admin view all lop audit logs"  ON public.lop_audit_logs;
DROP POLICY IF EXISTS "HR Admin manage lop audit logs"    ON public.lop_audit_logs;

CREATE POLICY "Employees view own lop audit logs"
  ON public.lop_audit_logs FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "HR Admin view all lop audit logs"
  ON public.lop_audit_logs FOR SELECT
  USING (get_my_role() IN ('admin','ceo','hr','gm','boi','auditor','director'));

CREATE POLICY "HR Admin manage lop audit logs"
  ON public.lop_audit_logs FOR ALL
  USING (get_my_role() IN ('admin','ceo','hr','gm','boi','auditor','director'));

-- ── 6. ADD 'bde' TO SALES RLS POLICIES ──────────────────────

-- customers
DROP POLICY IF EXISTS "Sales team manages customers" ON public.customers;
CREATE POLICY "Sales team manages customers"
  ON public.customers FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','field_executive','bde','tele_caller','back_office','warehouse_manager'));

-- sales_orders
DROP POLICY IF EXISTS "Sales team manages orders" ON public.sales_orders;
CREATE POLICY "Sales team manages orders"
  ON public.sales_orders FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','field_executive','bde','tele_caller','back_office','warehouse_manager'));

-- sales_order_items
DROP POLICY IF EXISTS "Sales team manages order items" ON public.sales_order_items;
CREATE POLICY "Sales team manages order items"
  ON public.sales_order_items FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','field_executive','bde','tele_caller','back_office','warehouse_manager'));

-- crm_leads
DROP POLICY IF EXISTS "Tele callers manage leads" ON public.crm_leads;
CREATE POLICY "Tele callers manage leads"
  ON public.crm_leads FOR ALL
  USING (get_my_role() IN ('admin','ceo','gm','tele_caller','bde','field_executive','back_office') OR assigned_to = auth.uid());

-- ── 7. VERIFY ────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('lop_entries','lop_audit_logs','customers','sales_orders','sales_order_items','crm_leads')
ORDER BY tablename, cmd;
