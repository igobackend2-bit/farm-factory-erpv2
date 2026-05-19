-- ============================================================
-- Migration: Transit, QC Enhancements, Payment Approval Flow
-- Date: 2026-05-15
-- ============================================================

-- ── 1. TRANSIT RECORDS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS transit_records (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id             uuid        REFERENCES purchase_orders(id) ON DELETE SET NULL,
  hub_id            uuid        REFERENCES hubs(id),
  vehicle_type      text        NOT NULL DEFAULT 'own'
                                CHECK (vehicle_type IN ('own', 'hired')),
  driver_name       text,
  vehicle_number    text,
  transit_cost      numeric     NOT NULL DEFAULT 0,
  notes             text,
  arrived_at        timestamptz NOT NULL DEFAULT now(),
  status            text        NOT NULL DEFAULT 'arrived'
                                CHECK (status IN ('arrived', 'in_qc', 'completed')),
  created_by        uuid        REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_transit_all" ON transit_records FOR ALL USING (true);

-- ── 2. QC ENHANCEMENTS ─────────────────────────────────────
ALTER TABLE qc_inspections
  ADD COLUMN IF NOT EXISTS transit_record_id  uuid        REFERENCES transit_records(id),
  ADD COLUMN IF NOT EXISTS inspection_checklist jsonb     DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_urls         text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_by        uuid        REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS review_status      text        DEFAULT 'submitted'
                                              CHECK (review_status IN ('submitted', 'approved', 'flagged'));

-- Sequential GRN helper (GRN-2026-0001 format)
CREATE SEQUENCE IF NOT EXISTS grn_seq START 1;

CREATE OR REPLACE FUNCTION next_grn_number()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'GRN-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('grn_seq')::text, 4, '0');
END;
$$;

-- ── 3. DEDUCTION MEMOS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS deduction_memos (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_inspection_id    uuid    REFERENCES qc_inspections(id) ON DELETE SET NULL,
  vendor_id           uuid    REFERENCES vendors(id),
  po_id               uuid    REFERENCES purchase_orders(id) ON DELETE SET NULL,
  deduction_type      text    NOT NULL DEFAULT 'quality'
                              CHECK (deduction_type IN ('quality', 'shortage', 'damage', 'other')),
  deduction_kg        numeric DEFAULT 0,
  deduction_amount    numeric NOT NULL DEFAULT 0,
  description         text,
  status              text    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'applied', 'voided')),
  applied_to_payment  uuid,
  created_by          uuid    REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deduction_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_deductions_all" ON deduction_memos FOR ALL USING (true);

-- ── 4. VENDOR PAYMENT APPROVAL COLUMNS ─────────────────────
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS payment_type        text    DEFAULT 'full'
                                               CHECK (payment_type IN ('advance','partial','full','porter','credit_note')),
  ADD COLUMN IF NOT EXISTS po_id               uuid    REFERENCES purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status              text    DEFAULT 'pending_admin'
                                               CHECK (status IN (
                                                 'pending_admin','pending_director',
                                                 'approved','rejected','processed'
                                               )),
  ADD COLUMN IF NOT EXISTS deduction_total     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount          numeric,
  ADD COLUMN IF NOT EXISTS approved_by_admin   uuid    REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_director uuid   REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS director_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason    text,
  ADD COLUMN IF NOT EXISTS processed_by        uuid    REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS utr_reference       text,
  ADD COLUMN IF NOT EXISTS processed_at        timestamptz;

-- ── 5. PAYMENT DEDUCTION LINES ──────────────────────────────
CREATE TABLE IF NOT EXISTS payment_deduction_lines (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid    REFERENCES vendor_payments(id) ON DELETE CASCADE,
  deduction_memo_id   uuid    REFERENCES deduction_memos(id),
  amount              numeric NOT NULL DEFAULT 0,
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_deduction_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_deduction_lines_all" ON payment_deduction_lines FOR ALL USING (true);

-- ── 6. TRANSIT RECORD INDEX ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transit_po     ON transit_records(po_id);
CREATE INDEX IF NOT EXISTS idx_transit_hub    ON transit_records(hub_id);
CREATE INDEX IF NOT EXISTS idx_deduction_vendor ON deduction_memos(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_status   ON vendor_payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_po       ON vendor_payments(po_id);
