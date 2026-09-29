import { supabase } from '../lib/supabase';
import { ExpiryRule, ExpiryAlertItem, ExpirySeverity } from '../types/dairy';

export const expiryService = {
  async fetchExpiryRules(): Promise<ExpiryRule[]> {
    const { data: rules, error } = await supabase
      .from('expiry_rules')
      .select('*')
      .order('days_before_expiry', { ascending: false });

    if (error) throw error;

    return (rules || []).map((r: any): ExpiryRule => ({
      id: r.id,
      title: r.title,
      daysBeforeExpiry: r.days_before_expiry,
      severity: r.severity as ExpirySeverity,
      target: (r.target_customer && r.target_internal) ? 'both' : (r.target_customer ? 'customer' : 'internal'),
      channels: ['in_app', 'push', 'whatsapp'],
      enabled: r.enabled,
    }));
  },

  async fetchExpiryAlerts(): Promise<ExpiryAlertItem[]> {
    const { data: alerts, error } = await supabase
      .from('expiry_alerts')
      .select(`
        id,
        quantity,
        severity,
        status,
        batches(
          batch_number,
          production_date,
          expiry_date,
          product_skus(
            products(id, name)
          )
        ),
        customers(id, business_name),
        locations(name)
      `)
      .order('generated_at', { ascending: false });

    if (error) throw error;

    return (alerts || []).map((a: any): ExpiryAlertItem => {
      const b = a.batches;
      const prod = b?.product_skus?.products;
      const expDate = new Date(b?.expiry_date || new Date());
      const now = new Date();
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      return {
        id: a.id,
        batchNumber: b?.batch_number || 'BATCH-STD',
        productId: prod?.id || 'prod-1',
        productName: prod?.name || 'Dairy Product',
        retailerId: a.customers?.id || undefined,
        retailerName: a.customers?.business_name || undefined,
        location: a.customers ? 'retailer' : 'warehouse',
        quantity: Number(a.quantity),
        productionDate: b?.production_date || '',
        expiryDate: b?.expiry_date || '',
        daysRemaining: diffDays,
        severity: a.severity as ExpirySeverity,
        alertStatus: a.status as 'active' | 'acknowledged' | 'resolved',
      };
    });
  },

  async toggleExpiryRule(ruleId: string, currentEnabled: boolean) {
    const { error } = await supabase
      .from('expiry_rules')
      .update({ enabled: !currentEnabled })
      .eq('id', ruleId);

    if (error) throw error;
  }
};
