-- ============================================================
--  Farmers Factory ERP — Truly Missing Tables + Seed Data
--  Migration: 20260518_missing_core_tables.sql
--  Run in Supabase Dashboard → SQL Editor
-- ============================================================
-- NOTE: Most core tables already exist from 20260511000001_ff_erp_schema.sql
-- This migration ONLY adds what is genuinely missing + seeds demo data.
-- ============================================================

-- ── 1. HUBS (NEW — not in any previous migration) ────────────
CREATE TABLE IF NOT EXISTS public.hubs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  location    text,
  city        text,
  state       text DEFAULT 'Tamil Nadu',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_hubs" ON public.hubs;
CREATE POLICY "authenticated_all_hubs" ON public.hubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.hubs (name, location, city) VALUES
  ('Palikarani Hub', 'Palikarani',  'Chennai'),
  ('Vanagaram Hub',  'Vanagaram',   'Chennai'),
  ('Hyderabad Hub',  'Hyderabad',   'Hyderabad')
ON CONFLICT DO NOTHING;

-- ── 2. SALARY BATCHES (NEW) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name      text NOT NULL,
  month           integer CHECK (month BETWEEN 1 AND 12),
  year            integer,
  status          text DEFAULT 'draft'
                    CHECK (status IN ('draft','processing','approved','paid')),
  total_employees integer DEFAULT 0,
  total_amount    numeric(14,2) DEFAULT 0,
  processed_by    uuid REFERENCES public.profiles(id),
  processed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.salary_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_salary" ON public.salary_batches;
CREATE POLICY "authenticated_all_salary" ON public.salary_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. SELFIE RECORDS (NEW) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.selfie_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid REFERENCES public.profiles(id),
  employee_name text,
  date          date DEFAULT CURRENT_DATE,
  time          time DEFAULT CURRENT_TIME,
  selfie_url    text,
  location      text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  type          text DEFAULT 'check_in'
                  CHECK (type IN ('check_in','check_out','break_start','break_end')),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.selfie_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_selfie" ON public.selfie_records;
CREATE POLICY "authenticated_all_selfie" ON public.selfie_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. SEED: PRODUCTS (using correct column names) ───────────
-- Products table exists. Insert demo grocery items if empty.
INSERT INTO public.products (name, category, unit, grade_a_price, grade_b_price, grade_c_price, is_active)
SELECT name, category, unit, grade_a_price, grade_b_price, grade_c_price, true
FROM (VALUES
  ('Onion',         'Vegetables', 'KG',  28,  24,  20),
  ('Tomato',        'Vegetables', 'KG',  45,  38,  30),
  ('Potato',        'Vegetables', 'KG',  35,  30,  25),
  ('Carrot',        'Vegetables', 'KG',  40,  34,  28),
  ('Cabbage',       'Vegetables', 'KG',  22,  18,  14),
  ('Beetroot',      'Vegetables', 'KG',  30,  26,  20),
  ('Coriander',     'Vegetables', 'KG',  70,  60,  50),
  ('Drumstick',     'Vegetables', 'KG',  50,  42,  35),
  ('Beans',         'Vegetables', 'KG',  60,  52,  44),
  ('Brinjal',       'Vegetables', 'KG',  32,  28,  22),
  ('Capsicum',      'Vegetables', 'KG',  55,  48,  40),
  ('Lady Finger',   'Vegetables', 'KG',  45,  38,  30),
  ('Raw Banana',    'Vegetables', 'KG',  35,  30,  24),
  ('Bitter Gourd',  'Vegetables', 'KG',  40,  34,  28),
  ('Green Chilli',  'Vegetables', 'KG',  60,  50,  40),
  ('Garlic',        'Vegetables', 'KG', 120, 100,  80),
  ('Ginger',        'Vegetables', 'KG', 100,  85,  70),
  ('Spinach',       'Vegetables', 'KG',  30,  25,  20),
  ('Mango',         'Fruits',     'KG',  80,  65,  50),
  ('Banana',        'Fruits',     'KG',  40,  34,  28),
  ('Apple',         'Fruits',     'KG', 150, 120,  90),
  ('Papaya',        'Fruits',     'KG',  35,  28,  22),
  ('Watermelon',    'Fruits',     'KG',  18,  14,  10),
  ('Rice',          'Grains',     'KG',  65,  55,  45),
  ('Wheat',         'Grains',     'KG',  38,  32,  26),
  ('Toor Dal',      'Pulses',     'KG', 130, 115, 100),
  ('Moong Dal',     'Pulses',     'KG', 120, 105,  90),
  ('Coconut Oil',   'Oils',       'LTR',180, 160, 140),
  ('Sunflower Oil', 'Oils',       'LTR',140, 125, 110),
  ('Milk',          'Dairy',      'LTR', 60,  55,  50),
  ('Paneer',        'Dairy',      'KG', 320, 290, 260),
  ('Turmeric',      'Spices',     'KG', 140, 120, 100),
  ('Red Chilli',    'Spices',     'KG', 180, 155, 130),
  ('Cumin',         'Spices',     'KG', 350, 300, 250)
) AS v(name, category, unit, grade_a_price, grade_b_price, grade_c_price)
WHERE NOT EXISTS (SELECT 1 FROM public.products LIMIT 1);

-- ── 5. SEED: VENDORS (using correct column names: name, contact_person) ─────
INSERT INTO public.vendors (name, contact_person, phone, city, is_active)
SELECT name, contact_person, phone, city, true
FROM (VALUES
  ('Ravi Farms',          'Ravi Kumar',  '9444111222', 'Chennai'),
  ('AK Traders',          'Arjun K',     '9555222333', 'Chennai'),
  ('Fresh Vendors Co.',   'Suresh M',    '9666333444', 'Chennai'),
  ('Green Valley Agro',   'Priya G',     '9777444555', 'Coimbatore'),
  ('Tamil Nadu Produce',  'Karthik R',   '9888555666', 'Chennai'),
  ('Sri Murugan Traders', 'Murugan S',   '9999666777', 'Chennai')
) AS v(name, contact_person, phone, city)
WHERE NOT EXISTS (SELECT 1 FROM public.vendors LIMIT 1);

-- ── DONE ─────────────────────────────────────────────────────
-- Tables created: hubs, salary_batches, selfie_records
-- Seed data inserted: 34 products, 3 hubs, 6 vendors (only if tables were empty)
