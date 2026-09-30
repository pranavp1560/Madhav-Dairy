import { supabase } from '../lib/supabase';
import { InternalRole, Retailer } from '../types/dairy';

export interface UserSessionProfile {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  userType: 'internal' | 'customer';
  role: InternalRole | 'customer';
  status: 'active' | 'inactive' | 'suspended';
  department?: string;
  customerId?: string;
  customerName?: string;
  customer?: Retailer;
}

export const authService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Get session error:', error.message);
      return null;
    }
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

    // Fetch user profile from public.profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, mobile, user_type, status, department_id, organization_id')
      .eq('id', uid)
      .maybeSingle();

    if (profileErr || !profile) {
      return null;
    }

    // Determine internal role or customer identity
    let roleName: InternalRole | 'customer' = profile.user_type === 'customer' ? 'customer' : 'admin';
    let customerId: string | undefined;
    let customerName: string | undefined;
    let customerData: Retailer | undefined;

    if (profile.user_type === 'internal') {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', uid);

      if (userRoles && userRoles.length > 0 && (userRoles[0] as any).roles?.name) {
        roleName = (userRoles[0] as any).roles.name as InternalRole;
      }
    } else if (profile.user_type === 'customer') {
      // Lookup linked customer account
      const { data: custUser } = await supabase
        .from('customer_users')
        .select(`
          customer_id,
          customers (
            id,
            business_name,
            owner_name,
            mobile,
            email,
            address,
            area,
            gstin,
            credit_limit,
            payment_terms_days,
            status,
            last_order_at
          )
        `)
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (custUser && custUser.customers) {
        const c = custUser.customers as any;
        customerId = c.id;
        customerName = c.business_name;
        customerData = {
          id: c.id,
          businessName: c.business_name,
          ownerName: c.owner_name,
          mobile: c.mobile,
          email: c.email || '',
          address: c.address,
          area: c.area || '',
          gstin: c.gstin || '',
          creditLimit: Number(c.credit_limit || 0),
          outstandingAmount: 0,
          paymentTerms: `Net ${c.payment_terms_days || 15} Days`,
          status: c.status === 'active' ? 'active' : 'inactive',
          lastOrderDate: c.last_order_at ? c.last_order_at.split('T')[0] : '',
        };
      }
    }

    return {
      id: profile.id,
      email: profile.email || '',
      fullName: profile.full_name || '',
      mobile: profile.mobile || '',
      userType: profile.user_type as 'internal' | 'customer',
      role: roleName,
      status: (profile.status || 'active') as 'active' | 'inactive' | 'suspended',
      department: profile.department_id,
      customerId,
      customerName,
      customer: customerData,
    };
  },

  async signIn(email: string, pass: string): Promise<UserSessionProfile> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password.');
      }
      throw error;
    }

    if (!data.user) {
      throw new Error('Sign in succeeded but user session is missing.');
    }

    const profile = await this.getUserProfile(data.user.id);
    if (!profile) {
      throw new Error('User profile record not found in system.');
    }

    if (profile.status !== 'active') {
      await supabase.auth.signOut();
      throw new Error('Your account is inactive or suspended. Please contact management.');
    }

    return profile;
  },

  async signUpCustomer(data: {
    businessName: string;
    ownerName: string;
    email: string;
    mobile: string;
    password: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
  }): Promise<{ user: any; profile: UserSessionProfile | null; requiresEmailConfirmation: boolean }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.replace(/\D/g, '');

    // 1. Supabase Auth signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: data.password,
      options: {
        data: {
          full_name: data.ownerName.trim(),
          mobile: cleanMobile,
          user_type: 'customer',
          business_name: data.businessName.trim(),
        }
      }
    });

    if (authError) {
      if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
        throw new Error('An account with this email address already exists. Please log in.');
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Customer account creation failed. Please try again.');
    }

    const requiresEmailConfirmation = !authData.session && !authData.user.confirmed_at && !authData.user.email_confirmed_at;

    // 2. Call atomic registration RPC function to provision customer record & linking
    try {
      const { error: rpcErr } = await supabase.rpc('register_customer_account', {
        p_business_name: data.businessName.trim(),
        p_owner_name: data.ownerName.trim(),
        p_mobile: cleanMobile,
        p_email: cleanEmail,
        p_address: data.address.trim(),
        p_city: data.city || 'Pune',
        p_state: data.state || 'Maharashtra',
        p_pincode: data.pincode || null,
        p_gstin: data.gstin || null,
      });

      if (rpcErr) {
        console.warn('RPC register_customer_account notice:', rpcErr.message);
      }
    } catch (rpcEx) {
      console.warn('RPC registration exception:', rpcEx);
    }

    const profile = await this.getUserProfile(authData.user.id);
    return {
      user: authData.user,
      profile,
      requiresEmailConfirmation,
    };
  },

  async resetPassword(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
