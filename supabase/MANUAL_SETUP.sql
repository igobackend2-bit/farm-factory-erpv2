-- ================================================================
--  FARMERS FACTORY ERP v2 — COMPLETE MANUAL SETUP
--  Paste this ENTIRE file in:
--  https://supabase.com/dashboard/project/bvbfnguqpuctdvfztuda/sql/new
--  Then click RUN
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── STEP 1: profiles table (no policies yet — get_my_role doesn't exist yet) ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     text NOT NULL,
  name                      text NOT NULL DEFAULT 'New User',
  role                      text NOT NULL DEFAULT 'employee',
  department                text NOT NULL DEFAULT 'General',
  department_type           text,
  office_number             text,
  destination               text,
  is_active                 boolean NOT NULL DEFAULT true,
  login_enabled             boolean NOT NULL DEFAULT true,
  account_activated         boolean DEFAULT false,
  onboarding_completed      boolean DEFAULT false,
  onboarding_status         text DEFAULT 'pending',
  login_credential_password text,
  password                  text,
  username                  text,
  status                    text DEFAULT 'active',
  verified_at               timestamptz,
  verified_by               text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── STEP 2: helper functions (profiles now exists) ───────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── STEP 3: profiles RLS policies (get_my_role now exists) ───
CREATE POLICY "view_own"       ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "managers_view"  ON public.profiles FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "update_own"     ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "insert_profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete"   ON public.profiles FOR DELETE USING (get_my_role() IN ('admin','ceo'));

-- ── DAILY WORKFLOW ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.day_starts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(),
  location text, notes text, UNIQUE(user_id, date)
);
ALTER TABLE public.day_starts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_starts_all" ON public.day_starts FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE IF NOT EXISTS public.day_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL, tasks text[] NOT NULL DEFAULT '{}',
  expected_output text NOT NULL DEFAULT '', submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_plans_all" ON public.day_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE IF NOT EXISTS public.hourly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL, slot integer NOT NULL, work_done text NOT NULL,
  is_late boolean DEFAULT false, submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, slot)
);
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hourly_all" ON public.hourly_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE IF NOT EXISTS public.eod_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL, summary text NOT NULL, tomorrow_plan text, mood text,
  submitted_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, date)
);
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eod_all" ON public.eod_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── LEAVE REQUESTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type text NOT NULL, from_date date NOT NULL, to_date date NOT NULL,
  reason text NOT NULL, status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id), approved_at timestamptz,
  rejection_reason text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_all" ON public.leave_requests FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text NOT NULL, target_roles text[] DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id), is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_view"   ON public.announcements FOR SELECT USING (true);
CREATE POLICY "ann_manage" ON public.announcements FOR ALL USING (get_my_role() IN ('admin','ceo','gm'));

-- ── PRODUCT CATALOG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, category text NOT NULL, unit text NOT NULL DEFAULT 'kg',
  description text,
  grade_a_price numeric(10,2) DEFAULT 0, grade_b_price numeric(10,2) DEFAULT 0, grade_c_price numeric(10,2) DEFAULT 0,
  grade_a_discount numeric(5,2) DEFAULT 0, grade_b_discount numeric(5,2) DEFAULT 0, grade_c_discount numeric(5,2) DEFAULT 0,
  is_active boolean DEFAULT true, image_url text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_view"   ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_manage" ON public.products FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── VENDORS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, contact_person text, phone text, email text,
  address text, city text, state text, gst_number text,
  bank_name text, bank_account text, bank_ifsc text,
  product_categories text[] DEFAULT '{}', rating numeric(3,1) DEFAULT 0,
  is_active boolean DEFAULT true, notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_view"   ON public.vendors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vendors_manage" ON public.vendors FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── PURCHASE ORDERS ───────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE, vendor_id uuid REFERENCES public.vendors(id),
  status text NOT NULL DEFAULT 'draft', order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date, total_amount numeric(12,2) DEFAULT 0, notes text,
  created_by uuid REFERENCES public.profiles(id), approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id), product_name text NOT NULL,
  quantity numeric(10,2) NOT NULL, unit text NOT NULL, unit_price numeric(10,2) NOT NULL,
  total_price numeric(12,2) DEFAULT 0, grade text DEFAULT 'A', notes text
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_view"    ON public.purchase_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "po_manage"  ON public.purchase_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));
CREATE POLICY "poi_view"   ON public.purchase_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "poi_manage" ON public.purchase_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── MARKET RATES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id), product_name text NOT NULL,
  market text NOT NULL, rate numeric(10,2) NOT NULL, grade text DEFAULT 'A',
  date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid REFERENCES public.profiles(id), created_at timestamptz DEFAULT now()
);
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_view"   ON public.market_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "rates_manage" ON public.market_rates FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── INVENTORY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id), product_name text NOT NULL,
  grade text NOT NULL DEFAULT 'A', quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg', batch_number text,
  received_date date DEFAULT CURRENT_DATE, expiry_date date,
  location text DEFAULT 'Main Warehouse', status text DEFAULT 'available',
  notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_view"   ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inv_manage" ON public.inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

