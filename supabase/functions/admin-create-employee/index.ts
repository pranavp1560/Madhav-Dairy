// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs server-side in the Supabase Edge Functions environment.
// It uses the secure Service Role key solely on the server to invite employees
// and provision their profiles and roles atomically.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SECRET_KEY') ||
      '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Server-side Supabase environment variables are missing');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: Supabase credentials missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify caller identity via incoming Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Missing Bearer token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerToken = authHeader.replace('Bearer ', '').trim();

    // Client using caller's JWT to authenticate caller identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Privileged Supabase Admin Client (server-side only)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Authorize caller: Verify caller belongs to internal staff and holds 'admin' role
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, organization_id, user_type, status')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (profileErr || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Staff profile record not found.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.user_type !== 'internal' || callerProfile.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Active internal staff credentials required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role in user_roles
    const { data: adminRoleData, error: adminRoleErr } = await adminClient
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', callerUser.id)
      .eq('roles.name', 'admin')
      .maybeSingle();

    if (adminRoleErr || !adminRoleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Administrator permission required to create employees.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Organization isolation: The employee MUST belong to the admin's organization
    const adminOrgId = callerProfile.organization_id;
    if (!adminOrgId) {
      return new Response(
        JSON.stringify({ error: 'Admin organization could not be determined.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate request payload (NO password allowed!)
    const payload = await req.json();
    const { fullName, email, mobile, department, role, status } = payload;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return new Response(
        JSON.stringify({ error: 'Full name is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return new Response(
        JSON.stringify({ error: 'Work email is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mobile || typeof mobile !== 'string' || !mobile.trim()) {
      return new Response(
        JSON.stringify({ error: 'Mobile contact is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!department || typeof department !== 'string' || !department.trim()) {
      return new Response(
        JSON.stringify({ error: 'Department is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!role || typeof role !== 'string' || !role.trim()) {
      return new Response(
        JSON.stringify({ error: 'Role is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\D/g, '');

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verify role exists in admin's organization
    const { data: roleRow, error: roleLookupErr } = await adminClient
      .from('roles')
      .select('id, name')
      .eq('organization_id', adminOrgId)
      .eq('name', role)
      .maybeSingle();

    if (roleLookupErr || !roleRow) {
      return new Response(
        JSON.stringify({ error: `Assigned role "${role}" does not exist for your organization.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Check duplicate email in profiles or auth.users
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Invite user via Supabase Auth Admin API
    const origin =
      req.headers.get('origin') ||
      req.headers.get('referer') ||
      Deno.env.get('SITE_URL') ||
      supabaseUrl;

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: {
          full_name: fullName.trim(),
          mobile: cleanMobile,
          department: department.trim(),
          user_type: 'internal',
          organization_id: adminOrgId,
        },
        redirectTo: origin,
      }
    );

    if (inviteErr || !inviteData?.user) {
      const msg = inviteErr?.message || 'Failed to send employee invitation email.';
      const isDuplicate =
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists');
      return new Response(
        JSON.stringify({
          error: isDuplicate ? 'An account with this email already exists.' : msg,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = inviteData.user.id;

    // 8. Provision Database records atomically (profiles, user_roles, audit_log)
    try {
      const targetStatus = status === 'inactive' ? 'inactive' : 'invited';

      const { data: provisionResult, error: provisionErr } = await adminClient.rpc(
        'admin_provision_invited_employee',
        {
          p_user_id: newUserId,
          p_organization_id: adminOrgId,
          p_full_name: fullName.trim(),
          p_email: cleanEmail,
          p_mobile: cleanMobile,
          p_department: department.trim(),
          p_role: role,
          p_status: targetStatus,
        }
      );

      if (provisionErr) {
        throw provisionErr;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Employee created successfully. Invitation sent to: ${cleanEmail}`,
          user: {
            id: newUserId,
            email: cleanEmail,
            fullName: fullName.trim(),
            role,
            department: department.trim(),
            status: targetStatus,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (dbErr: any) {
      // 9. Failure Handling & Rollback:
      // If database provisioning failed, roll back the Supabase Auth user so no orphaned user exists
      console.error('Database provisioning failed for invited employee, rolling back auth user:', dbErr);
      await adminClient.auth.admin.deleteUser(newUserId);

      return new Response(
        JSON.stringify({
          error: `Database provisioning failed: ${dbErr.message || 'Unknown database error'}. Auth invitation was rolled back.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    console.error('Unexpected exception in admin-create-employee function:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
