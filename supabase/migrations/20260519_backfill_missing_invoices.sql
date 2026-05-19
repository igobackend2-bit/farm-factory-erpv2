-- ============================================================
--  Farmers Factory ERP — Backfill Missing Invoices
--  Migration: 20260519_backfill_missing_invoices.sql
--
--  Root cause: the old invoice number generator used COUNT(*) which
--  had a race condition — simultaneous orders both read count=N,
--  both tried to insert the same invoice number, and the second
--  silently failed. This migration backfills the missing ones.
-- ============================================================

-- Insert invoices for orders that don't have one yet
-- Invoice number = INV-YYYYMMDD-XXXXXX where XXXXXX = first 6 chars of order UUID
INSERT INTO public.invoices (
  invoice_number,
  order_id,
  customer_id,
  customer_name,
  invoice_date,
  due_date,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  payment_mode,
  status,
  notes
)
SELECT
  'INV-' || TO_CHAR(so.created_at, 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(REPLACE(so.id::text, '-', '') FROM 1 FOR 6)) AS invoice_number,
  so.id                           AS order_id,
  so.customer_id,
  so.customer_name,
  COALESCE(so.order_date, CURRENT_DATE) AS invoice_date,
  COALESCE(so.order_date, CURRENT_DATE) AS due_date,
  COALESCE(so.subtotal,    so.net_amount, so.total_amount, 0) AS subtotal,
  0                               AS discount_amount,
  0                               AS tax_amount,
  COALESCE(so.total_amount, so.net_amount, 0) AS total_amount,
  COALESCE(so.payment_mode, 'cod') AS payment_mode,
  'unpaid'                        AS status,
  so.notes
FROM public.sales_orders so
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoices inv WHERE inv.order_id = so.id
)
AND so.status NOT IN ('cancelled', 'draft')
ON CONFLICT (invoice_number) DO NOTHING;

-- ============================================================
-- Result: all orders in sales_orders will now have an invoice
-- ============================================================