CREATE TABLE IF NOT EXISTS public.qc_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES public.inventory(id), product_name text NOT NULL,
  batch_number text, inspected_by uuid REFERENCES public.profiles(id),
  inspection_date date DEFAULT CURRENT_DATE, grade_assigned text,
  quantity_passed numeric(12,2) DEFAULT 0, quantity_rejected numeric(12,2) DEFAULT 0,
  rejection_reason text, status text DEFAULT 'passed', notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qc_view"   ON public.qc_inspections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "qc_manage" ON public.qc_inspections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

-- ── CUSTOMERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text, email text, address text, city text,
  customer_type text DEFAULT 'retail', credit_limit numeric(12,2) DEFAULT 0,
  outstanding numeric(12,2) DEFAULT 0, is_active boolean DEFAULT true,
  assigned_to uuid REFERENCES public.profiles(id), notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_view"   ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "cust_manage" ON public.customers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));

-- ── SALES ORDERS ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS so_seq START 1;
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE, customer_id uuid REFERENCES public.customers(id),
  customer_name text NOT NULL, order_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date, status text NOT NULL DEFAULT 'pending',
  payment_mode text DEFAULT 'cod', payment_status text DEFAULT 'unpaid',
  subtotal numeric(12,2) DEFAULT 0, discount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0, amount_paid numeric(12,2) DEFAULT 0,
  delivery_address text, notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id), product_name text NOT NULL,
  grade text DEFAULT 'A', quantity numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'kg', unit_price numeric(10,2) NOT NULL,
  discount_pct numeric(5,2) DEFAULT 0, total_price numeric(12,2) DEFAULT 0
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_view"    ON public.sales_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "so_manage"  ON public.sales_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));
CREATE POLICY "soi_view"   ON public.sales_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "soi_manage" ON public.sales_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));

-- ── LOGISTICS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number text UNIQUE, driver_id uuid REFERENCES public.profiles(id),
  vehicle_number text, trip_date date DEFAULT CURRENT_DATE,
  origin text, destination text, status text DEFAULT 'scheduled',
  orders uuid[] DEFAULT '{}', start_time timestamptz, end_time timestamptz,
  distance_km numeric(8,2), fuel_cost numeric(10,2), notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.logistics_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_view"   ON public.logistics_trips FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trips_manage" ON public.logistics_trips FOR ALL USING (get_my_role() IN ('admin','ceo','gm','driver','warehouse_manager','back_office'));

-- ── VENDOR PAYMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id), po_id uuid REFERENCES public.purchase_orders(id),
  amount numeric(12,2) NOT NULL, payment_date date DEFAULT CURRENT_DATE,
  payment_mode text DEFAULT 'bank_transfer', utr_number text,
  status text DEFAULT 'pending', notes text,
  created_by uuid REFERENCES public.profiles(id), created_at timestamptz DEFAULT now()
);
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vp_manage" ON public.vendor_payments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','purchase_manager','purchase_head','back_office'));

