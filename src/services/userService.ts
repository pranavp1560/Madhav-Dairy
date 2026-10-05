import { supabase } from '../lib/supabase';
import { User, InternalRole, RolePermission } from '../types/dairy';

export const userService = {
  async fetchUsers(): Promise<User[]> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        mobile,
        status,
        department_id,
        last_login_at,
        created_at,
        invited_at,
        user_roles (
          roles (
            name
          )
        )
      `)
      .eq('user_type', 'internal')
      .order('full_name');

    if (error) throw error;

    return (profiles || []).map((p: any): User => {
      const roleName = (p.user_roles?.[0] as any)?.roles?.name || 'admin';
      return {
        id: p.id,
        name: p.full_name,
        email: p.email || '',
        mobile: p.mobile || '',
        role: roleName as InternalRole,
        status: (p.status === 'invited' ? 'invited' : p.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive' | 'invited',
        lastLogin: p.last_login_at ? new Date(p.last_login_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : (p.status === 'invited' ? 'Pending Setup' : 'Never'),
        department: p.department_id || 'Operations',
        invitedAt: p.invited_at,
      };
    });
  },

  async fetchRolePermissions(): Promise<RolePermission[]> {
    const modules = [
      'Dashboard', 'Production', 'Batches', 'Finished Goods',
      'Raw Materials', 'Stock Movements', 'Orders', 'Invoices',
      'Customers', 'Payments', 'Customer Ledger', 'Expenses',
      'Expiry Management', 'Reports', 'Users & Roles', 'Products Catalog',
      'Settings'
    ];

    return modules.map(m => ({
      module: m,
      view: true,
      create: ['Production', 'Batches', 'Finished Goods', 'Raw Materials', 'Stock Movements', 'Orders', 'Invoices', 'Customers', 'Payments', 'Expenses', 'Users & Roles', 'Products Catalog'].includes(m),
      edit: ['Production', 'Batches', 'Finished Goods', 'Raw Materials', 'Orders', 'Invoices', 'Customers', 'Payments', 'Expenses', 'Expiry Management', 'Users & Roles', 'Products Catalog', 'Settings'].includes(m),
      delete: false,
    }));
  },

  async createEmployee(data: {
    fullName: string;
    email: string;
    mobile: string;
    department: string;
    role: InternalRole;
    status?: 'active' | 'inactive' | 'invited';
  }): Promise<any> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.trim().replace(/\D/g, '');

    // Invoke server-side Supabase Edge Function (Admin API invitation flow)
    const { data: result, error } = await supabase.functions.invoke('admin-create-employee', {
      body: {
        fullName: data.fullName.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        department: data.department.trim(),
        role: data.role,
        status: data.status || 'invited',
      },
    });

    if (error) {
      let errMsg = error.message;
      try {
        if ((error as any).context?.json) {
          const parsed = await (error as any).context.json();
          if (parsed?.error) errMsg = parsed.error;
        }
      } catch {
        // preserve standard message
      }

      // In local development, fall back to dev API proxy if cloud function is not yet deployed
      if (import.meta.env.DEV && (errMsg?.includes('404') || errMsg?.includes('Failed to send') || (error as any).name === 'FunctionsHttpError' || (error as any).name === 'FunctionsRelayError')) {
        try {
          const session = await supabase.auth.getSession();
          const res = await fetch('/api/admin-create-employee', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session?.access_token || ''}`,
            },
            body: JSON.stringify({
              fullName: data.fullName.trim(),
              email: cleanEmail,
              mobile: cleanMobile,
              department: data.department.trim(),
              role: data.role,
              status: data.status || 'invited',
            }),
          });
          const resJson = await res.json();
          if (!res.ok) {
            throw new Error(resJson.error || 'Failed to create employee');
          }
          return resJson;
        } catch (devErr: any) {
          if (devErr.message && !devErr.message.includes('Failed to fetch')) {
            throw devErr;
          }
        }
      }

      throw new Error(errMsg || 'Failed to create employee');
    }

    return result;
  },

  async updateUserStatus(userId: string, status: 'active' | 'inactive' | 'invited'): Promise<void> {
    const { error } = await supabase.rpc('admin_update_employee_status', {
      p_user_id: userId,
      p_status: status,
    });

    if (error) {
      // Fallback direct update if RPC fails
      const { error: directErr } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);
      if (directErr) throw directErr;
    }
  },

  async updateUserRole(userId: string, roleName: InternalRole): Promise<void> {
    const { error } = await supabase.rpc('admin_update_employee_role', {
      p_user_id: userId,
      p_new_role: roleName,
    });

    if (error) {
      // Fallback direct update
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .maybeSingle();

      if (!role) throw new Error(`Role ${roleName} not found`);

      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error: insErr } = await supabase.from('user_roles').insert({
        user_id: userId,
        role_id: role.id,
      });
      if (insErr) throw insErr;
    }
  },

  async resetEmployeePassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await supabase.rpc('admin_reset_employee_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    });
    if (error) throw error;
  },

  async sendEmployeePasswordResetEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }
};
