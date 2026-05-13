import { supabase } from './supabase';
import { getEmployeeId } from './supabase';

type RealtimeCallback = (payload: any) => void;

interface Subscription {
  id: string;
  channel: any;
  table: string;
}

class RealtimeService {
  private subscriptions: Map<string, Subscription> = new Map();
  private channel: any = null;

  async initialize(): Promise<void> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return;

    this.channel = supabase.channel(`mobile-user-${employeeId}`, {
      config: {
        presence: { key: employeeId },
      },
    });
  }

  subscribe(table: string, callback: RealtimeCallback): string {
    const subscriptionId = `${table}-${Date.now()}`;
    
    if (!this.channel) {
      this.initialize();
    }

    const channel = supabase
      .channel(`mobile-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`[Realtime] ${table} change:`, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${table} subscription status:`, status);
      });

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      channel: channel,
      table: table,
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.channel?.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((sub) => {
      sub.channel?.unsubscribe();
    });
    this.subscriptions.clear();
  }

  async subscribeToNotifications(callback: RealtimeCallback): Promise<string> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return '';

    return this.subscribe('notifications', async (payload) => {
      if (payload.new?.employee_id === employeeId) {
        callback(payload);
      }
    });
  }

  async subscribeToLeaveRequests(callback: RealtimeCallback): Promise<string> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return '';

    return this.subscribe('leave_requests', async (payload) => {
      if (payload.new?.employee_id === employeeId) {
        callback(payload);
      }
    });
  }

  async subscribeToChatMessages(channelId: string, callback: RealtimeCallback): Promise<string> {
    const subscriptionId = `chat-${channelId}-${Date.now()}`;

    const channel = supabase
      .channel(`chat-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log(`[Realtime] New chat message:`, payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      channel: channel,
      table: 'chat_messages',
    });

    return subscriptionId;
  }

  subscribeToAttendance(callback: RealtimeCallback): string {
    return this.subscribe('attendance_records', callback);
  }

  subscribeToDayPlans(callback: RealtimeCallback): string {
    return this.subscribe('day_plans', callback);
  }

  subscribeToPaymentRequests(callback: RealtimeCallback): string {
    return this.subscribe('payment_requests', callback);
  }

  subscribeToAnnouncements(callback: RealtimeCallback): string {
    return this.subscribe('announcements', callback);
  }

  subscribeToCompanyCalendar(callback: RealtimeCallback): string {
    return this.subscribe('company_calendar', callback);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  }

  async sendTypingIndicator(channelId: string, isTyping: boolean): Promise<void> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return;

    await supabase.from('chat_typing').upsert({
      channel_id: channelId,
      user_id: employeeId,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    });
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;