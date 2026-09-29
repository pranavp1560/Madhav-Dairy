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
        user_roles(
          roles(name)
        )
      `)
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
        status: p.status === 'active' ? 'active' : 'inactive',
        lastLogin: p.last_login_at ? new Date(p.last_login_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never',
        department: p.department_id || 'Operations',
      };
    });
  },

  async fetchRolePermissions(): Promise<RolePermission[]> {
    const { data: perms } = await supabase
      .from('permissions')
      .select('module, action');

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

  async updateUserStatus(userId: string, status: 'active' | 'inactive') {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (error) throw error;
  },

  async updateUserRole(userId: string, roleName: InternalRole) {
    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .maybeSingle();

    if (!role) throw new Error(`Role ${roleName} not found`);

    // Delete existing roles for user
    await supabase.from('user_roles').delete().eq('user_id', userId);

    // Insert new role
    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: role.id,
    });

    if (error) throw error;
  }
};
