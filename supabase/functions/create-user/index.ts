// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Get the authorization header from the request
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create client with user's JWT to verify they're authenticated
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Validate the JWT using getUser
        const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !requestingUser) {
            console.error("JWT validation failed:", authError);
            return new Response(
                JSON.stringify({ error: "Unauthorized - Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify the user is an admin
        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("role, name")
            .eq("id", requestingUser.id)
            .single();

        if (profileError || !profile) {
            console.error("Profile fetch error:", profileError);
            return new Response(
                JSON.stringify({ error: "Failed to verify user role" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (profile.role.toLowerCase() !== "admin") {
            return new Response(
                JSON.stringify({ error: "Only admins can create users" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user details from request body
        const { email, password, name, role, department, employeeId } = await req.json();

        if (!email || !password || !name || !role) {
            return new Response(
                JSON.stringify({ error: "Missing required fields (email, password, name, role)" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create admin client with service role to create user
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        console.log(`Creating new user: ${email} (${name})`);

        // --- STEP 1: CREATE AUTH USER ---
        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: {
                name: name.trim(),
                role: role,
                department: department,
                office_number: employeeId?.trim() || null,
            }
        });

        if (createError) {
            console.error("Error creating auth user:", createError);
            return new Response(
                JSON.stringify({ error: createError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const newUser = authData.user;
        console.log(`Auth user created successfully: ${newUser.id}`);

        // --- STEP 2: CREATE PROFILE ---
        // Note: Some systems have a database trigger for this, but let's be explicit and handle it if not.
        // We'll use upsert to handle cases where a trigger might have already fired.
        const { error: profileInsertError } = await adminClient
            .from("profiles")
            .upsert({
                id: newUser.id,
                name: name.trim(),
                email: email.trim(),
                role: role,
                department: department,
                office_number: employeeId?.trim() || null,
                is_active: true,
            });

        if (profileInsertError) {
            console.error("Error creating profile:", profileInsertError);
            // We don't rollback auth user creation as it's complex, but we notify
            return new Response(
                JSON.stringify({
                    error: `User created in Auth, but Profile creation failed: ${profileInsertError.message}`,
                    userId: newUser.id
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- STEP 3: LOG TRANSACTION ---
        await adminClient.from("audit_logs").insert({
            action: "USER_CREATED",
            performed_by: requestingUser.id,
            performed_by_name: profile.name,
            performed_by_role: "Admin",
            record_type: "profile",
            record_id: newUser.id,
            after_state: {
                email: email.trim(),
                name: name.trim(),
                role: role,
                department: department,
            },
            remarks: `New user ${name} (${email}) created by admin. Password auto-set.`,
        });

        return new Response(
            JSON.stringify({ success: true, message: "User created successfully", userId: newUser.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
