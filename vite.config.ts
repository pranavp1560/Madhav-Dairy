import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

// Development helper plugin to serve /api/admin-create-employee during local Vite dev
// Note: This plugin only runs server-side inside Vite Node.js dev server, never in client bundle.
function devEmployeeApiPlugin() {
  return {
    name: 'dev-employee-api',
    configureServer(server: any) {
      server.middlewares.use('/api/admin-create-employee', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const env = loadEnv('development', process.cwd(), '');
          const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
          const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '';
          const supabaseSecretKey = env.SUPABASE_SECRET_KEY || '';

          if (!supabaseUrl || !supabaseSecretKey) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Server misconfiguration: Supabase credentials missing in .env' }));
            return;
          }

          // 1. Verify caller authorization token
          const authHeader = req.headers['authorization'] || '';
          if (!authHeader.startsWith('Bearer ')) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Authentication required. Missing Bearer token.' }));
            return;
          }

          const callerToken = authHeader.replace('Bearer ', '').trim();
          const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${callerToken}` } },
            auth: { persistSession: false },
          });

          const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
          if (callerError || !callerUser) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }));
            return;
          }

          // Privileged Admin Client
          const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // 2. Authorize caller: Verify internal staff + admin role
          const { data: callerProfile, error: profileErr } = await adminClient
            .from('profiles')
            .select('id, organization_id, user_type, status')
            .eq('id', callerUser.id)
            .maybeSingle();

          if (profileErr || !callerProfile || callerProfile.user_type !== 'internal' || callerProfile.status !== 'active') {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Forbidden: Active internal staff profile required.' }));
            return;
          }

          const { data: adminRoleData, error: adminRoleErr } = await adminClient
            .from('user_roles')
            .select('roles!inner(name)')
            .eq('user_id', callerUser.id)
            .eq('roles.name', 'admin')
            .maybeSingle();

          if (adminRoleErr || !adminRoleData) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Forbidden: Administrator permission required.' }));
            return;
          }

          const adminOrgId = callerProfile.organization_id;

          // Read body
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const rawBody = Buffer.concat(buffers).toString();
          const payload = JSON.parse(rawBody || '{}');
          const { fullName, email, mobile, department, role, status } = payload;

          if (!fullName || !email || !mobile || !department || !role) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing required employee fields.' }));
            return;
          }

          const cleanEmail = email.trim().toLowerCase();
          const cleanMobile = mobile.trim().replace(/\D/g, '');

          // Check duplicate email
          const { data: existingProfile } = await adminClient
            .from('profiles')
            .select('id, email')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (existingProfile) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'An account with this email already exists.' }));
            return;
          }

          // Verify role exists for admin's organization
          const { data: roleRow, error: roleLookupErr } = await adminClient
            .from('roles')
            .select('id, name')
            .eq('organization_id', adminOrgId)
            .eq('name', role)
            .maybeSingle();

          if (roleLookupErr || !roleRow) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Assigned role "${role}" does not exist for your organization.` }));
            return;
          }

          // 3. Invite user via Supabase Auth Admin API
          const origin = req.headers['origin'] || req.headers['referer'] || 'http://localhost:3000';
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
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: isDuplicate ? 'An account with this email already exists.' : msg,
            }));
            return;
          }

          const newUserId = inviteData.user.id;

          // 4. Provision database records atomically
          try {
            const targetStatus = status === 'inactive' ? 'inactive' : 'invited';
            const { error: provisionErr } = await adminClient.rpc('admin_provision_invited_employee', {
              p_user_id: newUserId,
              p_organization_id: adminOrgId,
              p_full_name: fullName.trim(),
              p_email: cleanEmail,
              p_mobile: cleanMobile,
              p_department: department.trim(),
              p_role: role,
              p_status: targetStatus,
            });

            if (provisionErr) throw provisionErr;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
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
            }));
          } catch (dbErr: any) {
            // Rollback auth user
            await adminClient.auth.admin.deleteUser(newUserId);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: `Database provisioning failed: ${dbErr.message || 'Unknown database error'}. Auth invitation was rolled back.`,
            }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devEmployeeApiPlugin()],
  server: {
    port: 3000,
    open: false,
  },
});
