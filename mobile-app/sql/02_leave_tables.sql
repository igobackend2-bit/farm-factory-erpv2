-- Mobile App Leave & HR Tables
-- Run in Supabase SQL Editor

-- 1. LEAVE REQUESTS - Leave applications
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'unpaid', 'work_from_home', 'half_day', 'other')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(3,1) NOT NULL,
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamp with time zone,
    rejection_reason text,
    is_emergency boolean DEFAULT false,
    alternate_contact text,
    handover_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. LEAVE BALANCES - Leave quota tracking
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual')),
    year integer NOT NULL,
    total_days numeric(3,1) NOT NULL DEFAULT 0,
    used_days numeric(3,1) NOT NULL DEFAULT 0,
    pending_days numeric(3,1) NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, leave_type, year)
);

-- 3. LOP ENTRIES - Loss of Pay tracking
CREATE TABLE IF NOT EXISTS public.lop_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE SET NULL,
    date date NOT NULL,
    half_day boolean DEFAULT false,
    amount numeric(10,2),
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_generated')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, date)
);

-- 4. LEAVE REVERSAL REQUESTS - LOP reversal
CREATE TABLE IF NOT EXISTS public.lop_reversal_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    lop_entry_id uuid REFERENCES public.lop_entries(id) ON DELETE CASCADE NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. LOP REVERSAL TYPES - Reference table
CREATE TABLE IF NOT EXISTS public.lop_reversal_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert default reversal types
INSERT INTO public.lop_reversal_types (name, description) VALUES
    ('Medical Emergency', 'Medical emergency with proof'),
    ('Office Duty', 'Directed by office to attend'),
    ('System Error', 'System marking error'),
    ('Holiday Conflict', 'Holiday on working day'),
    ('Transport Issue', 'Transport failure')
ON CONFLICT (name) DO NOTHING;

-- ENABLE RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_reversal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_reversal_types ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR LEAVE REQUESTS
DROP POLICY IF EXISTS "Employees can view own leave requests" ON public.leave_requests;
CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can create leave requests" ON public.leave_requests;
CREATE POLICY "Employees can create leave requests" ON public.leave_requests
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can update own leave requests" ON public.leave_requests;
CREATE POLICY "Employees can update own leave requests" ON public.leave_requests
    FOR UPDATE USING (auth.uid() = employee_id AND status = 'pending');

DROP POLICY IF EXISTS "HR can view all leave requests" ON public.leave_requests;
CREATE POLICY "HR can view all leave requests" ON public.leave_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

DROP POLICY IF EXISTS "HR can approve leave requests" ON public.leave_requests;
CREATE POLICY "HR can approve leave requests" ON public.leave_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- RLS POLICIES FOR LEAVE BALANCES
DROP POLICY IF EXISTS "Employees can view own leave balances" ON public.leave_balances;
CREATE POLICY "Employees can view own leave balances" ON public.leave_balances
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can manage all leave balances" ON public.leave_balances;
CREATE POLICY "HR can manage all leave balances" ON public.leave_balances
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo'))
    );

-- RLS POLICIES FOR LOP ENTRIES
DROP POLICY IF EXISTS "Employees can view own LOP entries" ON public.lop_entries;
CREATE POLICY "Employees can view own LOP entries" ON public.lop_entries
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can manage all LOP entries" ON public.lop_entries;
CREATE POLICY "HR can manage all LOP entries" ON public.lop_entries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- RLS POLICIES FOR LOP REVERSAL REQUESTS
DROP POLICY IF EXISTS "Employees can manage own LOP reversals" ON public.lop_reversal_requests;
CREATE POLICY "Employees can manage own LOP reversals" ON public.lop_reversal_requests
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can review LOP reversals" ON public.lop_reversal_requests;
CREATE POLICY "HR can review LOP reversals" ON public.lop_reversal_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm'))
    );

-- RLS POLICIES FOR LOP REVERSAL TYPES
DROP POLICY IF EXISTS "Everyone can view active reversal types" ON public.lop_reversal_types;
CREATE POLICY "Everyone can view active reversal types" ON public.lop_reversal_types
    FOR SELECT USING (is_active = true);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON public.leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date ON public.leave_requests(start_date DESC, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_lop_entries_employee_date ON public.lop_entries(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_lop_reversal_requests_status ON public.lop_reversal_requests(status);

-- FUNCTION TO UPDATE LEAVE BALANCE ON APPROVAL
CREATE OR REPLACE FUNCTION update_leave_balance_on_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE public.leave_balances
        SET used_days = used_days + NEW.total_days,
            pending_days = pending_days - NEW.total_days
        WHERE employee_id = NEW.employee_id
          AND leave_type = NEW.leave_type
          AND year = EXTRACT(YEAR FROM NEW.start_date)::int;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leave_balance ON public.leave_requests;
CREATE TRIGGER trigger_update_leave_balance
    AFTER UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_leave_balance_on_approval();

-- ENABLE REALTIME
BEGIN;
DROP PUBLICATION IF EXISTS mobile_leave_pub;
CREATE PUBLICATION mobile_leave_pub FOR TABLE leave_requests, leave_balances, lop_entries, lop_reversal_requests, lop_reversal_types;
COMMIT;