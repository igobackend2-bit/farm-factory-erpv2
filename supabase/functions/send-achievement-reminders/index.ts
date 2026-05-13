import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get current time
        const now = new Date()

        // 2. Find deadlines due in the next 24 hours that haven't had reminders sent
        const { data: upcomingDeadlines, error: deadlinesError } = await supabaseClient
            .from('achievement_deadlines')
            .select('*')
            .eq('reminder_sent', false)
            .lte('submission_deadline', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
            .gte('submission_deadline', now.toISOString())

        if (deadlinesError) throw deadlinesError

        const notifications = []

        for (const deadline of upcomingDeadlines) {
            // Find core heads who haven't submitted for this week
            const { data: pendingAchievements, error: achievementsError } = await supabaseClient
                .from('weekly_achievements')
                .select(`
          core_head_id,
          profiles:core_head_id(name, email)
        `)
                .eq('week_start_date', deadline.week_start_date)
                .eq('is_submitted', false)

            if (achievementsError) continue

            for (const achievement of pendingAchievements) {
                notifications.push({
                    user_id: achievement.core_head_id,
                    title: 'Achievement Deadline Reminder',
                    message: `Friendly reminder: Your achievements for Week ${deadline.week_number} are due by ${new Date(deadline.submission_deadline).toLocaleString()}.`,
                    type: 'core_head_reminder',
                    link: '/core-head/achievements'
                })
            }

            // Mark reminder as sent
            await supabaseClient
                .from('achievement_deadlines')
                .update({
                    reminder_sent: true,
                    reminder_sent_at: now.toISOString()
                })
                .eq('id', deadline.id)
        }

        // 3. Batch insert notifications
        if (notifications.length > 0) {
            const { error: notifyError } = await supabaseClient
                .from('notifications')
                .insert(notifications)

            if (notifyError) throw notifyError
        }

        return new Response(
            JSON.stringify({
                message: `Reminders sent to ${notifications.length} users across ${upcomingDeadlines.length} week(s).`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
