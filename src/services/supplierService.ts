import { supabase } from '../lib/supabase';
import { Supplier } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const supplierService = {
  async fetchSuppliers(): Promise<Supplier[]> {
    const orgId = await getEffectiveOrgId();

    const { data, error } = await supabase
      .from('suppliers')
      .select(`
        id,
        organization_id,
        supplier_code,
        name,
        contact_person,
        mobile,
        email,
        address,
        gstin,
        status,
        created_at
      `)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching suppliers:', error);
      throw error;
    }

    return (data || []).map((s: any): Supplier => ({
      id: s.id,
      organizationId: s.organization_id,
      supplierCode: s.supplier_code,
      name: s.name,
      contactPerson: s.contact_person || undefined,
      mobile: s.mobile,
      email: s.email || undefined,
      address: s.address || undefined,
      gstin: s.gstin || undefined,
      status: s.status as 'active' | 'inactive' | 'blacklisted',
      createdAt: s.created_at,
    }));
  }
};
