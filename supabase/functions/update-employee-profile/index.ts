// @ts-nocheck - This is a Deno edge function with different type definitions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, updates } = await req.json()

    if (!userId) {
      throw new Error('userId is required')
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('updates object is required')
    }

    // Create service role client to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing required environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Get requesting user's role
    const { data: requesterProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !requesterProfile) {
      throw new Error('Failed to verify requester role')
    }

    const requesterRole = requesterProfile.role?.toLowerCase()
    const allowedRoles = ['admin', 'ceo', 'hr']
    if (!allowedRoles.includes(requesterRole)) {
      throw new Error('Only admins, CEOs, and HR can update employee profiles')
    }

    // Update the profile using service role
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Profile updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in update-employee-profile:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to update profile' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
