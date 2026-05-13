-- ================================================================
--  FARMERS FACTORY ERP v2 — FRESH DATABASE SCHEMA
--  Single clean migration for brand new Supabase project
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────────────────────────
-- PROFILES (core user table)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
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

CREATE POLICY "Users can view own profile"         ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Managers can view all profiles"     ON public.profiles FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Users can update own profile"       ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can insert profiles"         ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete profiles"         ON public.profiles FOR DELETE USING (get_my_role() IN ('admin','ceo'));


-- ──────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- ──────────────────────────────────────────────────────────────
-- DAILY WORKFLOW TABLES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.day_starts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  location     text,
  notes        text,
  UNIQUE(user_id, date)
);
ALTER TABLE public.day_starts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own day starts" ON public.day_starts FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE public.day_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  tasks           text[] NOT NULL DEFAULT '{}',
  expected_output text NOT NULL DEFAULT '',
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own day plans" ON public.day_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE public.hourly_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  slot         integer NOT NULL,
  work_done    text NOT NULL,
  is_late      boolean DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, slot)
);
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hourly reports" ON public.hourly_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

CREATE TABLE public.eod_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  summary         text NOT NULL,
  tomorrow_plan   text,
  mood            text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own EOD reports" ON public.eod_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));


-- ──────────────────────────────────────────────────────────────
-- LEAVE & ATTENDANCE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type      text NOT NULL,
  from_date       date NOT NULL,
  to_date         date NOT NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  approved_by     uuid REFERENCES public.profiles(id),
  approved_at     timestamptz,
  rejection_reason text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leaves" ON public.leave_requests FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  target_roles text[] DEFAULT '{}',
  created_by  uuid REFERENCES public.profiles(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (get_my_role() IN ('admin','ceo','gm'));


-- ──────────────────────────────────────────────────────────────
-- PRODUCT CATALOG
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  unit            text NOT NULL DEFAULT 'kg',
  description     text,
  grade_a_price   numeric(10,2) DEFAULT 0,
  grade_b_price   numeric(10,2) DEFAULT 0,
  grade_c_price   numeric(10,2) DEFAULT 0,
  grade_a_discount numeric(5,2) DEFAULT 0,
  grade_b_discount numeric(5,2) DEFAULT 0,
  grade_c_discount numeric(5,2) DEFAULT 0,
  is_active       boolean DEFAULT true,
  image_url       text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff can view products" ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase managers manage products" ON public.products FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- VENDORS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  gst_number      text,
  bank_name       text,
  bank_account    text,
  bank_ifsc       text,
  product_categories text[] DEFAULT '{}',
  rating          numeric(3,1) DEFAULT 0,
  is_active       boolean DEFAULT true,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view vendors" ON public.vendors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase team manages vendors" ON public.vendors FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- PURCHASE ORDERS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       text UNIQUE NOT NULL,
  vendor_id       uuid REFERENCES public.vendors(id),
  status          text NOT NULL DEFAULT 'draft',
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  expected_date   date,
  total_amount    numeric(12,2) DEFAULT 0,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  approved_by     uuid REFERENCES public.profiles(id),
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES public.products(id),
  product_name    text NOT NULL,
  quantity        numeric(10,2) NOT NULL,
  unit            text NOT NULL,
  unit_price      numeric(10,2) NOT NULL,
  total_price     numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  grade           text DEFAULT 'A',
  notes           text
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view POs" ON public.purchase_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase team manages POs" ON public.purchase_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));
CREATE POLICY "Staff view PO items" ON public.purchase_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase team manages PO items" ON public.purchase_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(CAST(nextval('po_seq') AS text), 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE TRIGGER set_po_number BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();


-- ──────────────────────────────────────────────────────────────
-- MARKET RATES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.market_rates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  market      text NOT NULL,
  rate        numeric(10,2) NOT NULL,
  grade       text DEFAULT 'A',
  date        date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view market rates" ON public.market_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Purchase team manages rates" ON public.market_rates FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));


-- ──────────────────────────────────────────────────────────────
-- WAREHOUSE & INVENTORY
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid REFERENCES public.products(id),
  product_name    text NOT NULL,
  grade           text NOT NULL DEFAULT 'A',
  quantity        numeric(12,2) NOT NULL DEFAULT 0,
  unit            text NOT NULL DEFAULT 'kg',
  batch_number    text,
  received_date   date DEFAULT CURRENT_DATE,
  expiry_date     date,
  location        text DEFAULT 'Main Warehouse',
  status          text DEFAULT 'available',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view inventory" ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Warehouse team manages inventory" ON public.inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.qc_inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid REFERENCES public.inventory(id),
  product_name    text NOT NULL,
  batch_number    text,
  inspected_by    uuid REFERENCES public.profiles(id),
  inspection_date date DEFAULT CURRENT_DATE,
  grade_assigned  text,
  quantity_passed numeric(12,2) DEFAULT 0,
  quantity_rejected numeric(12,2) DEFAULT 0,
  rejection_reason text,
  status          text DEFAULT 'passed',
  notes           text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view QC" ON public.qc_inspections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "QC team manages inspections" ON public.qc_inspections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));


