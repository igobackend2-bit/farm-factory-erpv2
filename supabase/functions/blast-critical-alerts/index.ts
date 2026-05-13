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
      console.error('Unauthorized access attempt to blast-critical-alerts');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting hourly criticals blast alert check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff time (45 minutes ago)
    const blastCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    // Find hourly criticals that need blast alerts
    // Condition: created_at older than 45m, not resolved, blast not already triggered
    const { data: criticalsToBreach, error: fetchError } = await supabase
      .from('hourly_criticals')
      .select('id, ticket_number, issue_title, issue_description, department, proof_url, created_by')
      .lt('created_at', blastCutoff)
      .is('blast_triggered_at', null)
      .not('status', 'in', '("resolved")');

    if (fetchError) {
      console.error('Error fetching criticals:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${criticalsToBreach?.length || 0} criticals requiring blast alerts`);

    if (!criticalsToBreach || criticalsToBreach.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No criticals to blast', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GM, Admin, and CEO users to notify
    const { data: notifyUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, role')
      .or('role.ilike.%gm%,role.ilike.%admin%,role.ilike.%ceo%');

    if (usersError) {
      console.error('Error fetching users to notify:', usersError);
    }

    // Process each critical
    for (const critical of criticalsToBreach) {
      console.log(`Triggering blast alert for critical #${critical.ticket_number}`);

      // Update critical status
      const { error: updateError } = await supabase
        .from('hourly_criticals')
        .update({
          blast_triggered_at: new Date().toISOString(),
          status: 'breached',
          blast_notified_gm: true,
          blast_notified_admin: true,
          blast_notified_ceo: true,
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
          action: 'blast_triggered',
          performed_by: null,
          performed_by_name: 'System',
          performed_by_role: 'System',
          details: {
            message: 'BLAST ALERT - 45 minute resolution deadline breached',
            blast_time: new Date().toISOString(),
          },
        });

      // Send high-priority notifications to GM, Admin, CEO
      for (const user of notifyUsers || []) {
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'critical_blast',
            title: '🚨 BLAST ALERT: Critical Breached',
            message: `URGENT: Critical #${critical.ticket_number} "${critical.issue_title}" has breached the 45-minute deadline! Department: ${critical.department}. Immediate attention required.`,
            role: user.role,
            related_record_id: critical.id,
          });

        console.log(`Blast notification sent to ${user.name} (${user.role})`);
      }
    }

    console.log(`Successfully triggered blast alerts for ${criticalsToBreach.length} criticals`);

    return new Response(
      JSON.stringify({
        message: 'Blast alerts completed',
        blastCount: criticalsToBreach.length,
        blastedIds: criticalsToBreach.map((c: any) => c.ticket_number),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in blast-critical-alerts function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
