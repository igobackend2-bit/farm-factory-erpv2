/**
 * Complete Onboarding - Atomic Version (Production Hardened)
 *
 * This Edge Function completes an existing onboarding request atomically:
 * 1. Creates Supabase Auth user (or returns existing)
 * 2. Creates/updates profile entry
 * 3. Updates onboarding record
 * 4. SENDS EMAIL (mandatory - fails if email fails)
 *
 * CRITICAL GUARANTEE:
 * If email succeeds, function ALWAYS returns success (200)
 * Even if final DB updates fail - we log them but don't fail the request
 *
 * IDEMPOTENCY:
 * - If record already completed → returns success immediately
 * - If user already exists → returns success with existing user info
 *
 * STEP STRUCTURE:
 * - validateRequest()
 * - authenticateAdmin()
 * - fetchOnboardingRecord() (with idempotency check)
 * - createOrGetUser()
 * - upsertProfile()
 * - updateOnboardingBeforeEmail()
 * - sendEmail()
 * - finalizeUpdate()
 * - returnResponse()
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper functions
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateTimestamp(): string {
  return new Date().toISOString();
}

function logStep(step: string, data?: any) {
  const timestamp = generateTimestamp();
  if (data) {
    console.log(`[${timestamp}] complete-onboarding-atomic [${step}]:`, data);
  } else {
    console.log(`[${timestamp}] complete-onboarding-atomic [${step}]`);
  }
}

function successResponse(data: any) {
  return new Response(
    JSON.stringify({
      success: true,
      ...data,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function errorResponse(step: string, message: string, details?: string, status = 500) {
  const response = {
    success: false,
    error: message,  // Always include 'error' field for consistency
    message,
    step,
    details: details || null,
  };
  console.error(`[complete-onboarding-atomic] Error response [${step}]:`, response);
  return new Response(
    JSON.stringify(response),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Main handler - wrapped in extra try/catch for safety
Deno.serve(async (req) => {
  const requestStartTime = generateTimestamp();
  
  try {
    console.log(`[${requestStartTime}] complete-onboarding-atomic: Request received`);
    console.log(`[${requestStartTime}] complete-onboarding-atomic: Method: ${req.method}, URL: ${req.url}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      console.log(`[${requestStartTime}] complete-onboarding-atomic: Handling OPTIONS preflight`);
      return new Response('ok', { headers: corsHeaders });
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      console.log(`[${requestStartTime}] complete-onboarding-atomic: Invalid method: ${req.method}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestStartTime}] complete-onboarding-atomic: Starting main logic...`);
    
    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    // DOMAIN CONFIGURATION - Use fallback if custom domain SSL not ready
    // Priority: APP_URL > APP_FALLBACK_URL > default Vercel URL
    // CORRECT DOMAIN: https://www.igogroup.in/
    const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('APP_FALLBACK_URL') || 'https://www.igogroup.in/';
    
    // Validate URL format
    let validatedAppUrl = APP_URL;
    try {
      const url = new URL(APP_URL);
      // Ensure HTTPS in production
      if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
        console.warn('[complete-onboarding-atomic] APP_URL is not HTTPS, using fallback');
        validatedAppUrl = Deno.env.get('APP_FALLBACK_URL') || 'https://www.igogroup.in/';
      }
    } catch (e) {
      console.error('[complete-onboarding-atomic] Invalid APP_URL format:', APP_URL);
      validatedAppUrl = 'https://www.igogroup.in/';
    }

    // Sender config: NO FALLBACK. Must be explicitly set in Supabase secrets.
    // If missing, we fail fast with a clear config error.
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL');
    const RESEND_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') || 'IGO Groups';

    // Runtime diagnostics - log exactly what sender will be used
    console.log('[complete-onboarding-atomic] === SENDER DIAGNOSTICS ===');
    console.log('[complete-onboarding-atomic] RESEND_FROM_EMAIL secret present:', !!RESEND_FROM_EMAIL);
    console.log('[complete-onboarding-atomic] RESEND_FROM_EMAIL value:', RESEND_FROM_EMAIL || 'NOT SET');
    console.log('[complete-onboarding-atomic] RESEND_API_KEY present:', !!RESEND_API_KEY);
    console.log('[complete-onboarding-atomic] APP_URL:', APP_URL);

    console.log('[complete-onboarding-atomic] Environment check:', {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasResendKey: !!RESEND_API_KEY,
      hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      fromEmail: RESEND_FROM_EMAIL || 'NOT SET - WILL FAIL',
      appUrl: validatedAppUrl,
      originalAppUrl: APP_URL,
    });

    // Verify required env vars
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[complete-onboarding-atomic] Missing Supabase credentials');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing Supabase credentials',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('[complete-onboarding-atomic] Missing RESEND_API_KEY');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Email service not configured',
          step: 'config_check',
          code: 'missing_resend_api_key',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Fail fast if RESEND_FROM_EMAIL is not configured
    if (!RESEND_FROM_EMAIL) {
      console.error('[complete-onboarding-atomic] RESEND_FROM_EMAIL is not set in Supabase secrets');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_FROM_EMAIL is not configured. Set the Supabase secret RESEND_FROM_EMAIL to a verified sender address.',
          step: 'send_email',
          code: 'missing_sender_config',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic format validation — domain verification errors come back from Resend naturally
    const emailFormatOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(RESEND_FROM_EMAIL);
    if (!emailFormatOk) {
      console.error('[complete-onboarding-atomic] RESEND_FROM_EMAIL is malformed:', RESEND_FROM_EMAIL);
      return new Response(
        JSON.stringify({
          success: false,
          error: `RESEND_FROM_EMAIL is malformed: "${RESEND_FROM_EMAIL}". Update the Supabase secret to a valid email address.`,
          step: 'send_email',
          code: 'invalid_sender_format',
          senderUsed: RESEND_FROM_EMAIL,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[complete-onboarding-atomic] Sender confirmed:', RESEND_FROM_EMAIL);

    // Parse request body
    let body: {
      onboardingId?: string;
      generatedUsername?: string;
      generatedPassword?: string;
      fullName?: string;
      email?: string;
      department?: string;
    };
    
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[complete-onboarding-atomic] Request body received:', {
      onboardingId: body.onboardingId,
      email: body.email,
      fullName: body.fullName,
      department: body.department,
      generatedUsername: body.generatedUsername ? '***provided***' : undefined,
      generatedPassword: body.generatedPassword ? '***masked***' : undefined,
    });

    // Validate required fields
    const requiredFields = ['onboardingId', 'email', 'fullName', 'generatedUsername', 'generatedPassword', 'department'];
    const missingFields = requiredFields.filter(field => !body[field as keyof typeof body]);
    
    if (missingFields.length > 0) {
      console.error('[complete-onboarding-atomic] Missing fields:', missingFields);
      return errorResponse('validate_request', `Missing required fields: ${missingFields.join(', ')}`, undefined, 400);
    }

    const { onboardingId, email, fullName, generatedUsername, generatedPassword, department } = body;

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Initialize anon client for user token validation (service role can't validate user tokens)
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
    console.log('[complete-onboarding-atomic] SUPABASE_ANON_KEY loaded:', !!SUPABASE_ANON_KEY, 'length:', SUPABASE_ANON_KEY.length);
    
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get current user (admin) from auth header
    const authHeader = req.headers.get('authorization');
    console.log('[complete-onboarding-atomic] Auth header received:', authHeader ? 'Bearer [REDACTED]' : 'none');
    let adminUserId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      console.log('[complete-onboarding-atomic] Token length:', token.length);
      // Use anon client to validate user token - service role client fails here
      const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
      if (userError) {
        console.error('[complete-onboarding-atomic] Auth error validating token:', userError);
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      adminUserId = user?.id || null;
    }

    console.log('[complete-onboarding-atomic] Admin user ID:', adminUserId);

    // Verify admin has proper role
    if (adminUserId) {
      const { data: adminProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', adminUserId)
        .single();

      if (profileError || !adminProfile) {
        console.error('[complete-onboarding-atomic] Admin profile not found:', profileError);
        return new Response(
          JSON.stringify({ success: false, error: 'Admin profile not found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const allowedRoles = ['admin', 'superadmin', 'hr', 'HR', 'Admin', 'SuperAdmin', 'CEO', 'ceo'];
      if (!allowedRoles.includes(adminProfile.role)) {
        console.error('[complete-onboarding-atomic] Unauthorized role:', adminProfile.role);
        return new Response(
          JSON.stringify({ success: false, error: 'Only admins can complete onboarding' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================================
    // IDEMPOTENCY CHECK: Fetch onboarding record FIRST
    // ============================================================================
    logStep('IDEMPOTENCY_CHECK_START', { onboardingId });
    
    const { data: existingRecord, error: fetchError } = await supabaseAdmin
      .from('onboarding_requests')
      .select('*')
      .eq('id', onboardingId)
      .single();
    
    if (fetchError || !existingRecord) {
      logStep('FETCH_RECORD_ERROR', fetchError);
      return errorResponse('fetch_onboarding', 'Failed to fetch onboarding record', fetchError?.message, 500);
    }
    
    // IDEMPOTENCY: Already completed - return success immediately
    if (existingRecord.status === 'admin_completed' && existingRecord.auth_user_id) {
      logStep('IDEMPOTENCY_ALREADY_COMPLETED', { authUserId: existingRecord.auth_user_id });
      return successResponse({
        message: 'Onboarding was already completed for this candidate.',
        data: {
          userId: existingRecord.auth_user_id,
          email: existingRecord.email,
          username: existingRecord.generated_username || undefined,
          emailSent: existingRecord.email_sent,
          alreadyCompleted: true,
          activationLink: existingRecord.activation_link || undefined,
        },
      });
    }
    
    // IDEMPOTENCY: Email already sent - safe to return success
    if (existingRecord.email_sent && existingRecord.auth_user_id) {
      logStep('IDEMPOTENCY_EMAIL_ALREADY_SENT', { authUserId: existingRecord.auth_user_id });
      return successResponse({
        message: 'Credentials were already sent to this candidate.',
        data: {
          userId: existingRecord.auth_user_id,
          email: existingRecord.email,
          username: existingRecord.generated_username || undefined,
          emailSent: true,
          alreadyCompleted: true,
          activationLink: existingRecord.activation_link || undefined,
        },
      });
    }
    
    logStep('IDEMPOTENCY_PASSED', { status: existingRecord.status });
    
    // Check if user already exists (for idempotency)
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    let existingUserId: string | null = null;
    let isExistingUser = false;
    
    if (!listError && existingUsers?.users) {
      const existingUser = existingUsers.users.find((u: any) => u.email === email);
      if (existingUser) {
        existingUserId = existingUser.id;
        isExistingUser = true;
        logStep('USER_ALREADY_EXISTS', { userId: existingUserId });
      }
    }

    // Generate activation token
    const activationToken = generateSecureToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

    // ============================================================================
    // STEP 1: Create or Get Auth User
    // ============================================================================
    logStep('STEP_1_CREATE_OR_GET_USER', { email, isExistingUser });
    
    let authUserId: string | null = existingUserId;
    
    if (!isExistingUser) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            department: department,
            username: generatedUsername,
          },
        });

        if (authError) {
          logStep('CREATE_USER_ERROR', authError);
          return errorResponse('create_user', 'Failed to create auth user', authError.message, 500);
        }

        authUserId = authData.user.id;
        logStep('USER_CREATED', { authUserId });
      } catch (error: any) {
        logStep('CREATE_USER_EXCEPTION', error.message);
        return errorResponse('create_user', 'Failed to create user account', error.message, 500);
      }
    } else {
      logStep('USING_EXISTING_USER', { authUserId: existingUserId });
    }

    // ============================================================================
    // STEP 2: Upsert Profile (Create or Update)
    // ============================================================================
    logStep('STEP_2_UPSERT_PROFILE', { authUserId });
    
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle();
      
      if (existingProfile) {
        logStep('PROFILE_EXISTS_UPDATING');
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            email,
            full_name: fullName,
            department: department,
            username: generatedUsername,
            role: 'employee',
            updated_at: new Date().toISOString(),
          })
          .eq('id', authUserId);
        
        if (updateError) {
          logStep('PROFILE_UPDATE_WARNING', updateError);
          // Non-fatal - continue
        } else {
          logStep('PROFILE_UPDATED');
        }
      } else {
        logStep('PROFILE_CREATING');
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authUserId,
            email,
            full_name: fullName,
            department: department,
            username: generatedUsername,
            role: 'employee',
            onboarding_completed: false,
            account_activated: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          logStep('PROFILE_CREATE_ERROR', insertError);
          // Rollback: delete auth user if we just created it
          if (!isExistingUser && authUserId) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId).catch((e: any) =>
              logStep('ROLLBACK_AUTH_USER_FAILED', e.message)
            );
          }
          return errorResponse('create_profile', 'Failed to create profile', insertError.message, 500);
        }
        logStep('PROFILE_CREATED');
      }
    } catch (error: any) {
      logStep('PROFILE_EXCEPTION', error.message);
      // Rollback: delete auth user if we just created it
      if (!isExistingUser && authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      return errorResponse('create_profile', 'Failed to create profile', error.message, 500);
    }

    // ============================================================================
    // STEP 3: Update Onboarding Record (Before Email)
    // ============================================================================
    logStep('STEP_3_UPDATE_ONBOARDING');
    
    try {
      const { error: updateError } = await supabaseAdmin
        .from('onboarding_requests')
        .update({
          status: 'admin_completed',
          generated_username: generatedUsername,
          generated_password_temp: generatedPassword,
          activation_token: activationToken,
          activation_link: `${validatedAppUrl}/onboarding?token=${activationToken}`,
          token_expires_at: tokenExpiresAt.toISOString(),
          admin_action_at: new Date().toISOString(),
          admin_action_by: adminUserId,
          auth_user_id: authUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', onboardingId);

      if (updateError) {
        logStep('UPDATE_ONBOARDING_ERROR', updateError);
        // Rollback: delete auth user and profile if we just created them
        if (!isExistingUser && authUserId) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
          try { await supabaseAdmin.from('profiles').delete().eq('id', authUserId); } catch(_e) {}
        }
        return errorResponse('update_onboarding', 'Failed to update onboarding record', updateError.message, 500);
      }
      
      logStep('ONBOARDING_UPDATED');
    } catch (error: any) {
      logStep('UPDATE_ONBOARDING_EXCEPTION', error.message);
      // Rollback
      if (!isExistingUser && authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      return errorResponse('update_onboarding', 'Failed to update onboarding record', error.message, 500);
    }

    // ============================================
    // STEP 4: SEND EMAIL (MANDATORY - ATOMIC)
    // ============================================
    const activationLink = `${validatedAppUrl}/onboarding?token=${activationToken}`;
    console.log('[complete-onboarding-atomic] Step 4: Sending email...');
    console.log('[complete-onboarding-atomic] Email recipient:', email);
    console.log('[complete-onboarding-atomic] Activation link:', activationLink);
    console.log('[complete-onboarding-atomic] Username:', generatedUsername);
    console.log('[complete-onboarding-atomic] Resend FROM address:', RESEND_FROM_EMAIL);
    console.log('[complete-onboarding-atomic] Base URL used:', validatedAppUrl);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; padding: 24px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #3b82f6; margin: 0;">Welcome to IGO Groups!</h2>
          <p style="color: #9ca3af; margin: 8px 0 0 0;">Your account has been created successfully</p>
        </div>
        
        <p style="color: #e5e7eb;">Hello <strong>${fullName}</strong>,</p>
        <p style="color: #9ca3af;">Your onboarding has been approved. Below are your login credentials and onboarding link:</p>
        
        <div style="background: #0f0f0f; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #374151;">
          <h3 style="color: #3b82f6; margin: 0 0 16px 0; font-size: 16px;">Login Credentials</h3>
          <table style="width: 100%; color: #e5e7eb;">
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; width: 120px;">Email:</td>
              <td style="padding: 8px 0; font-family: monospace;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af;">Username:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #22c55e; font-weight: bold;">${generatedUsername}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af;">Password:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #22c55e; font-weight: bold;">${generatedPassword}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af;">Department:</td>
              <td style="padding: 8px 0;">${department}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <p style="color: #9ca3af; margin-bottom: 16px;">Click the button below to complete your onboarding:</p>
          <a href="${validatedAppUrl}/onboarding?token=${activationToken}" 
             style="background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
            Complete Onboarding
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 14px; margin: 16px 0;"><strong>Next Steps:</strong></p>
        <ol style="color: #9ca3af; font-size: 14px; margin: 8px 0; padding-left: 20px;">
          <li style="margin: 4px 0;">Click the button above to access the onboarding form</li>
          <li style="margin: 4px 0;">Fill in all required personal details</li>
          <li style="margin: 4px 0;">Upload all necessary documents (Aadhaar, Passbook, etc.)</li>
          <li style="margin: 4px 0;">Accept HR Policy and Offer Letter</li>
          <li style="margin: 4px 0;">Submit for HR verification</li>
        </ol>
        
        <div style="border-top: 1px solid #374151; margin-top: 24px; padding-top: 16px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This link expires in 7 days. If you have any issues, please contact HR.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">
            Onboarding Link: <a href="${validatedAppUrl}/onboarding?token=${activationToken}" style="color: #3b82f6;">${validatedAppUrl}/onboarding?token=${activationToken.substring(0, 20)}...</a>
          </p>
        </div>
      </div>
    `;

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
          to: email,
          subject: `Welcome to ${RESEND_FROM_NAME} - Your Login Credentials`,
          html: emailHtml,
        }),
      });

      const resendData = await resendResponse.json();
      console.log('[complete-onboarding-atomic] Resend API response status:', resendResponse.status);
      console.log('[complete-onboarding-atomic] Resend API response data:', JSON.stringify(resendData, null, 2));

      if (!resendResponse.ok) {
        // Log detailed Resend error for debugging
        console.error('[complete-onboarding-atomic] Resend API error:', {
          status: resendResponse.status,
          statusText: resendResponse.statusText,
          error: resendData,
        });
        throw new Error(resendData.message || resendData.error || `Email failed: HTTP ${resendResponse.status}`);
      }

      emailSent = true;
      console.log('[complete-onboarding-atomic] Email sent successfully. Resend ID:', resendData.id);
    } catch (error: any) {
      console.error('[complete-onboarding-atomic] Email sending failed:', error);
      console.error('[complete-onboarding-atomic] Email error details:', error.message);
      emailError = error.message;
      // Don't throw yet - we need to rollback first
    }

    // ============================================
    // ATOMIC CHECK: If email failed, ROLLBACK EVERYTHING
    // ============================================
    if (!emailSent) {
      console.error('[complete-onboarding-atomic] EMAIL FAILED - Rolling back everything...');
      
      try {
        // 1. Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(authUserId!);
        console.log('[complete-onboarding-atomic] Rolled back: Deleted auth user');
        
        // 2. Profile will be cascade deleted or we can delete it
        await supabaseAdmin.from('profiles').delete().eq('id', authUserId);
        console.log('[complete-onboarding-atomic] Rolled back: Deleted profile');
        
        // 3. Revert onboarding record status
        await supabaseAdmin
          .from('onboarding_requests')
          .update({
            status: 'ceo_selected', // Back to CEO approved state
            generated_username: null,
            generated_password_temp: null,
            activation_token: null,
            activation_link: null,
            token_expires_at: null,
            admin_action_at: null,
            admin_action_by: null,
            auth_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', onboardingId);
        console.log('[complete-onboarding-atomic] Rolled back: Reverted onboarding record');
        
      } catch (rollbackError) {
        console.error('[complete-onboarding-atomic] ROLLBACK FAILED:', rollbackError);
        // Log this for manual cleanup
      }

      // Use errorResponse helper for consistency
      return errorResponse('send_email', emailError || 'Failed to send onboarding email', `Resend error: ${emailError}`, 500);
    }

    // ============================================
    // SUCCESS: Email sent, update record to mark email_sent
    // ============================================
    console.log('[complete-onboarding-atomic] SUCCESS - Updating email_sent flag...');

    try {
      await supabaseAdmin
        .from('onboarding_requests')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
        })
        .eq('id', onboardingId);
      console.log('[complete-onboarding-atomic] Email_sent flag updated successfully');
    } catch (flagError: any) {
      // NON-CRITICAL: Log but don't fail - email was already sent
      console.error('[complete-onboarding-atomic] Warning: Failed to update email_sent flag:', flagError.message);
      // Continue to return success - the core operation (auth user + email) succeeded
    }

    logStep('COMPLETE_SUCCESS', { authUserId, emailSent: true, isExistingUser });

    return successResponse({
      message: isExistingUser
        ? 'Account already existed. Credentials sent successfully.'
        : 'Account created and credentials sent successfully.',
      data: {
        userId: authUserId,
        email,
        username: generatedUsername,
        temporaryPassword: generatedPassword,
        emailSent: true,
        isExistingUser,
        activationLink: `${validatedAppUrl}/onboarding?token=${activationToken}`,
      },
    });

  } catch (error: any) {
    console.error('[complete-onboarding-atomic] CRITICAL ERROR:', error);
    console.error('[complete-onboarding-atomic] Stack trace:', error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Critical error in edge function',
        details: error.message || 'Unknown error',
        stack: error.stack || null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Global error handler for uncaught errors
addEventListener('error', (event) => {
  console.error('[complete-onboarding-atomic] UNCAUGHT ERROR:', event.error);
});
