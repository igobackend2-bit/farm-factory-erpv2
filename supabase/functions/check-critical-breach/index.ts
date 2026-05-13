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
    // SECURITY: Validate authorization - REJECT if unauthorized
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    // Check for valid authentication: either service role key or cron secret
    const hasValidServiceKey = authHeader && authHeader.includes(serviceKey.substring(0, 20));
    const hasValidCronSecret = expectedCronSecret && cronSecret === expectedCronSecret;

    if (!hasValidServiceKey && !hasValidCronSecret) {
      console.error('Unauthorized access attempt to check-critical-breach');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Hourly Criticals breach check (45-min SLA)...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find hourly criticals that are open/acknowledged and past their 45-min deadline
    const { data: breachedCriticals, error: fetchError } = await supabase
      .from('hourly_criticals')
      .select(`
        *,
        creator:profiles!hourly_criticals_created_by_fkey(name, email)
      `)
      .in('status', ['open', 'acknowledged'])
      .is('blast_triggered_at', null)
      .lt('resolve_deadline', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching hourly criticals:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${breachedCriticals?.length || 0} breached hourly criticals`);

    if (!breachedCriticals || breachedCriticals.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No critical breaches found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GM, Admin, and CEO users for blast notifications
    const { data: blastUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, role, email')
      .or('role.ilike.%gm%,role.ilike.%admin%,role.ilike.%ceo%');

    if (usersError) {
      console.error('Error fetching blast users:', usersError);
    }

    const gmUsers = blastUsers?.filter((u: any) => u.role.toLowerCase().includes('gm')) || [];
    const adminUsers = blastUsers?.filter((u: any) => u.role.toLowerCase() === 'admin') || [];
    const ceoUsers = blastUsers?.filter((u: any) => u.role.toLowerCase() === 'ceo') || [];

    // Process each breached critical
    for (const critical of breachedCriticals) {
      console.log(`🚨 BLAST PROTOCOL: Critical #${critical.ticket_number} - ${critical.issue_title}`);

      // Calculate overdue time
      const resolveDeadline = new Date(critical.resolve_deadline);
      const now = new Date();
      const overdueMinutes = Math.floor((now.getTime() - resolveDeadline.getTime()) / (1000 * 60));

      // Update critical with blast triggered info and level elevation
      const { error: updateError } = await supabase
        .from('hourly_criticals')
        .update({
          blast_triggered_at: new Date().toISOString(),
          blast_notified_gm: gmUsers.length > 0,
          blast_notified_admin: adminUsers.length > 0,
          blast_notified_ceo: ceoUsers.length > 0,
          status: 'breached',
          current_level: 'L3_CEO',
          current_owner: 'ceo',
          updated_at: new Date().toISOString()
        })
        .eq('id', critical.id);

      if (updateError) {
        console.error(`Error updating critical ${critical.id}:`, updateError);
        continue;
      }

      // Add timeline entry
      await supabase
        .from('hourly_critical_timeline')
        .insert({
          critical_id: critical.id,
          action: 'critical_blast_triggered',
          performed_by: null,
          performed_by_name: 'Escalation Engine',
          performed_by_role: 'System',
          details: {
            message: '🚨 BLAST PROTOCOL TRIGGERED: Level advanced to L3_CEO',
            resolve_deadline: critical.resolve_deadline,
            blast_time: new Date().toISOString(),
            overdue_minutes: overdueMinutes,
          },
        });

      // Send blast notifications to all three levels simultaneously
      const notificationMessage = `🚨 CRITICAL BREACH: Ticket #${critical.ticket_number} - ${critical.issue_title}
Department: ${critical.department}
Overdue: ${overdueMinutes} minutes
Proof: ${critical.proof_url}
Issue: ${critical.issue_description.substring(0, 150)}...`;

      // Notify GM
      for (const user of gmUsers) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'critical_blast',
          title: '🚨 CRITICAL BLAST: Unresolved > 45 mins',
          message: notificationMessage,
          role: user.role,
          related_record_id: critical.id,
        });
        console.log(`Blast sent to GM: ${user.name}`);
      }

      // Notify Admin
      for (const user of adminUsers) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'critical_blast',
          title: '🚨 CRITICAL BLAST: Unresolved > 45 mins',
          message: notificationMessage,
          role: user.role,
          related_record_id: critical.id,
        });
        console.log(`Blast sent to Admin: ${user.name}`);
      }

      // Notify CEO
      for (const user of ceoUsers) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'critical_blast',
          title: '🚨 CRITICAL BLAST: Unresolved > 45 mins',
          message: notificationMessage,
          role: user.role,
          related_record_id: critical.id,
        });
        console.log(`Blast sent to CEO: ${user.name}`);
      }
    }

    console.log(`✅ Blast protocol completed for ${breachedCriticals.length} criticals`);

    return new Response(
      JSON.stringify({
        message: 'Critical breach check completed',
        breachCount: breachedCriticals.length,
        breachedTickets: breachedCriticals.map((c: any) => c.ticket_number),
        notifiedGM: gmUsers.length,
        notifiedAdmin: adminUsers.length,
        notifiedCEO: ceoUsers.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-critical-breach function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