-- ── CRM LEADS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text NOT NULL, email text, business_type text, city text,
  interest_level text DEFAULT 'warm', status text DEFAULT 'new',
  assigned_to uuid REFERENCES public.profiles(id),
  last_contacted date, next_followup date, notes text,
  converted_to_customer boolean DEFAULT false, customer_id uuid REFERENCES public.customers(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_manage" ON public.crm_leads FOR ALL USING (get_my_role() IN ('admin','ceo','gm','tele_caller','field_executive','back_office') OR assigned_to = auth.uid());

-- ── PAYMENT REQUESTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id),
  purpose text NOT NULL, vendor_name text NOT NULL, vendor_bank_details text,
  amount numeric(15,2) NOT NULL, bill_url text, work_proof_url text,
  urgency text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'pending',
  admin_approved_by uuid REFERENCES public.profiles(id), admin_approved_at timestamptz,
  admin_rejection_reason text,
  ceo_approved_by uuid REFERENCES public.profiles(id), ceo_approved_at timestamptz,
  utr_number text, payment_proof_url text, paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_view"   ON public.payment_requests FOR SELECT USING (requester_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts'));
CREATE POLICY "pr_insert" ON public.payment_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "pr_update" ON public.payment_requests FOR UPDATE USING (get_my_role() IN ('admin','ceo','accounts'));

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, performed_by uuid REFERENCES public.profiles(id),
  performed_by_name text, performed_by_role text,
  record_type text, record_id text,
  before_state jsonb, after_state jsonb, remarks text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_view"   ON public.audit_logs FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr'));
CREATE POLICY "al_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL, type text DEFAULT 'info',
  is_read boolean DEFAULT false, link text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own"    ON public.notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (true);


-- ================================================================
--  SEED USERS
--  ┌───────┬────────────────────────────────┬───────────────┐
--  │ Role  │ Email                          │ Password      │
--  ├───────┼────────────────────────────────┼───────────────┤
--  │ admin │ admin@farmersfactory.com        │ Admin@FF2025! │
--  │ ceo   │ ceo@farmersfactory.com          │ Ceo@FF2025!   │
--  │ gm    │ gm@farmersfactory.com           │ Gm@FF2025!    │
--  └───────┴────────────────────────────────┴───────────────┘
-- ================================================================
DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_ceo_id   uuid := gen_random_uuid();
  v_gm_id    uuid := gen_random_uuid();
  v_inst     uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@farmersfactory.com') THEN
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,role,aud,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES (v_admin_id,v_inst,'admin@farmersfactory.com',crypt('Admin@FF2025!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',false,'authenticated','authenticated','','','','');
    INSERT INTO public.profiles (id,email,name,role,department,office_number,is_active,login_enabled,account_activated,onboarding_completed,status)
    VALUES (v_admin_id,'admin@farmersfactory.com','FF Admin','admin','Administration','FF-ADMIN-001',true,true,true,true,'active');
    RAISE NOTICE 'Admin created';
  ELSE RAISE NOTICE 'Admin exists — skipped'; END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ceo@farmersfactory.com') THEN
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,role,aud,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES (v_ceo_id,v_inst,'ceo@farmersfactory.com',crypt('Ceo@FF2025!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',false,'authenticated','authenticated','','','','');
    INSERT INTO public.profiles (id,email,name,role,department,office_number,is_active,login_enabled,account_activated,onboarding_completed,status)
    VALUES (v_ceo_id,'ceo@farmersfactory.com','FF CEO','ceo','Executive','FF-CEO-001',true,true,true,true,'active');
    RAISE NOTICE 'CEO created';
  ELSE RAISE NOTICE 'CEO exists — skipped'; END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gm@farmersfactory.com') THEN
    INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,role,aud,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES (v_gm_id,v_inst,'gm@farmersfactory.com',crypt('Gm@FF2025!',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',false,'authenticated','authenticated','','','','');
    INSERT INTO public.profiles (id,email,name,role,department,office_number,is_active,login_enabled,account_activated,onboarding_completed,status)
    VALUES (v_gm_id,'gm@farmersfactory.com','FF General Manager','gm','Operations','FF-GM-001',true,true,true,true,'active');
    RAISE NOTICE 'GM created';
  ELSE RAISE NOTICE 'GM exists — skipped'; END IF;
END $$;

-- VERIFY
SELECT p.office_number AS "ID", p.name AS "Name", p.role AS "Role", u.email AS "Email"
FROM public.profiles p JOIN auth.users u ON u.id = p.id
WHERE u.email IN ('admin@farmersfactory.com','ceo@farmersfactory.com','gm@farmersfactory.com');
