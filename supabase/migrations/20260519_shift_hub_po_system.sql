-- ============================================================
--  Farmers Factory ERP — Two-Shift Hub-Based PO System
--  Migration: 20260519_shift_hub_po_system.sql
--
--  Shift 1: 10:00 AM → 7:30 PM  → PO goes to Operations Manager (approval required)
--  Shift 2: 7:30 PM → 11:00 PM  → PO goes directly to Purchase Executive (no approval)
--
--  3 POs per shift, one per hub: Palikarani / Vanagaram / Hyderabad
-- ============================================================

-- ── 1. Add shift & hub_name to sales_orders ──────────────────
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS shift        integer CHECK (shift IN (1, 2)),
  ADD COLUMN IF NOT EXISTS hub_name     text,
  ADD COLUMN IF NOT EXISTS delivery_date date;

-- ── 2. Add delivery_date to sales_order_items if missing ──────
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS delivery_date date;

-- ── 3. purchase_orders table extension ───────────────────────
-- Add shift, hub_id, hub_name, approval_status columns
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS shift          integer CHECK (shift IN (1, 2)),
  ADD COLUMN IF NOT EXISTS hub_id         uuid REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS hub_name       text,
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending'
                                          CHECK (approval_status IN ('pending','approved','rejected','direct')),
  ADD COLUMN IF NOT EXISTS routed_to      text,   -- 'operations_manager' or 'purchase_executive'
  ADD COLUMN IF NOT EXISTS approved_by    uuid,
  ADD COLUMN IF NOT EXISTS approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ── 4. PO-to-SalesOrder linking table ────────────────────────
CREATE TABLE IF NOT EXISTS public.po_sales_order_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sales_order_id  uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(po_id, sales_order_id)
);

ALTER TABLE public.po_sales_order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_po_links" ON public.po_sales_order_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Index for fast lookups ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_orders_shift    ON public.sales_orders(shift);
CREATE INDEX IF NOT EXISTS idx_sales_orders_hub_id   ON public.sales_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_shift ON public.purchase_orders(shift);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_hub   ON public.purchase_orders(hub_id);

-- ── 6. Helper: get_shift_for_time(time) returns 1 or 2 ───────
CREATE OR REPLACE FUNCTION public.get_shift_for_time(t time)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t >= '10:00' AND t < '19:30' THEN 1
    WHEN t >= '19:30' AND t <= '23:00' THEN 2
    ELSE NULL
  END;
$$;

-- ============================================================
-- Schema additions complete.
-- Shift logic:
--   shift = 1 → order created 10:00–19:29 → PO to Ops Manager
--   shift = 2 → order created 19:30–23:00 → PO directly to Purchase Exec
-- ============================================================
