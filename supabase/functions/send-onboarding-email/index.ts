// @ts-nocheck - Deno Edge Function
/// <reference types="https://esm.sh/@supabase/supabase-js@2.49.1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

/**
 * Send onboarding invitation email using Resend API
 */
async function sendOnboardingEmail(
    resendApiKey: string,
    toEmail: string,
    fullName: string,
    username: string,
    password: string,
    activationLink: string
) {
    const emailSubject = "Complete Your Onboarding - IGO Agritech Farms";
    const emailBody = `Dear ${fullName},

You have been selected at IGO Agritech Farms.

Your login account has been created successfully.

Email: ${toEmail}
Username: ${username}
Password: ${password}

Please complete your onboarding using the link below before ERP access is enabled:

${activationLink}

After HR verification, your account will be activated.

Regards,
IGO Agritech Farms`;

    try {
        console.log(`[Email] Sending onboarding email to ${toEmail}...`);
        
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "IGO Agritech Farms <onboarding@resend.dev>",
                to: [toEmail],
                subject: emailSubject,
                text: emailBody,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Email] API error:", errorText);
            return { success: false, error: errorText };
        }

        const data = await response.json();
        console.log(`[Email] Sent successfully to ${toEmail}, id:`, data.id);
        return { success: true, data };
    } catch (error) {
        console.error("[Email] Sending error:", error);
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

        const { fullName, email, username, password, activationLink } = await req.json();

        if (!fullName || !email || !username || !activationLink) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(
                JSON.stringify({ error: "Invalid email format" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Send email
        let emailResult = { success: false, error: "Resend API key not configured" };
        
        if (resendApiKey) {
            emailResult = await sendOnboardingEmail(
                resendApiKey,
                email,
                fullName,
                username,
                password || "", // Password might be empty for resends
                activationLink
            );
        } else {
            console.warn("[Email] Resend API key not configured");
        }

        return new Response(
            JSON.stringify({
                success: emailResult.success,
                emailSent: emailResult.success,
                error: emailResult.error || null,
            }),
            { status: emailResult.success ? 200 : 500, headers: corsHeaders }
        );

    } catch (error) {
        console.error("[SendEmail] Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: `Internal server error: ${error.message}` }),
            { status: 500, headers: corsHeaders }
        );
    }
});
