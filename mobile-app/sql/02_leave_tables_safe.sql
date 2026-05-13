-- Mobile App Leave Tables - Safe Mode
-- Run in Supabase SQL Editor

-- Check existing tables first
SELECT 
    tablename 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'leave_requests', 'leave_balances', 'lop_entries', 
    'lop_reversal_requests', 'lop_reversal_types'
);

-- 1. LEAVE REQUESTS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'leave_requests'
    ) THEN
        CREATE TABLE public.leave_requests (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            leave_type text NOT NULL,
            start_date date NOT NULL,
            end_date date NOT NULL,
            total_days numeric(3,1) NOT NULL,
            reason text,
            status text DEFAULT 'pending',
            approved_by uuid REFERENCES auth.users(id),
            approved_at timestamp with time zone,
            rejection_reason text,
            is_emergency boolean DEFAULT false,
            alternate_contact text,
            handover_notes text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- 2. LEAVE BALANCES
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'leave_balances'
    ) THEN
        CREATE TABLE public.leave_balances (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            leave_type text NOT NULL,
            year integer NOT NULL,
            total_days numeric(3,1) NOT NULL DEFAULT 0,
            used_days numeric(3,1) NOT NULL DEFAULT 0,
            pending_days numeric(3,1) NOT NULL DEFAULT 0,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            UNIQUE(employee_id, leave_type, year)
        );
    END IF;
END $$;

-- 3. LOP ENTRIES
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lop_entries'
    ) THEN
        CREATE TABLE public.lop_entries (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            leave_request_id uuid,
            date date NOT NULL,
            half_day boolean DEFAULT false,
            amount numeric(10,2),
            reason text,
            status text DEFAULT 'pending',
            approved_by uuid REFERENCES auth.users(id),
            approved_at timestamp with time zone,
            created_at timestamp with time zone DEFAULT now(),
            UNIQUE(employee_id, date)
        );
    END IF;
END $$;

-- 4. LOP REVERSAL REQUESTS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lop_reversal_requests'
    ) THEN
        CREATE TABLE public.lop_reversal_requests (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            lop_entry_id uuid NOT NULL,
            reason text NOT NULL,
            status text DEFAULT 'pending',
            reviewed_by uuid REFERENCES auth.users(id),
            reviewed_at timestamp with time zone,
            review_notes text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- 5. LOP REVERSAL TYPES
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lop_reversal_types'
    ) THEN
        CREATE TABLE public.lop_reversal_types (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL UNIQUE,
            description text,
            is_active boolean DEFAULT true,
            created_at timestamp with time zone DEFAULT now()
        );
        
        INSERT INTO public.lop_reversal_types (name, description) VALUES
            ('Medical Emergency', 'Medical emergency with proof'),
            ('Office Duty', 'Directed by office to attend'),
            ('System Error', 'System marking error'),
            ('Holiday Conflict', 'Holiday on working day'),
            ('Transport Issue', 'Transport failure')
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;

-- ENABLE RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_reversal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lop_reversal_types ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Leave Requests
DROP POLICY IF EXISTS "Employees can view own leave requests" ON public.leave_requests;
CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can create leave requests" ON public.leave_requests;
CREATE POLICY "Employees can create leave requests" ON public.leave_requests
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can update own leave requests" ON public.leave_requests;
CREATE POLICY "Employees can update own leave requests" ON public.leave_requests
    FOR UPDATE USING (auth.uid() = employee_id AND status = 'pending');

-- Leave Balances
DROP POLICY IF EXISTS "Employees can view own leave balances" ON public.leave_balances;
CREATE POLICY "Employees can view own leave balances" ON public.leave_balances
    FOR SELECT USING (auth.uid() = employee_id);

-- LOP Entries
DROP POLICY IF EXISTS "Employees can view own LOP entries" ON public.lop_entries;
CREATE POLICY "Employees can view own LOP entries" ON public.lop_entries
    FOR SELECT USING (auth.uid() = employee_id);

-- LOP Reversal Requests
DROP POLICY IF EXISTS "Employees can manage own LOP reversals" ON public.lop_reversal_requests;
CREATE POLICY "Employees can manage own LOP reversals" ON public.lop_reversal_requests
    FOR ALL USING (auth.uid() = employee_id);

-- LOP Reversal Types
DROP POLICY IF EXISTS "Everyone can view active reversal types" ON public.lop_reversal_types;
CREATE POLICY "Everyone can view active reversal types" ON public.lop_reversal_types
    FOR SELECT USING (is_active = true);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON public.leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date ON public.leave_requests(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_lop_entries_employee_date ON public.lop_entries(employee_id, date DESC);