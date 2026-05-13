-- Mobile App Attendance Tables
-- Run in Supabase SQL Editor

-- 1. ATTENDANCE RECORDS - Daily clock in/out
CREATE TABLE IF NOT EXISTS public.attendance_records (
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
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'present', 'absent', 'late', 'on_leave')),
    late_minutes integer DEFAULT 0,
    work_hours numeric(5,2),
    is_remote boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. DAY PLANS - Daily task planning
CREATE TABLE IF NOT EXISTS public.day_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    plan_items jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'completed')),
    submitted_at timestamp with time zone,
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, date)
);

-- 3. HOURLY REPORTS - Hourly activity reports
CREATE TABLE IF NOT EXISTS public.hourly_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    hour integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
    report_type text NOT NULL CHECK (report_type IN ('work_done', 'break', 'meeting', 'travel', 'other')),
    description text,
    location jsonb,
    selfie_url text,
    task_reference_id uuid,
    project_id uuid,
    status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, date, hour, report_type)
);

-- 4. SELFIE RECORDS - Already exists in main DB, reference here
-- Note: selfie_records table should exist - create if not exists
CREATE TABLE IF NOT EXISTS public.selfie_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    selfie_type text NOT NULL CHECK (selfie_type IN ('morning_login', 'afternoon_break', 'evening_break')),
    image_url text NOT NULL,
    location jsonb,
    zone text,
    is_late boolean DEFAULT false,
    late_reason text,
    compliance_status text DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'approved', 'rejected', 'manual')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, date, selfie_type)
);

-- 5. SHIFT SESSIONS - Work shift tracking
CREATE TABLE IF NOT EXISTS public.shift_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    shift_type text NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night', 'general')),
    start_time time with time zone NOT NULL,
    end_time time with time zone,
    break_start time with time zone,
    break_end time with time zone,
    actual_start time with time zone,
    actual_end time with time zone,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'on_break', 'completed', 'cancelled')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, date, shift_type)
);

-- 6. SHIFT BREAKS - Break times
CREATE TABLE IF NOT EXISTS public.shift_breaks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_session_id uuid REFERENCES public.shift_sessions(id) ON DELETE CASCADE NOT NULL,
    break_type text NOT NULL CHECK (break_type IN ('lunch', 'short', 'other')),
    scheduled_start time with time zone NOT NULL,
    scheduled_end time with time zone NOT NULL,
    actual_start time with time zone,
    actual_end time with time zone,
    duration_minutes integer,
    created_at timestamp with time zone DEFAULT now()
);

-- 7. EMPLOYEE PROJECTS - Assigned projects
CREATE TABLE IF NOT EXISTS public.employee_projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id uuid NOT NULL,
    project_name text NOT NULL,
    role text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, project_id)
);

-- 8. SITE VISITS - Site visit tracking
CREATE TABLE IF NOT EXISTS public.site_visits (
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
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selfie_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR ATTENDANCE RECORDS
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance_records;
CREATE POLICY "Employees can view own attendance" ON public.attendance_records
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance_records;
CREATE POLICY "Employees can insert own attendance" ON public.attendance_records
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance_records;
CREATE POLICY "Employees can update own attendance" ON public.attendance_records
    FOR UPDATE USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all attendance" ON public.attendance_records;
CREATE POLICY "HR can view all attendance" ON public.attendance_records
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

DROP POLICY IF EXISTS "HR can update all attendance" ON public.attendance_records;
CREATE POLICY "HR can update all attendance" ON public.attendance_records
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo'))
    );

-- RLS POLICIES FOR DAY PLANS
DROP POLICY IF EXISTS "Employees can manage own day plans" ON public.day_plans;
CREATE POLICY "Employees can manage own day plans" ON public.day_plans
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all day plans" ON public.day_plans;
CREATE POLICY "HR can view all day plans" ON public.day_plans
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- RLS POLICIES FOR HOURLY REPORTS
DROP POLICY IF EXISTS "Employees can manage own hourly reports" ON public.hourly_reports;
CREATE POLICY "Employees can manage own hourly reports" ON public.hourly_reports
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all hourly reports" ON public.hourly_reports;
CREATE POLICY "HR can view all hourly reports" ON public.hourly_reports
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- RLS POLICIES FOR SELFIE RECORDS
DROP POLICY IF EXISTS "Employees can manage own selfies" ON public.selfie_records;
CREATE POLICY "Employees can manage own selfies" ON public.selfie_records
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all selfies" ON public.selfie_records;
CREATE POLICY "HR can view all selfies" ON public.selfie_records
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

DROP POLICY IF EXISTS "HR can approve selfies" ON public.selfie_records;
CREATE POLICY "HR can approve selfies" ON public.selfie_records
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo'))
    );

-- RLS POLICIES FOR SHIFT SESSIONS
DROP POLICY IF EXISTS "Employees can manage own shifts" ON public.shift_sessions;
CREATE POLICY "Employees can manage own shifts" ON public.shift_sessions
    FOR ALL USING (auth.uid() = employee_id);

-- RLS POLICIES FOR EMPLOYEE PROJECTS
DROP POLICY IF EXISTS "Employees can view own projects" ON public.employee_projects;
CREATE POLICY "Employees can view own projects" ON public.employee_projects
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can manage all projects" ON public.employee_projects;
CREATE POLICY "HR can manage all projects" ON public.employee_projects
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- RLS POLICIES FOR SITE VISITS
DROP POLICY IF EXISTS "Employees can manage own site visits" ON public.site_visits;
CREATE POLICY "Employees can manage own site visits" ON public.site_visits
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all site visits" ON public.site_visits;
CREATE POLICY "HR can view all site visits" ON public.site_visits
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'gm', 'smo', 'gmo'))
    );

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_day_plans_employee_date ON public.day_plans(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_day_plans_status ON public.day_plans(status);
CREATE INDEX IF NOT EXISTS idx_hourly_reports_employee_date ON public.hourly_reports(employee_id, date DESC, hour);
CREATE INDEX IF NOT EXISTS idx_selfie_records_employee_date ON public.selfie_records(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_employee_date ON public.shift_sessions(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee ON public.employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_employee_date ON public.site_visits(employee_id, visit_date DESC);

-- ENABLE REALTIME
BEGIN;
DROP PUBLICATION IF EXISTS mobile_attendance_pub;
CREATE PUBLICATION mobile_attendance_pub FOR TABLE attendance_records, day_plans, hourly_reports, selfie_records, shift_sessions, employee_projects, site_visits;
COMMIT;