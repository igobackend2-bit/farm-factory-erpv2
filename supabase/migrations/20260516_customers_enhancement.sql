-- ============================================================
-- Customer table full enhancement
-- Adds shop/individual support + all missing columns
-- ============================================================

-- Enable pg_trgm for fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add ALL missing columns
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shop_name           text,
  ADD COLUMN IF NOT EXISTS owner_name          text,
  ADD COLUMN IF NOT EXISTS area                text,
  ADD COLUMN IF NOT EXISTS gst_number          text,
  ADD COLUMN IF NOT EXISTS credit_days         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_id              uuid,
  ADD COLUMN IF NOT EXISTS first_name          text,
  ADD COLUMN IF NOT EXISTS last_name           text,
  ADD COLUMN IF NOT EXISTS salutation          text,
  ADD COLUMN IF NOT EXISTS mobile              text;

-- Fix customer_type constraint to allow shop/individual
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_customer_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_type_check
    CHECK (customer_type IN ('shop', 'individual', 'retail'));

-- Back-fill: copy name → shop_name for existing rows, tag as shop
UPDATE public.customers
SET
  shop_name           = COALESCE(shop_name, name),
  customer_type       = 'shop',
  outstanding_balance = COALESCE(outstanding_balance, outstanding, 0)
WHERE customer_type IS NULL OR customer_type = 'retail';

-- Trigram indexes for fast name auto-suggest
CREATE INDEX IF NOT EXISTS customers_shop_name_trgm
  ON public.customers USING gin (shop_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_first_name_trgm
  ON public.customers USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);
