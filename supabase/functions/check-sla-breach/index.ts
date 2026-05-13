// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Priority-based SLA configuration
const PRIORITY_SLA: Record<string, { slaHours: number; l2ThresholdMin: number; l3ThresholdMin: number }> = {
  P0: { slaHours: 2, l2ThresholdMin: 60, l3ThresholdMin: 90 },     // 2h total, L2 at 1h, L3 at 1.5h
  P1: { slaHours: 4, l2ThresholdMin: 120, l3ThresholdMin: 180 },    // 4h total, L2 at 2h, L3 at 3h
  P2: { slaHours: 12, l2ThresholdMin: 360, l3ThresholdMin: 600 },   // 12h total, L2 at 6h, L3 at 10h
  P3: { slaHours: 24, l2ThresholdMin: 720, l3ThresholdMin: 1200 },  // 24h total, L2 at 12h, L3 at 20h
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate authorization
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    const hasValidServiceKey = authHeader && authHeader.includes(serviceKey.substring(0, 20));
    const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;

    if (!hasValidServiceKey && !hasValidCronSecret) {
      console.error('Unauthorized access attempt to check-sla-breach');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting enhanced SLA breach check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Mark overdue escalations via DB function
    const { data: overdueCount } = await supabase.rpc('mark_overdue_escalations');
    console.log(`Marked ${overdueCount || 0} new overdue escalations`);

    // Step 2: Find escalations that need level advancement
    const { data: activeEscalations, error: fetchError } = await supabase
      .from('client_escalations')
      .select('*, project:projects(project_name)')
      .not('status', 'in', '("resolved","closed","pending_closure_approval")')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching escalations:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${activeEscalations?.length || 0} active escalations to check`);

    if (!activeEscalations || activeEscalations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active escalations to check', overdueMarked: overdueCount || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let escalatedCount = 0;

    for (const escalation of activeEscalations) {
      const priorityLevel = escalation.priority_level || 'P2';
      const config = PRIORITY_SLA[priorityLevel] || PRIORITY_SLA.P2;

      const createdAt = new Date(escalation.created_at).getTime();
      const now = Date.now();
      const elapsedMin = Math.floor((now - createdAt) / (1000 * 60));

      let nextLevel = escalation.current_level || 'L1_OPS';
      let nextOwner = escalation.current_owner;
      let shouldUpdate = false;

      // Level Advancement Logic based on priority thresholds
      if ((nextLevel === 'L1_OPS' || !nextLevel) && elapsedMin >= config.l2ThresholdMin) {
        nextLevel = 'L2_GM';
        nextOwner = 'gm';
        shouldUpdate = true;
      }

      if (nextLevel === 'L2_GM' && elapsedMin >= config.l3ThresholdMin) {
        nextLevel = 'L3_CEO';
        nextOwner = 'ceo';
        shouldUpdate = true;
      }

      // Skip if already at L3 or no change needed
      if (!shouldUpdate) continue;

      // Check if already at this level (prevent duplicate escalations)
      if (escalation.current_level === nextLevel) continue;

      const updateData: any = {
        current_level: nextLevel,
        current_owner: nextOwner,
        is_overdue: elapsedMin >= config.slaHours * 60,
        updated_at: new Date().toISOString(),
      };

      if (nextLevel === 'L2_GM' && !escalation.forwarded_to_gm_at) {
        updateData.forwarded_to_gm_at = new Date().toISOString();
        updateData.status = 'escalated_gm';
      } else if (nextLevel === 'L3_CEO' && !escalation.pushed_to_ceo_at) {
        updateData.pushed_to_ceo_at = new Date().toISOString();
        updateData.status = 'escalated_ceo';
      }

      const { error: updateError } = await supabase
        .from('client_escalations')
        .update(updateData)
        .eq('id', escalation.id);

      if (updateError) {
        console.error(`Error updating escalation ${escalation.id}:`, updateError);
        continue;
      }

      escalatedCount++;

      // Add timeline entry
      await supabase
        .from('client_escalation_timeline')
        .insert({
          escalation_id: escalation.id,
          action: `auto_escalated_to_${nextLevel.toLowerCase()}`,
          performed_by: null,
          performed_by_name: 'Escalation Engine',
          performed_by_role: 'System',
          details: {
            message: `Auto-escalated to ${nextLevel} after ${elapsedMin}min (${priorityLevel} SLA: ${config.slaHours}h)`,
            elapsed_minutes: elapsedMin,
            priority_level: priorityLevel,
            sla_hours: config.slaHours,
            threshold_minutes: nextLevel === 'L2_GM' ? config.l2ThresholdMin : config.l3ThresholdMin,
          },
        });

      // Notify the new owner
      const notifyRoles = nextLevel === 'L2_GM' ? ['GM', 'admin'] : ['CEO', 'admin'];
      const { data: usersToNotify } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', notifyRoles);

      for (const user of usersToNotify || []) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'sla_breach',
          title: `🚨 ${priorityLevel} Escalation → ${nextLevel}`,
          message: `Ticket #${escalation.ticket_number} (${escalation.issue_title}) auto-escalated to ${nextLevel} after ${elapsedMin}min.`,
          role: user.role,
          related_record_id: escalation.id,
        });
      }
    }

    console.log(`Successfully processed: ${escalatedCount} escalated, ${overdueCount || 0} newly overdue`);

    return new Response(
      JSON.stringify({
        message: 'Enhanced SLA breach check completed',
        escalatedCount,
        overdueMarked: overdueCount || 0,
        totalChecked: activeEscalations.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-sla-breach function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
