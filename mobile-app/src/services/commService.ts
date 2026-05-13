import { supabase } from './supabase';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface CompanyEvent {
  id?: string;
  title: string;
  description?: string;
  event_type: 'holiday' | 'meeting' | 'event' | 'deadline' | 'other';
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  organizer_id?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  visibility?: 'all' | 'department' | 'role' | 'specific';
  created_at?: string;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: 'general' | 'hr' | 'it' | 'finance' | 'operations' | 'safety';
  display_from?: string;
  display_until?: string;
  attachments?: any[];
  created_by?: string;
  is_active?: boolean;
  has_read?: boolean;
  created_at?: string;
}

export interface Notification {
  id?: string;
  employee_id?: string;
  title: string;
  body?: string;
  type: 'leave' | 'payment' | 'chat' | 'announcement' | 'selfie' | 'lop' | 'general';
  reference_id?: string;
  reference_type?: string;
  is_read?: boolean;
  action_url?: string;
  created_at?: string;
}

const getEmployeeId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

export const calendarService = {
  async getEvents(month?: Date): Promise<CompanyEvent[]> {
    const targetMonth = month || new Date();
    const start = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(targetMonth), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('company_calendar')
      .select('*')
      .or(`start_date.lte.${end},end_date.gte.${start})`)
      .or(`start_date.gte.${start},start_date.lte.${end})`)
      .order('start_date');

    if (error) {
      console.error('[Calendar] Error fetching events:', error);
    }
    return data || [];
  },

  async getHolidays(year?: number): Promise<CompanyEvent[]> {
    const targetYear = year || new Date().getFullYear();
    const start = `${targetYear}-01-01`;
    const end = `${targetYear}-12-31`;
    
    const { data, error } = await supabase
      .from('company_calendar')
      .select('*')
      .eq('event_type', 'holiday')
      .or(`start_date.gte.${start},start_date.lte.${end})`)
      .order('start_date');

    if (error) {
      console.error('[Calendar] Error fetching holidays:', error);
    }
    return data || [];
  },

  async getUpcoming(limit: number = 5): Promise<CompanyEvent[]> {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('company_calendar')
      .select('*')
      .gte('start_date', today)
      .order('start_date')
      .limit(limit);

    if (error) {
      console.error('[Calendar] Error fetching upcoming:', error);
    }
    return data || [];
  },

  isTodayHoliday(events: CompanyEvent[]): CompanyEvent | null {
    const today = format(new Date(), 'yyyy-MM-dd');
    return events.find(e => 
      e.event_type === 'holiday' && 
      e.start_date <= today && 
      (e.end_date ? e.end_date >= today : e.start_date === today)
    ) || null;
  },

  getEventTypeColor(type: string): string {
    const colors: Record<string, string> = {
      holiday: '#16a34a',
      meeting: '#2563eb',
      event: '#7c3aed',
      deadline: '#dc2626',
      other: '#71717a',
    };
    return colors[type] || '#71717a';
  },
};

export const announcementService = {
  async getActive(): Promise<Announcement[]> {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .lte('display_from', today)
      .or(`display_until.is.null,display_until.gte.${today})`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Announcement] Error fetching:', error);
    }
    return data || [];
  },

  async getUnread(): Promise<Announcement[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: announcements, error: annError } = await supabase
      .from('announcements')
      .select('id, title, content, priority, category, display_from, created_at')
      .eq('is_active', true)
      .lte('display_from', today)
      .or(`display_until.is.null,display_until.gte.${today})`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (annError) {
      console.error('[Announcement] Error fetching:', annError);
      return [];
    }

    if (!announcements?.length) return [];

    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('employee_id', employeeId);

    const readIds = new Set(reads?.map(r => r.announcement_id) || []);
    return announcements.filter(a => !readIds.has(a.id));
  },

  async markAsRead(announcementId: string): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('announcement_reads')
      .upsert({
        announcement_id: announcementId,
        employee_id: employeeId,
        read_at: new Date().toISOString(),
      }, { onConflict: 'announcement_id,employee_id' });

    return { error };
  },

  async getCount(): Promise<number> {
    const unread = await this.getUnread();
    return unread.length;
  },
};

export const notificationService = {
  async getAll(limit: number = 50): Promise<Notification[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Notification] Error fetching:', error);
    }
    return data || [];
  },

  async getUnread(): Promise<Notification[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Notification] Error fetching unread:', error);
    }
    return data || [];
  },

  async markAsRead(notificationId: string): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('employee_id', employeeId);

    return { error };
  },

  async markAllAsRead(): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('employee_id', employeeId)
      .eq('is_read', false);

    return { error };
  },

  async getUnreadCount(): Promise<number> {
    const unread = await this.getUnread();
    return unread.length;
  },

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      leave: 'calendar',
      payment: 'credit-card',
      chat: 'message-circle',
      announcement: 'bell',
      selfie: 'camera',
      lop: 'AlertCircle',
      general: 'info',
    };
    return icons[type] || 'bell';
  },

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      leave: '#2563eb',
      payment: '#16a34a',
      chat: '#7c3aed',
      announcement: '#f59e0b',
      selfie: '#ec4899',
      lop: '#dc2626',
      general: '#71717a',
    };
    return colors[type] || '#71717a';
  },
};

export const transportService = {
  async getClaims(status?: string): Promise<any[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('transport_claims')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[Transport] Error fetching claims:', error);
    }
    return data || [];
  },

  async submitClaim(claim: {
    claim_type: string;
    amount: number;
    description?: string;
    from_location?: string;
    to_location?: string;
    distance_km?: number;
    receipt_url?: string;
  }): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('transport_claims')
      .insert({
        employee_id: employeeId,
        claim_date: format(new Date(), 'yyyy-MM-dd'),
        ...claim,
        status: 'pending',
      });

    return { error };
  },
};