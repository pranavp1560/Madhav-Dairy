import { supabase } from '../lib/supabase';
import { Retailer } from '../types/dairy';

export const customerService = {
  async fetchCustomers(): Promise<Retailer[]> {
    const { data: custs, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .order('business_name');

    if (custErr) throw custErr;

    // Fetch live outstanding balances from view_customer_outstanding
    const { data: outstandings } = await supabase
      .from('view_customer_outstanding')
      .select('customer_id, current_outstanding');

    const balanceMap: Record<string, number> = {};
    if (outstandings) {
      outstandings.forEach((o: any) => {
        balanceMap[o.customer_id] = Number(o.current_outstanding || 0);
      });
    }

    return (custs || []).map((c: any): Retailer => ({
      id: c.id,
      businessName: c.business_name,
      ownerName: c.owner_name,
      mobile: c.mobile,
      email: c.email || '',
      address: c.address,
      area: c.area || '',
      gstin: c.gstin || '',
      creditLimit: Number(c.credit_limit || 0),
      outstandingAmount: balanceMap[c.id] !== undefined ? balanceMap[c.id] : 0,
      paymentTerms: `Net ${c.payment_terms_days || 15} Days`,
      status: c.status === 'active' ? 'active' : 'inactive',
      lastOrderDate: c.last_order_at ? c.last_order_at.split('T')[0] : '',
    }));
  },

  async registerCustomer(data: {
    businessName: string;
    ownerName: string;
    mobile: string;
    address: string;
    area?: string;
    email?: string;
    gstin?: string;
    creditLimit?: number;
  }): Promise<Retailer> {
    const code = 'RET-' + Math.floor(1000 + Math.random() * 9000);
    const { data: newCust, error } = await supabase
      .from('customers')
      .insert({
        organization_id: '00000000-0000-0000-0000-000000000001',
        customer_code: code,
        business_name: data.businessName,
        owner_name: data.ownerName,
        mobile: data.mobile,
        email: data.email || null,
        address: data.address,
        area: data.area || 'Pune Region',
        gstin: data.gstin || null,
        credit_limit: data.creditLimit || 50000,
        payment_terms_days: 15,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: newCust.id,
      businessName: newCust.business_name,
      ownerName: newCust.owner_name,
      mobile: newCust.mobile,
      email: newCust.email || '',
      address: newCust.address,
      area: newCust.area || '',
      gstin: newCust.gstin || '',
      creditLimit: Number(newCust.credit_limit || 0),
      outstandingAmount: 0,
      paymentTerms: `Net ${newCust.payment_terms_days || 15} Days`,
      status: 'active',
      lastOrderDate: '',
    };
  }
};
