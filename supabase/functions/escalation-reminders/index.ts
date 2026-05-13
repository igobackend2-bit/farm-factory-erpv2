// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    const hasValidServiceKey = authHeader && authHeader.includes(serviceKey.substring(0, 20));
    const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;

    if (!hasValidServiceKey && !hasValidCronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running Escalation Auto-Reminders...');

    // Fetch active escalations
    const { data: escalations, error: fetchError } = await supabase
      .from('client_escalations')
      .select('*, creator:profiles!client_escalations_created_by_fkey(name), assigned_user:profiles!client_escalations_assigned_user_id_fkey(id, name, role)')
      .not('status', 'in', '("resolved","closed","pending_closure_approval")');

    if (fetchError) throw fetchError;

    let reminderCount = 0;
    const now = new Date();

    for (const esc of escalations || []) {
      const deadline = new Date(esc.resolve_deadline);
      const diffMs = deadline.getTime() - now.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      
      let shouldRemind = false;
      let reminderMsg = '';

      if (diffMin > 0) {
        // PROACTIVE REMINDERS
        if (diffMin <= 5 && (esc.reminder_count === 2 || !esc.last_reminder_sent_at)) {
          shouldRemind = true;
          reminderMsg = `🚨 FINAL WARNING: Ticket #${esc.ticket_number} breaches in 5 minutes!`;
          esc.reminder_count = 3;
        } else if (diffMin <= 15 && diffMin > 5 && (esc.reminder_count === 1 || !esc.last_reminder_sent_at)) {
          shouldRemind = true;
          reminderMsg = `⚠️ URGENT: Ticket #${esc.ticket_number} breaches in 15 minutes!`;
          esc.reminder_count = 2;
        } else if (diffMin <= 30 && diffMin > 15 && (esc.reminder_count === 0)) {
          shouldRemind = true;
          reminderMsg = `⏳ NUDGE: Ticket #${esc.ticket_number} breaches in 30 minutes.`;
          esc.reminder_count = 1;
        }
      } else {
        // OVERDUE REMINDERS (Periodic)
        const lastRemindedAt = esc.last_reminder_sent_at ? new Date(esc.last_reminder_sent_at) : deadline;
        const overdueElapsedMin = Math.floor((now.getTime() - lastRemindedAt.getTime()) / (1000 * 60));
        
        // P0/P1: Remind every 30m | P2/P3: Remind every 60m
        const interval = (esc.priority_level === 'P0' || esc.priority_level === 'P1') ? 30 : 60;
        
        if (overdueElapsedMin >= interval) {
          shouldRemind = true;
          reminderMsg = `🔥 OVERDUE: Ticket #${esc.ticket_number} is breached! Immediate resolution required.`;
          esc.reminder_count = (esc.reminder_count || 3) + 1;
        }
      }

      if (shouldRemind) {
        console.log(`Sending reminder for Ticket #${esc.ticket_number}`);
        
        // 1. Send In-App Notification to Assignees
        const assignees = esc.assigned_user_ids || [esc.assigned_user_id].filter(Boolean);
        if (assignees.length > 0) {
          const notifications = assignees.map(uid => ({
            user_id: uid,
            type: 'escalation_reminder',
            title: 'SLA Reminder',
            content: reminderMsg,
            metadata: { escalation_id: esc.id },
            is_read: false
          }));
          await supabase.from('notifications').insert(notifications);
        }

        // 2. Update Escalation State
        await supabase
          .from('client_escalations')
          .update({
            reminder_count: esc.reminder_count,
            last_reminder_sent_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', esc.id);

        // 3. Log to Timeline
        await supabase.from('client_escalation_timeline').insert({
          escalation_id: esc.id,
          action: 'auto_reminder_sent',
          performed_by_name: 'Escalation Engine',
          performed_by_role: 'System',
          details: { message: reminderMsg, reminder_count: esc.reminder_count }
        });

        reminderCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, remindersSent: reminderCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in escalation-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
