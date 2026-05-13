-- Mobile App Communication Tables
-- Run in Supabase SQL Editor

-- 1. COMPANY CALENDAR - Company events
CREATE TABLE IF NOT EXISTS public.company_calendar (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    event_type text NOT NULL CHECK (event_type IN ('holiday', 'meeting', 'event', 'deadline', 'other')),
    start_date date NOT NULL,
    end_date date,
    start_time time with time zone,
    end_time time with time zone,
    location text,
    organizer_id uuid REFERENCES auth.users(id),
    is_recurring boolean DEFAULT false,
    recurrence_rule text,
    visibility text DEFAULT 'all' CHECK (visibility IN ('all', 'department', 'role', 'specific')),
    target_departments text[],
    target_roles text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. ANNOUNCEMENTS - Company notices
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category text DEFAULT 'general' CHECK (category IN ('general', 'hr', 'it', 'finance', 'operations', 'safety')),
    display_from date DEFAULT CURRENT_DATE,
    display_until date,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. ANNOUNCEMENT READS - Track who read announcements
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    read_at timestamp with time zone DEFAULT now(),
    UNIQUE(announcement_id, employee_id)
);

-- 4. TRANSPORT CLAIMS - Transport expense claims
CREATE TABLE IF NOT EXISTS public.transport_claims (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    claim_date date NOT NULL DEFAULT CURRENT_DATE,
    claim_type text NOT NULL CHECK (claim_type IN ('travel', 'local', 'fuel', 'parking', 'toll', 'other')),
    amount numeric(10,2) NOT NULL,
    description text,
    from_location text,
    to_location text,
    distance_km numeric(6,2),
    receipt_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. TRANSPORT BOOKINGS - Transport bookings
CREATE TABLE IF NOT EXISTS public.transport_bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    booking_date date NOT NULL,
    pickup_location text NOT NULL,
    drop_location text NOT NULL,
    pickup_time time with time zone NOT NULL,
    vehicle_type text,
    purpose text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    confirmation_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. PUSH TOKENS - Device push tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token text NOT NULL,
    device_type text NOT NULL CHECK (device_type IN ('android', 'ios', 'web')),
    device_name text,
    app_version text,
    is_active boolean DEFAULT true,
    last_used timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, token)
);

-- 7. NOTIFICATIONS - In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    body text,
    type text NOT NULL CHECK (type IN ('leave', 'payment', 'chat', 'announcement', 'selfie', 'lop', 'general')),
    reference_id uuid,
    reference_type text,
    is_read boolean DEFAULT false,
    action_url text,
    created_at timestamp with time zone DEFAULT now()
);

-- 8. ANNOUNCEMENT COMMENTS - Comments on announcements
CREATE TABLE IF NOT EXISTS public.announcement_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE public.company_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR COMPANY CALENDAR
DROP POLICY IF EXISTS "Everyone can view company calendar" ON public.company_calendar;
CREATE POLICY "Everyone can view company calendar" ON public.company_calendar
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage calendar" ON public.company_calendar;
CREATE POLICY "Admins can manage calendar" ON public.company_calendar
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo'))
    );

-- RLS POLICIES FOR ANNOUNCEMENTS
DROP POLICY IF EXISTS "Employees can view announcements" ON public.announcements;
CREATE POLICY "Employees can view announcements" ON public.announcements
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo'))
    );

-- RLS POLICIES FOR ANNOUNCEMENT READS
DROP POLICY IF EXISTS "Employees can manage own announcement reads" ON public.announcement_reads;
CREATE POLICY "Employees can manage own announcement reads" ON public.announcement_reads
    FOR ALL USING (auth.uid() = employee_id);

-- RLS POLICIES FOR TRANSPORT CLAIMS
DROP POLICY IF EXISTS "Employees can manage own transport claims" ON public.transport_claims;
CREATE POLICY "Employees can manage own transport claims" ON public.transport_claims
    FOR ALL USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR can view all transport claims" ON public.transport_claims;
CREATE POLICY "HR can view all transport claims" ON public.transport_claims
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo', 'accounts'))
    );

-- RLS POLICIES FOR TRANSPORT BOOKINGS
DROP POLICY IF EXISTS "Employees can manage own bookings" ON public.transport_bookings;
CREATE POLICY "Employees can manage own bookings" ON public.transport_bookings
    FOR ALL USING (auth.uid() = employee_id);

-- RLS POLICIES FOR PUSH TOKENS
DROP POLICY IF EXISTS "Employees can manage own push tokens" ON public.push_tokens;
CREATE POLICY "Employees can manage own push tokens" ON public.push_tokens
    FOR ALL USING (auth.uid() = employee_id);

-- RLS POLICIES FOR NOTIFICATIONS
DROP POLICY IF EXISTS "Employees can view own notifications" ON public.notifications;
CREATE POLICY "Employees can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can update own notifications" ON public.notifications;
CREATE POLICY "Employees can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- RLS POLICIES FOR ANNOUNCEMENT COMMENTS
DROP POLICY IF EXISTS "Employees can comment on announcements" ON public.announcement_comments;
CREATE POLICY "Employees can comment on announcements" ON public.announcement_comments
    FOR ALL USING (auth.uid() = employee_id);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_company_calendar_dates ON public.company_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON public.announcements(display_from, display_until);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_transport_claims_employee_date ON public.transport_claims(employee_id, claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_transport_claims_status ON public.transport_claims(status);
CREATE INDEX IF NOT EXISTS idx_notifications_employee_read ON public.notifications(employee_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- ENABLE REALTIME
BEGIN;
DROP PUBLICATION IF EXISTS mobile_comm_pub;
CREATE PUBLICATION mobile_comm_pub FOR TABLE company_calendar, announcements, announcement_reads, transport_claims, notifications;
COMMIT;

-- VIEW: Get active announcements for employee
CREATE OR REPLACE VIEW v_active_announcements AS
SELECT 
    a.id,
    a.title,
    a.content,
    a.priority,
    a.category,
    a.display_from,
    a.display_until,
    a.attachments,
    a.created_by,
    a.created_at,
    EXISTS (
        SELECT 1 FROM announcement_reads ar 
        WHERE ar.announcement_id = a.id 
        AND ar.employee_id = auth.uid()
    ) AS has_read
FROM announcements a
WHERE a.is_active = true
  AND a.display_from <= CURRENT_DATE
  AND (a.display_until IS NULL OR a.display_until >= CURRENT_DATE);

-- VIEW: Get transport claim summary
CREATE OR REPLACE VIEW v_transport_claim_summary AS
SELECT 
    employee_id,
    claim_type,
    status,
    COUNT(*) AS total_count,
    SUM(amount) AS total_amount
FROM transport_claims
WHERE claim_date >= date_trunc('month', CURRENT_DATE)
GROUP BY ROLLUP(employee_id, claim_type, status);