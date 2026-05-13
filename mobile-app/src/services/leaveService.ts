import { supabase } from './supabase';
import { format, differenceInDays } from 'date-fns';

export interface LeaveRequest {
  id?: string;
  employee_id?: string;
  leave_type: 'annual' | 'sick' | 'casual' | 'unpaid' | 'work_from_home' | 'half_day' | 'other';
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  is_emergency?: boolean;
  alternate_contact?: string;
  handover_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveBalance {
  id?: string;
  employee_id?: string;
  leave_type: 'annual' | 'sick' | 'casual';
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
}

export interface LOPEntry {
  id?: string;
  employee_id?: string;
  leave_request_id?: string;
  date: string;
  half_day?: boolean;
  amount?: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_generated';
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
}

const getEmployeeId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

const calculateWorkingDays = (startDate: string, endDate: string): number => {
  return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
};

export const leaveService = {
  async getBalance(year?: number): Promise<LeaveBalance[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const targetYear = year || new Date().getFullYear();
    
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', targetYear);

    if (error) {
      console.error('[Leave] Error fetching balance:', error);
    }
    return data || [];
  },

  async getRequests(status?: string): Promise<LeaveRequest[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[Leave] Error fetching requests:', error);
    }
    return data || [];
  },

  async request(leave: Partial<LeaveRequest>): Promise<{ data?: LeaveRequest; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const totalDays = leave.total_days || calculateWorkingDays(leave.start_date!, leave.end_date!);
    
    const record: Partial<LeaveRequest> = {
      employee_id: employeeId,
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      total_days: totalDays,
      reason: leave.reason,
      is_emergency: leave.is_emergency || false,
      alternate_contact: leave.alternate_contact,
      handover_notes: leave.handover_notes,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('leave_requests')
      .insert(record)
      .select()
      .single();

    return { data, error };
  },

  async cancel(requestId: string): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('employee_id', employeeId)
      .eq('status', 'pending');

    return { error };
  },

  async getUpcoming(): Promise<LeaveRequest[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[Leave] Error fetching upcoming:', error);
    }
    return data || [];
  },
};

export const lopService = {
  async getEntries(year?: number): Promise<LOPEntry[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('lop_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false });

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.gte('date', startOfYear).lte('date', endOfYear);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[LOP] Error fetching entries:', error);
    }
    return data || [];
  },

  async requestReversal(lopEntryId: string, reason: string): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('lop_reversal_requests')
      .insert({
        employee_id: employeeId,
        lop_entry_id: lopEntryId,
        reason: reason,
        status: 'pending',
      });

    return { error };
  },

  async getPendingReversals(): Promise<any[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('lop_reversal_requests')
      .select('*, lop_entries(*)')
      .eq('employee_id', employeeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LOP] Error fetching pending reversals:', error);
    }
    return data || [];
  },
};

export const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  casual: 'Casual Leave',
  unpaid: 'Unpaid Leave',
  work_from_home: 'Work From Home',
  half_day: 'Half Day',
  other: 'Other',
};

export const leaveTypeColors: Record<string, string> = {
  annual: '#2563eb',
  sick: '#dc2626',
  casual: '#16a34a',
  unpaid: '#71717a',
  work_from_home: '#7c3aed',
  half_day: '#ea580c',
  other: '#52525b',
};