// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Broadcast calendar event (holiday/event) to all 96 users
// Called when admin saves a new calendar event

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin/CEO
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user role
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "ceo", "ADMIN", "CEO"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Only Admin/CEO can broadcast" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get event details from request
    const { date, title, eventType, description } = await req.json();

    if (!date || !title || !eventType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active users
    const { data: allUsers, error: usersError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("is_active", true);

    if (usersError) {
      throw usersError;
    }

    console.log(`📅 Broadcasting ${eventType} to ${allUsers?.length} users`);

    // Format date for message
    const eventDate = new Date(date);
    const formattedDate = eventDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Create notification for each user
    const notifications = (allUsers || []).map((u: any) => ({
      user_id: u.id,
      role: u.role,
      type: "calendar_event",
      title: `📅 ALERT: ${eventType === 'holiday' ? 'Holiday' : 'Company Event'}`,
      message: `${formattedDate} has been declared a ${eventType}. ${title}. ${description || ''}`,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // Batch insert notifications
    const { error: notifError } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Notification error:", notifError);
    }

    console.log(`✅ Broadcast complete to ${notifications.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Broadcast sent to ${notifications.length} users`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Broadcast error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