-- ──────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  phone           text,
  email           text,
  address         text,
  city            text,
  customer_type   text DEFAULT 'retail',
  credit_limit    numeric(12,2) DEFAULT 0,
  outstanding     numeric(12,2) DEFAULT 0,
  is_active       boolean DEFAULT true,
  assigned_to     uuid REFERENCES public.profiles(id),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales team views customers" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales team manages customers" ON public.customers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SALES ORDERS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.sales_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text UNIQUE,
  customer_id     uuid REFERENCES public.customers(id),
  customer_name   text NOT NULL,
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   date,
  status          text NOT NULL DEFAULT 'pending',
  payment_mode    text DEFAULT 'cod',
  payment_status  text DEFAULT 'unpaid',
  subtotal        numeric(12,2) DEFAULT 0,
  discount        numeric(12,2) DEFAULT 0,
  total_amount    numeric(12,2) DEFAULT 0,
  amount_paid     numeric(12,2) DEFAULT 0,
  delivery_address text,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.sales_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES public.products(id),
  product_name    text NOT NULL,
  grade           text DEFAULT 'A',
  quantity        numeric(10,2) NOT NULL,
  unit            text NOT NULL DEFAULT 'kg',
  unit_price      numeric(10,2) NOT NULL,
  discount_pct    numeric(5,2) DEFAULT 0,
  total_price     numeric(12,2) DEFAULT 0
);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view orders" ON public.sales_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales team manages orders" ON public.sales_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));
CREATE POLICY "Staff view order items" ON public.sales_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales team manages order items" ON public.sales_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager'));

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'SO-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(CAST(nextval('so_seq') AS text), 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE SEQUENCE IF NOT EXISTS so_seq START 1;
CREATE TRIGGER set_order_number BEFORE INSERT ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();
CREATE TRIGGER sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- LOGISTICS / TRIPS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.logistics_trips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number     text UNIQUE,
  driver_id       uuid REFERENCES public.profiles(id),
  vehicle_number  text,
  trip_date       date DEFAULT CURRENT_DATE,
  origin          text,
  destination     text,
  status          text DEFAULT 'scheduled',
  orders          uuid[] DEFAULT '{}',
  start_time      timestamptz,
  end_time        timestamptz,
  distance_km     numeric(8,2),
  fuel_cost       numeric(10,2),
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.logistics_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view trips" ON public.logistics_trips FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Logistics team manages trips" ON public.logistics_trips FOR ALL USING (get_my_role() IN ('admin','ceo','gm','driver','warehouse_manager','back_office'));
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.logistics_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- VENDOR PAYMENTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.vendor_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid REFERENCES public.vendors(id),
  po_id           uuid REFERENCES public.purchase_orders(id),
  amount          numeric(12,2) NOT NULL,
  payment_date    date DEFAULT CURRENT_DATE,
  payment_mode    text DEFAULT 'bank_transfer',
  utr_number      text,
  status          text DEFAULT 'pending',
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance team manages vendor payments" ON public.vendor_payments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','purchase_manager','purchase_head','back_office'));


-- ──────────────────────────────────────────────────────────────
-- TELE CALLER CRM
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.crm_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  phone           text NOT NULL,
  email           text,
  business_type   text,
  city            text,
  interest_level  text DEFAULT 'warm',
  status          text DEFAULT 'new',
  assigned_to     uuid REFERENCES public.profiles(id),
  last_contacted  date,
  next_followup   date,
  notes           text,
  converted_to_customer boolean DEFAULT false,
  customer_id     uuid REFERENCES public.customers(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tele callers manage leads" ON public.crm_leads FOR ALL USING (get_my_role() IN ('admin','ceo','gm','tele_caller','field_executive','back_office') OR assigned_to = auth.uid());
CREATE TRIGGER crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action              text NOT NULL,
  performed_by        uuid REFERENCES public.profiles(id),
  performed_by_name   text,
  performed_by_role   text,
  record_type         text,
  record_id           text,
  before_state        jsonb,
  after_state         jsonb,
  remarks             text,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr'));
CREATE POLICY "System inserts audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  type        text DEFAULT 'info',
  is_read     boolean DEFAULT false,
  link        text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON public.notifications FOR INSERT WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- PAYMENT REQUESTS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE public.payment_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id          uuid NOT NULL REFERENCES public.profiles(id),
  purpose               text NOT NULL,
  vendor_name           text NOT NULL,
  vendor_bank_details   text,
  amount                numeric(15,2) NOT NULL,
  bill_url              text,
  work_proof_url        text,
  urgency               text NOT NULL DEFAULT 'normal',
  status                text NOT NULL DEFAULT 'pending',
  admin_approved_by     uuid REFERENCES public.profiles(id),
  admin_approved_at     timestamptz,
  admin_rejection_reason text,
  ceo_approved_by       uuid REFERENCES public.profiles(id),
  ceo_approved_at       timestamptz,
  utr_number            text,
  payment_proof_url     text,
  paid_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests" ON public.payment_requests FOR SELECT USING (requester_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts'));
CREATE POLICY "Users create requests" ON public.payment_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Admins update requests" ON public.payment_requests FOR UPDATE USING (get_my_role() IN ('admin','ceo','accounts'));
CREATE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
