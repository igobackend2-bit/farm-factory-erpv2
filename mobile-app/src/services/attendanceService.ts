import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';

export interface AttendanceRecord {
  id?: string;
  employee_id?: string;
  date: string;
  clock_in_time?: string;
  clock_out_time?: string;
  clock_in_location?: any;
  clock_out_location?: any;
  clock_in_selfie_url?: string;
  clock_out_selfie_url?: string;
  clock_in_zone?: string;
  clock_out_zone?: string;
  status: 'pending' | 'present' | 'absent' | 'late' | 'on_leave';
  late_minutes?: number;
  work_hours?: number;
  is_remote?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayPlan {
  id?: string;
  employee_id?: string;
  date: string;
  plan_items: DayPlanItem[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed';
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayPlanItem {
  id: string;
  task: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: string;
}

export interface HourlyReport {
  id?: string;
  employee_id?: string;
  date: string;
  hour: number;
  report_type: 'work_done' | 'break' | 'meeting' | 'travel' | 'other';
  description?: string;
  location?: any;
  selfie_url?: string;
  task_reference_id?: string;
  project_id?: string;
  status: 'submitted' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

const getEmployeeId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

export const attendanceService = {
  async getTodayStatus(): Promise<AttendanceRecord | null> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return null;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Attendance] Error fetching today status:', error);
    }
    return data || null;
  },

  async clockIn(location: any, zone: string, selfieUrl?: string): Promise<{ data?: AttendanceRecord; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();
    
    const record: Partial<AttendanceRecord> = {
      employee_id: employeeId,
      date: today,
      clock_in_time: now,
      clock_in_location: location,
      clock_in_zone: zone,
      clock_in_selfie_url: selfieUrl,
      status: 'present',
    };

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(record, { onConflict: 'employee_id,date' })
      .select()
      .single();

    return { data, error };
  },

  async clockOut(location: any, zone: string, selfieUrl?: string): Promise<{ data?: AttendanceRecord; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date().toISOString();
    
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (!existing) {
      return { error: { message: 'Not clocked in' } };
    }

    const clockInTime = new Date(existing.clock_in_time || now);
    const clockOutTime = new Date(now);
    const hoursDiff = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        clock_out_time: now,
        clock_out_location: location,
        clock_out_zone: zone,
        clock_out_selfie_url: selfieUrl,
        work_hours: Math.round(hoursDiff * 100) / 100,
      })
      .eq('id', existing.id)
      .select()
      .single();

    return { data, error };
  },

  async getHistory(startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[Attendance] Error fetching history:', error);
    }
    return data || [];
  },
};

export const dayPlanService = {
  async getToday(): Promise<DayPlan | null> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return null;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('day_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[DayPlan] Error fetching today:', error);
    }
    return data || null;
  },

  async create(planItems: DayPlanItem[]): Promise<{ data?: DayPlan; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const record: Partial<DayPlan> = {
      employee_id: employeeId,
      date: today,
      plan_items: planItems,
      status: 'draft',
    };

    const { data, error } = await supabase
      .from('day_plans')
      .upsert(record, { onConflict: 'employee_id,date' })
      .select()
      .single();

    return { data, error };
  },

  async submit(): Promise<{ data?: DayPlan; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('day_plans')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('employee_id', employeeId)
      .eq('date', today)
      .select()
      .single();

    return { data, error };
  },

  async updateItem(itemId: string, updates: Partial<DayPlanItem>): Promise<{ data?: DayPlan; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: existing } = await supabase
      .from('day_plans')
      .select('plan_items')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (!existing) {
      return { error: { message: 'No plan for today' } };
    }

    const updatedItems = existing.plan_items.map((item: DayPlanItem) => 
      item.id === itemId ? { ...item, ...updates } : item
    );

    const { data, error } = await supabase
      .from('day_plans')
      .update({ plan_items: updatedItems })
      .eq('employee_id', employeeId)
      .eq('date', today)
      .select()
      .single();

    return { data, error };
  },

  async getHistory(startDate?: string, endDate?: string): Promise<DayPlan[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('day_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[DayPlan] Error fetching history:', error);
    }
    return data || [];
  },
};

export const hourlyReportService = {
  async getToday(): Promise<HourlyReport[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('hourly_reports')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .order('hour', { ascending: true });

    if (error) {
      console.error('[HourlyReport] Error fetching today:', error);
    }
    return data || [];
  },

  async submit(report: Partial<HourlyReport>): Promise<{ data?: HourlyReport; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const today = format(new Date(), 'yyyy-MM-dd');
    const currentHour = new Date().getHours();
    
    const record: Partial<HourlyReport> = {
      employee_id: employeeId,
      date: today,
      hour: report.hour || currentHour,
      report_type: report.report_type || 'work_done',
      description: report.description,
      location: report.location,
      selfie_url: report.selfie_url,
      task_reference_id: report.task_reference_id,
      project_id: report.project_id,
      status: 'submitted',
    };

    const { data, error } = await supabase
      .from('hourly_reports')
      .upsert(record, { onConflict: 'employee_id,date,hour,report_type' })
      .select()
      .single();

    return { data, error };
  },

  async getHistory(date: string): Promise<HourlyReport[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('hourly_reports')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .order('hour', { ascending: true });

    if (error) {
      console.error('[HourlyReport] Error fetching history:', error);
    }
    return data || [];
  },
};