-- Mobile App Attendance Tables - Safe Mode
-- Run in Supabase SQL Editor (run one at a time if needed)

-- Check existing tables first
SELECT 
    tablename 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'attendance_records', 'day_plans', 'hourly_reports', 
    'selfie_records', 'shift_sessions', 'employee_projects', 'site_visits'
);

-- 1. ATTENDANCE RECORDS - Create if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'attendance_records'
    ) THEN
        CREATE TABLE public.attendance_records (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            date date NOT NULL DEFAULT CURRENT_DATE,
            clock_in_time time with time zone,
            clock_out_time time with time zone,
            clock_in_location jsonb,
            clock_out_location jsonb,
            clock_in_selfie_url text,
            clock_out_selfie_url text,
            clock_in_zone text,
            clock_out_zone text,
            status text DEFAULT 'pending',
            late_minutes integer DEFAULT 0,
            work_hours numeric(5,2),
            is_remote boolean DEFAULT false,
            notes text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- 2. DAY PLANS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'day_plans'
    ) THEN
        CREATE TABLE public.day_plans (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            date date NOT NULL DEFAULT CURRENT_DATE,
            plan_items jsonb DEFAULT '[]'::jsonb,
            status text DEFAULT 'draft',
            submitted_at timestamp with time zone,
            approved_by uuid REFERENCES auth.users(id),
            approved_at timestamp with time zone,
            rejection_reason text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            UNIQUE(employee_id, date)
        );
    END IF;
END $$;

-- 3. HOURLY REPORTS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'hourly_reports'
    ) THEN
        CREATE TABLE public.hourly_reports (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            date date NOT NULL DEFAULT CURRENT_DATE,
            hour integer NOT NULL,
            report_type text NOT NULL,
            description text,
            location jsonb,
            selfie_url text,
            task_reference_id uuid,
            project_id uuid,
            status text DEFAULT 'submitted',
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- 4. SHIFT SESSIONS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'shift_sessions'
    ) THEN
        CREATE TABLE public.shift_sessions (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            date date NOT NULL DEFAULT CURRENT_DATE,
            shift_type text NOT NULL,
            start_time time with time zone NOT NULL,
            end_time time with time zone,
            status text DEFAULT 'scheduled',
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- 5. EMPLOYEE PROJECTS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'employee_projects'
    ) THEN
        CREATE TABLE public.employee_projects (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            project_id uuid NOT NULL,
            project_name text NOT NULL,
            role text,
            status text DEFAULT 'active',
            start_date date,
            end_date date,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            UNIQUE(employee_id, project_id)
        );
    END IF;
END $$;

-- 6. SITE VISITS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'site_visits'
    ) THEN
        CREATE TABLE public.site_visits (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            project_id uuid,
            site_name text NOT NULL,
            site_address text,
            visit_date date NOT NULL,
            check_in_time timestamp with time zone,
            check_out_time timestamp with time zone,
            check_in_location jsonb,
            check_out_location jsonb,
            purpose text,
            notes text,
            attachments jsonb DEFAULT '[]'::jsonb,
            status text DEFAULT 'scheduled',
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- ENABLE RLS (if not already enabled)
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Attendance Records
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance_records;
CREATE POLICY "Employees can view own attendance" ON public.attendance_records
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance_records;
CREATE POLICY "Employees can insert own attendance" ON public.attendance_records
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance_records;
CREATE POLICY "Employees can update own attendance" ON public.attendance_records
    FOR UPDATE USING (auth.uid() = employee_id);

-- Day Plans
DROP POLICY IF EXISTS "Employees can manage own day plans" ON public.day_plans;
CREATE POLICY "Employees can manage own day plans" ON public.day_plans
    FOR ALL USING (auth.uid() = employee_id);

-- Hourly Reports
DROP POLICY IF EXISTS "Employees can manage own hourly reports" ON public.hourly_reports;
CREATE POLICY "Employees can manage own hourly reports" ON public.hourly_reports
    FOR ALL USING (auth.uid() = employee_id);

-- Shift Sessions
DROP POLICY IF EXISTS "Employees can manage own shifts" ON public.shift_sessions;
CREATE POLICY "Employees can manage own shifts" ON public.shift_sessions
    FOR ALL USING (auth.uid() = employee_id);

-- Employee Projects
DROP POLICY IF EXISTS "Employees can view own projects" ON public.employee_projects;
CREATE POLICY "Employees can view own projects" ON public.employee_projects
    FOR SELECT USING (auth.uid() = employee_id);

-- Site Visits
DROP POLICY IF EXISTS "Employees can manage own site visits" ON public.site_visits;
CREATE POLICY "Employees can manage own site visits" ON public.site_visits
    FOR ALL USING (auth.uid() = employee_id);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_day_plans_employee_date ON public.day_plans(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hourly_reports_employee_date ON public.hourly_reports(employee_id, date DESC, hour);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_employee_date ON public.shift_sessions(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee ON public.employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_employee_date ON public.site_visits(employee_id, visit_date DESC);

-- ENABLE REALTIME (run separately)
-- BEGIN;
-- DROP PUBLICATION IF EXISTS mobile_attendance_pub;
-- CREATE PUBLICATION mobile_attendance_pub FOR TABLE attendance_records, day_plans, hourly_reports, shift_sessions, employee_projects, site_visits;
-- COMMIT;