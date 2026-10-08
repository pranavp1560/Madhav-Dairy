import { supabase } from '../lib/supabase';
import { Retailer } from '../types/dairy';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export const customerService = {
  async fetchCustomers(): Promise<Retailer[]> {
    const { data: custs, error: custErr } = await supabase
      .from('customers')
      .select(`
        *,
        sales_channels(id, name, code)
      `)
      .order('business_name');

    if (custErr) throw custErr;

    // Fetch live outstanding balances from view_customer_outstanding
    const { data: outstandings } = await supabase
      .from('view_customer_outstanding')
      .select('customer_id, outstanding_amount');

    const balanceMap: Record<string, number> = {};
    if (outstandings) {
      outstandings.forEach((o: any) => {
        balanceMap[o.customer_id] = Number(o.outstanding_amount || 0);
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
      outstandingAmount: balanceMap[c.id] !== undefined ? Math.max(0, balanceMap[c.id]) : 0,
      paymentTerms: `Net ${c.payment_terms_days || 15} Days`,
      status: c.status === 'active' ? 'active' : 'inactive',
      lastOrderDate: c.last_order_at ? c.last_order_at.split('T')[0] : '',
      salesChannelId: c.sales_channel_id || undefined,
      salesChannelName: c.sales_channels?.name || 'Retail',
      salesChannelCode: c.sales_channels?.code || 'RETAIL',
      customerCode: c.customer_code || '',
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
    salesChannelId?: string;
  }): Promise<Retailer> {
    // Determine sales channel ID
    let channelId = data.salesChannelId;
    if (!channelId) {
      const { data: defaultCh } = await supabase
        .from('sales_channels')
        .select('id')
        .eq('code', 'WHOLESALE')
        .maybeSingle();

      channelId = defaultCh?.id || 'c1000000-0000-0000-0000-000000000002';
    }

    // Generate sequential customer code via document sequences or count
    let customerCode = 'RET-1001';
    try {
      const { data: seqData, error: seqErr } = await supabase.rpc('next_document_number', {
        p_org_id: DEFAULT_ORG_ID,
        p_doc_type: 'customer',
        p_prefix: 'RET',
        p_padding: 4,
      });
      if (!seqErr && seqData) {
        customerCode = seqData;
      } else {
        const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        customerCode = `RET-${1000 + (count || 0) + 1}`;
      }
    } catch {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      customerCode = `RET-${1000 + (count || 0) + 1}`;
    }

    const { data: newCust, error } = await supabase
      .from('customers')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        customer_code: customerCode,
        business_name: data.businessName.trim(),
        owner_name: data.ownerName.trim(),
        mobile: data.mobile.trim(),
        email: data.email?.trim().toLowerCase() || null,
        address: data.address.trim(),
        area: data.area?.trim() || 'Pune Region',
        gstin: data.gstin?.trim() || null,
        credit_limit: data.creditLimit || 50000,
        payment_terms_days: 15,
        status: 'active',
        sales_channel_id: channelId,
      })
      .select('*, sales_channels(id, name, code)')
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
      salesChannelId: newCust.sales_channel_id,
      salesChannelName: (newCust as any).sales_channels?.name || 'Wholesale',
      salesChannelCode: (newCust as any).sales_channels?.code || 'WHOLESALE',
    };
  },

  async updateCustomerChannel(customerId: string, channelId: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ sales_channel_id: channelId })
      .eq('id', customerId);

    if (error) throw error;
  }
};
