import { supabase } from '../lib/supabase';
import { User, InternalRole, RolePermission } from '../types/dairy';

export type PermissionActionMap = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type RolePermissionsMatrix = Record<InternalRole, Record<string, PermissionActionMap>>;

export const DEFAULT_ROLE_PERMISSIONS_MATRIX: RolePermissionsMatrix = {
  admin: {
    production: { view: true, create: true, edit: true, delete: true },
    batches: { view: true, create: true, edit: true, delete: false },
    inventory: { view: true, create: true, edit: true, delete: true },
    raw_materials: { view: true, create: true, edit: true, delete: true },
    orders: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: true },
    payments: { view: true, create: true, edit: true, delete: false },
    ledger: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: true, edit: true, delete: true },
    expiry: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: false, edit: true, delete: false },
    products: { view: true, create: true, edit: true, delete: true },
    categories: { view: true, create: true, edit: true, delete: true },
    channels: { view: true, create: true, edit: true, delete: true },
    dashboard: { view: true, create: false, edit: false, delete: false },
  },
  production_manager: {
    production: { view: true, create: true, edit: true, delete: false },
    batches: { view: true, create: true, edit: true, delete: false },
    inventory: { view: true, create: false, edit: false, delete: false },
    raw_materials: { view: true, create: true, edit: true, delete: false },
    orders: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    customers: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, delete: false },
    ledger: { view: false, create: false, edit: false, delete: false },
    expenses: { view: false, create: false, edit: false, delete: false },
    expiry: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    categories: { view: true, create: false, edit: false, delete: false },
    channels: { view: false, create: false, edit: false, delete: false },
    dashboard: { view: true, create: false, edit: false, delete: false },
  },
  warehouse_manager: {
    production: { view: true, create: false, edit: false, delete: false },
    batches: { view: true, create: false, edit: true, delete: false },
    inventory: { view: true, create: true, edit: true, delete: false },
    raw_materials: { view: true, create: true, edit: true, delete: false },
    orders: { view: true, create: false, edit: true, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    customers: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, delete: false },
    ledger: { view: false, create: false, edit: false, delete: false },
    expenses: { view: false, create: false, edit: false, delete: false },
    expiry: { view: true, create: false, edit: true, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    categories: { view: true, create: false, edit: false, delete: false },
    channels: { view: false, create: false, edit: false, delete: false },
    dashboard: { view: true, create: false, edit: false, delete: false },
  },
  accountant: {
    production: { view: false, create: false, edit: false, delete: false },
    batches: { view: false, create: false, edit: false, delete: false },
    inventory: { view: false, create: false, edit: false, delete: false },
    raw_materials: { view: false, create: false, edit: false, delete: false },
    orders: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    payments: { view: true, create: true, edit: true, delete: false },
    ledger: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false },
    expiry: { view: false, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    categories: { view: true, create: false, edit: false, delete: false },
    channels: { view: true, create: false, edit: false, delete: false },
    dashboard: { view: true, create: false, edit: false, delete: false },
  },
};

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

  async fetchRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
    try {
      const { data, error } = await supabase.rpc('admin_get_role_permissions_matrix');
      if (error || !data) {
        console.warn('Falling back to default matrix:', error?.message);
        return DEFAULT_ROLE_PERMISSIONS_MATRIX;
      }

      // Merge with default matrix structure so every module is guaranteed present
      const result: RolePermissionsMatrix = { ...DEFAULT_ROLE_PERMISSIONS_MATRIX };
      for (const role of ['admin', 'production_manager', 'warehouse_manager', 'accountant'] as InternalRole[]) {
        if (data[role]) {
          result[role] = {
            ...DEFAULT_ROLE_PERMISSIONS_MATRIX[role],
            ...data[role],
          };
        }
      }
      return result;
    } catch (err) {
      console.error('Failed to fetch role permissions matrix:', err);
      return DEFAULT_ROLE_PERMISSIONS_MATRIX;
    }
  },

  async saveRolePermissions(
    role: InternalRole,
    permissions: Record<string, PermissionActionMap>
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_save_role_permissions', {
      p_role: role,
      p_permissions: permissions,
    });

    if (error) {
      throw new Error(error.message || `Failed to update permissions for role ${role}`);
    }
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
    password?: string;
  }): Promise<any> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.trim().replace(/\D/g, '');
    const cleanName = data.fullName.trim();
    const cleanDept = data.department.trim();
    const status = data.status || 'active';

    // If explicit password provided, use direct provisioning RPC
    if (data.password && data.password.trim().length >= 6) {
      const { data: directResult, error: directErr } = await supabase.rpc('admin_create_employee_direct', {
        p_full_name: cleanName,
        p_email: cleanEmail,
        p_mobile: cleanMobile,
        p_department: cleanDept,
        p_role: data.role,
        p_status: status,
        p_password: data.password.trim(),
      });
      if (!directErr && directResult) {
        return directResult;
      }
      if (directErr) {
        throw new Error(directErr.message || 'Failed to create employee');
      }
    }

    // Otherwise invoke server-side Supabase Edge Function (Admin API invitation flow)
    const { data: result, error } = await supabase.functions.invoke('admin-create-employee', {
      body: {
        fullName: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        department: cleanDept,
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
              fullName: cleanName,
              email: cleanEmail,
              mobile: cleanMobile,
              department: cleanDept,
              role: data.role,
              status: data.status || 'invited',
            }),
          });
          const resJson = await res.json();
          if (res.ok) {
            return resJson;
          }
        } catch {
          // fall through to direct DB creation fallback
        }
      }

      // Fallback: Create directly via secure Postgres RPC
      try {
        const { data: fallbackResult, error: fallbackErr } = await supabase.rpc('admin_create_employee_direct', {
          p_full_name: cleanName,
          p_email: cleanEmail,
          p_mobile: cleanMobile,
          p_department: cleanDept,
          p_role: data.role,
          p_status: data.status || 'invited',
        });
        if (!fallbackErr && fallbackResult) {
          return fallbackResult;
        }
      } catch {
        // ignore and throw original error
      }

      throw new Error(errMsg || 'Failed to create employee');
    }

    return result;
  },

  async updateEmployee(
    userId: string,
    data: {
      name: string;
      mobile: string;
      department: string;
      role: InternalRole;
      status: 'active' | 'inactive' | 'invited';
    }
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_update_employee', {
      p_user_id: userId,
      p_full_name: data.name.trim(),
      p_mobile: data.mobile.trim().replace(/\D/g, ''),
      p_department: data.department.trim(),
      p_role: data.role,
      p_status: data.status,
    });

    if (error) {
      // Fallback direct updates if RPC not found
      const cleanMobile = data.mobile.trim().replace(/\D/g, '');
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: data.name.trim(),
          mobile: cleanMobile,
          department_id: data.department.trim(),
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileErr) throw profileErr;

      // Update role
      await this.updateUserRole(userId, data.role);
    }
  },

  async deleteEmployee(userId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_employee', {
      p_user_id: userId,
    });

    if (error) {
      // Fallback direct delete
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error: delErr } = await supabase.from('profiles').delete().eq('id', userId);
      if (delErr) throw delErr;
    }
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
