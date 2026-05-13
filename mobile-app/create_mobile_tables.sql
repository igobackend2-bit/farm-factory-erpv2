-- Manual SQL to create missing tables for mobile app
-- Run this in Supabase SQL Editor

-- Create payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    salary_month text NOT NULL,
    net_pay numeric(10,2) NOT NULL,
    paid_on date,
    file_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create payment_types table
CREATE TABLE IF NOT EXISTS public.payment_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert default payment types
INSERT INTO public.payment_types (name, description) VALUES
('Salary', 'Monthly salary payment'),
('Advance', 'Salary advance payment'),
('Reimbursement', 'Expense reimbursement')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_types ENABLE ROW LEVEL SECURITY;

-- Payslips RLS policies
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payslips;
CREATE POLICY "Users can view own payslips" ON public.payslips
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can manage all payslips" ON public.payslips;
CREATE POLICY "HR can manage all payslips" ON public.payslips
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo')
        )
    );

-- Payment types RLS policies
DROP POLICY IF EXISTS "Everyone can view active payment types" ON public.payment_types;
CREATE POLICY "Everyone can view active payment types" ON public.payment_types
    FOR SELECT USING (is_active = true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payslips_employee_month ON public.payslips(employee_id, salary_month DESC);
CREATE INDEX IF NOT EXISTS idx_payment_types_active ON public.payment_types(is_active) WHERE is_active = true;

-- Function to create payslips table (for mobile app fallback)
CREATE OR REPLACE FUNCTION create_payslips_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'payslips'
    ) THEN
        -- Create the table
        CREATE TABLE public.payslips (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
            salary_month text NOT NULL,
            net_pay numeric(10,2) NOT NULL,
            paid_on date,
            file_url text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

        -- Add policies
        CREATE POLICY "Users can view own payslips" ON public.payslips
            FOR SELECT USING (auth.uid() = employee_id);

        CREATE POLICY "HR can manage all payslips" ON public.payslips
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo')
                )
            );

        -- Add index
        CREATE INDEX idx_payslips_employee_month ON public.payslips(employee_id, salary_month DESC);
    END IF;
END;
$$;