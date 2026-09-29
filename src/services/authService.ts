import { supabase } from '../lib/supabase';
import { InternalRole, User } from '../types/dairy';

export interface UserSessionProfile {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  userType: 'internal' | 'customer';
  role: InternalRole | 'customer';
  department?: string;
  customerId?: string;
  customerName?: string;
}

export const authService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  },

  async getUserProfile(userId?: string): Promise<UserSessionProfile | null> {
    const uid = userId || (await this.getCurrentUser())?.id;
    if (!uid) return null;

    // Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, mobile, user_type, status, department_id')
      .eq('id', uid)
      .maybeSingle();

    if (profileErr || !profile) return null;

    // Fetch user roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', uid);

    const roleName = (userRoles?.[0] as any)?.roles?.name || (profile.user_type === 'customer' ? 'customer' : 'admin');

    let customerId: string | undefined;
    let customerName: string | undefined;

    if (profile.user_type === 'customer') {
      const { data: custUser } = await supabase
        .from('customer_users')
        .select('customer_id, customers(business_name)')
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (custUser) {
        customerId = custUser.customer_id;
        customerName = (custUser as any)?.customers?.business_name;
      }
    }

    return {
      id: profile.id,
      email: profile.email || '',
      fullName: profile.full_name,
      mobile: profile.mobile || '',
      userType: profile.user_type as 'internal' | 'customer',
      role: roleName,
      department: profile.department_id,
      customerId,
      customerName,
    };
  },

  async signIn(email: string, password: string): Promise<UserSessionProfile> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in succeeded but user object missing');

    const profile = await this.getUserProfile(data.user.id);
    if (!profile) throw new Error('User profile record not found');
    return profile;
  },

  async signUp(email: string, password: string, fullName: string, mobile: string, userType: 'internal' | 'customer' = 'customer', customerData?: { businessName: string; address: string }): Promise<UserSessionProfile> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile,
          user_type: userType,
        }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Registration failed');

    // Create profile in public.profiles
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        organization_id: '00000000-0000-0000-0000-000000000001',
        full_name: fullName,
        email,
        mobile,
        user_type: userType,
        status: 'active',
      });

    if (profErr) console.warn('Could not upsert profile:', profErr.message);

    if (userType === 'customer' && customerData) {
      // Create customer record
      const code = 'RET-' + Math.floor(1000 + Math.random() * 9000);
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert({
          organization_id: '00000000-0000-0000-0000-000000000001',
          customer_code: code,
          business_name: customerData.businessName,
          owner_name: fullName,
          mobile,
          email,
          address: customerData.address,
          status: 'active',
        })
        .select()
        .single();

      if (!custErr && newCust) {
        await supabase.from('customer_users').insert({
          customer_id: newCust.id,
          auth_user_id: data.user.id,
          is_primary: true,
          is_active: true,
        });
      }
    }

    const profile = await this.getUserProfile(data.user.id);
    return profile || {
      id: data.user.id,
      email,
      fullName,
      mobile,
      userType,
      role: userType === 'customer' ? 'customer' : 'admin',
    };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
