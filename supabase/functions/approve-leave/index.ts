import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify identity
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

    // Get request body
    const { requestId, action, remarks, rejectionReason } = await req.json();

    if (!requestId || !action) {
      return new Response(JSON.stringify({ error: "Missing requestId or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's role
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = profile.role.toUpperCase();

    // Get the leave request
    const { data: leaveRequest, error: leaveError } = await adminClient
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (leaveError || !leaveRequest) {
      return new Response(JSON.stringify({ error: "Leave request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updateData: Record<string, unknown> = {};

    // Leave Workflow: Employee → HR → BOI → Admin → CEO (final)
    // Each role can only approve at their specific stage
    // CEO can approve at any stage (override)

    if (action === "approve") {
      // HR approval → moves to Admin
      if (role === "HR" && leaveRequest.status === "pending_hr") {
        updateData = {
          status: "pending_admin",
          hr_reviewed_by: user.id,
          hr_reviewed_at: new Date().toISOString(),
          hr_remarks: remarks || null,
        };
      }
      // BOI verification removed - HR bypasses directly to Admin
      // Admin approval → moves to CEO
      else if (role === "ADMIN" && leaveRequest.status === "pending_admin") {
        updateData = {
          status: "pending_ceo",
          admin_reviewed_by: user.id,
          admin_reviewed_at: new Date().toISOString(),
          admin_remarks: remarks || null,
        };
      }
      // CEO final approval
      else if (role === "CEO" && leaveRequest.status === "pending_ceo") {
        updateData = {
          status: "approved",
          ceo_reviewed_by: user.id,
          ceo_reviewed_at: new Date().toISOString(),
          ceo_remarks: remarks || null,
        };
      }
      // CEO can approve at any pending stage (override power)
      else if (role === "CEO" && ["pending_hr", "pending_boi", "pending_admin"].includes(leaveRequest.status)) {
        updateData = {
          status: "approved",
          ceo_reviewed_by: user.id,
          ceo_reviewed_at: new Date().toISOString(),
          ceo_remarks: remarks || null,
        };
      } else {
        return new Response(
          JSON.stringify({
            error: "Not authorized to approve this request at current stage",
            debug: { role, status: leaveRequest.status }
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (action === "reject") {
      // All authorized roles can reject at any stage
      if (!["HR", "BOI", "ADMIN", "CEO"].includes(role)) {
        return new Response(JSON.stringify({ error: "Not authorized to reject" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      updateData = {
        status: "rejected",
        rejected_by: user.id,
        rejection_reason: rejectionReason || "No reason provided",
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform the update using admin client
    const { error: updateError } = await adminClient
      .from("leave_requests")
      .update(updateData)
      .eq("id", requestId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: `Leave request ${action}ed successfully` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});