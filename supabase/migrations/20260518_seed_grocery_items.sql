-- ============================================================
--  Farmers Factory ERP — Grocery Items Seed
--  Migration: 20260518_seed_grocery_items.sql
--
--  Pricing structure (for profit margin):
--    grade_a_price = Our SELLING price (what customer pays)
--    grade_b_price = Mid grade
--    grade_c_price = Avg PURCHASE/COST price (what we pay vendor)
--                    → Always lower than selling price = PROFIT
--
--  Margin example: Onion sell ₹35, buy ₹22 → margin = 37%
-- ============================================================

INSERT INTO public.products
  (name, category, unit, grade_a_price, grade_b_price, grade_c_price, is_active)
SELECT name, category, unit, grade_a_price, grade_b_price, grade_c_price, true
FROM (VALUES
  -- Vegetables (sell price / mid / cost price)
  ('Onion',         'Vegetables', 'kg',  35,  28,  22),
  ('Tomato',        'Vegetables', 'kg',  50,  42,  32),
  ('Potato',        'Vegetables', 'kg',  40,  34,  26),
  ('Carrot',        'Vegetables', 'kg',  48,  40,  30),
  ('Cabbage',       'Vegetables', 'kg',  28,  22,  14),
  ('Beetroot',      'Vegetables', 'kg',  38,  30,  20),
  ('Green Chilli',  'Vegetables', 'kg',  70,  58,  44),
  ('Garlic',        'Vegetables', 'kg', 140, 115,  90),
  ('Ginger',        'Vegetables', 'kg', 120, 100,  75),
  ('Spinach',       'Vegetables', 'kg',  38,  30,  20),
  ('Coriander',     'Vegetables', 'kg',  85,  70,  50),
  ('Drumstick',     'Vegetables', 'kg',  65,  52,  35),
  ('Beans',         'Vegetables', 'kg',  75,  60,  44),
  ('Brinjal',       'Vegetables', 'kg',  40,  32,  22),
  ('Capsicum',      'Vegetables', 'kg',  68,  55,  40),
  ('Lady Finger',   'Vegetables', 'kg',  55,  45,  30),
  -- Fruits
  ('Banana',        'Fruits',     'kg',  50,  40,  30),
  ('Mango',         'Fruits',     'kg',  95,  78,  58),
  ('Papaya',        'Fruits',     'kg',  45,  36,  24),
  ('Watermelon',    'Fruits',     'kg',  22,  16,  10),
  ('Apple',         'Fruits',     'kg', 180, 145,  95),
  -- Grains & Pulses
  ('Rice',          'Grains',     'kg',  80,  68,  52),
  ('Wheat',         'Grains',     'kg',  48,  40,  28),
  ('Toor Dal',      'Pulses',     'kg', 150, 130, 105),
  ('Moong Dal',     'Pulses',     'kg', 140, 118,  92),
  -- Oils & Dairy
  ('Sunflower Oil', 'Oils',       'ltr',165, 145, 120),
  ('Coconut Oil',   'Oils',       'ltr',210, 180, 145),
  ('Milk',          'Dairy',      'ltr', 68,  62,  52),
  ('Paneer',        'Dairy',      'kg', 380, 330, 265),
  -- Spices
  ('Turmeric',      'Spices',     'kg', 168, 138, 102),
  ('Red Chilli',    'Spices',     'kg', 210, 175, 135),
  ('Cumin',         'Spices',     'kg', 420, 350, 260)
) AS v(name, category, unit, grade_a_price, grade_b_price, grade_c_price)
WHERE NOT EXISTS (SELECT 1 FROM public.products LIMIT 1);

-- ── If products already have rows, just ensure these key items exist ──
INSERT INTO public.products
  (name, category, unit, grade_a_price, grade_b_price, grade_c_price, is_active)
SELECT v.name, v.category, v.unit, v.grade_a_price, v.grade_b_price, v.grade_c_price, true
FROM (VALUES
  ('Onion',         'Vegetables', 'kg',  35,  28,  22),
  ('Tomato',        'Vegetables', 'kg',  50,  42,  32),
  ('Potato',        'Vegetables', 'kg',  40,  34,  26),
  ('Carrot',        'Vegetables', 'kg',  48,  40,  30),
  ('Green Chilli',  'Vegetables', 'kg',  70,  58,  44),
  ('Garlic',        'Vegetables', 'kg', 140, 115,  90),
  ('Ginger',        'Vegetables', 'kg', 120, 100,  75),
  ('Banana',        'Fruits',     'kg',  50,  40,  30),
  ('Rice',          'Grains',     'kg',  80,  68,  52),
  ('Toor Dal',      'Pulses',     'kg', 150, 130, 105),
  ('Sunflower Oil', 'Oils',       'ltr',165, 145, 120),
  ('Milk',          'Dairy',      'ltr', 68,  62,  52)
) AS v(name, category, unit, grade_a_price, grade_b_price, grade_c_price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = v.name
);

-- ============================================================
-- PRICE LEGEND (for reference):
--   grade_a_price = Selling Price to Customer (higher)
--   grade_c_price = Purchase/Cost Price from Vendor (lower)
--   Profit Margin = (grade_a - grade_c) / grade_a × 100
--
-- Example margins:
--   Onion:   (35-22)/35 = 37%
--   Tomato:  (50-32)/50 = 36%
--   Rice:    (80-52)/80 = 35%
--   Garlic:  (140-90)/140 = 36%
-- ============================================================
