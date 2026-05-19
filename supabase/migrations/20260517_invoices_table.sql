-- ============================================================
-- Invoices table + backfill for Farmers Factory ERP
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text NOT NULL UNIQUE,
  order_id         uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text,
  customer_phone   text,
  customer_address text,
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode     text DEFAULT 'cod',
  status           text NOT NULL DEFAULT 'unpaid',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoices TO anon, authenticated;

-- STEP 2: Backfill invoices for all existing orders
INSERT INTO public.invoices (
  invoice_number, order_id, customer_id, customer_name,
  customer_phone, customer_address, invoice_date,
  subtotal, total_amount, payment_mode, status
)
SELECT
  CONCAT('INV-', TO_CHAR(so.created_at, 'YYYYMMDD'), '-',
         LPAD(ROW_NUMBER() OVER (ORDER BY so.created_at)::text, 4, '0')),
  so.id,
  so.customer_id,
  COALESCE(so.customer_name, c.name, c.shop_name, 'Customer'),
  COALESCE(c.phone, c.mobile),
  c.address,
  so.created_at::date,
  COALESCE(so.subtotal, so.total_amount, 0),
  COALESCE(so.net_amount, so.total_amount, 0),
  COALESCE(so.payment_mode, 'cod'),
  'unpaid'
FROM public.sales_orders so
LEFT JOIN public.customers c ON c.id = so.customer_id
WHERE so.id NOT IN (
  SELECT order_id FROM public.invoices WHERE order_id IS NOT NULL
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
