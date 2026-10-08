import { supabase } from '../lib/supabase';
import {
  ProductExpiryRule,
  CustomerProductBatch,
  StaffStockExpiryItem,
  ExpiryAlertItem,
  ExpirySeverity,
  BatchStatus
} from '../types/dairy';
import { calculateDaysRemaining } from '../utils/dateUtils';
import { getEffectiveOrgId } from './orgService';

export const expiryService = {
  /**
   * Fetches product-specific expiry alert configurations.
   * If a product has no custom rule row in Supabase, automatically supplies default 10 / 5 / 3.
   */
  async fetchProductExpiryRules(): Promise<ProductExpiryRule[]> {
    // 1. Fetch all catalog products
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name, shelf_life_days, organization_id')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (pErr) throw pErr;

    // 2. Fetch existing rules
    const { data: rules, error: rErr } = await supabase
      .from('expiry_rules')
      .select('*')
      .not('product_id', 'is', null);

    if (rErr) throw rErr;

    const ruleMap = new Map<string, any>();
    (rules || []).forEach(r => {
      if (r.product_id) ruleMap.set(r.product_id, r);
    });

    return (products || []).map((p: any): ProductExpiryRule => {
      const existing = ruleMap.get(p.id);

      const shelfLife = p.shelf_life_days || 10;
      const defA1 = Math.min(10, shelfLife);
      const defA2 = shelfLife >= 6 ? Math.min(5, defA1 - 1) : Math.max(2, defA1 - 1);
      const defA3 = shelfLife >= 4 ? Math.min(3, defA2 - 1) : 1;

      return {
        id: existing?.id || `virtual-${p.id}`,
        productId: p.id,
        productName: p.name,
        shelfLifeDays: shelfLife,
        alert1Days: existing?.alert_1_days ?? defA1,
        alert2Days: existing?.alert_2_days ?? defA2,
        alert3Days: existing?.alert_3_days ?? defA3,
        enabled: existing?.enabled ?? true,
        updatedAt: existing?.updated_at,
      };
    });
  },

  /**
   * Updates or saves a product's expiry alert rule.
   * Validates positive integers and Alert 1 > Alert 2 > Alert 3.
   */
  async updateProductExpiryRule(params: {
    productId: string;
    alert1Days: number;
    alert2Days: number;
    alert3Days: number;
    enabled: boolean;
  }): Promise<void> {
    const { productId, alert1Days, alert2Days, alert3Days, enabled } = params;

    // Strict validation
    if (alert1Days <= 0 || alert2Days <= 0 || alert3Days <= 0) {
      throw new Error('All alert days must be positive integers (> 0).');
    }
    if (alert1Days <= alert2Days || alert2Days <= alert3Days) {
      throw new Error('Alert rules must strictly follow Alert 1 > Alert 2 > Alert 3 (e.g. 10 > 5 > 3).');
    }

    const orgId = await getEffectiveOrgId();

    const { error } = await supabase
      .from('expiry_rules')
      .upsert(
        {
          organization_id: orgId,
          product_id: productId,
          title: `Custom Expiry Rule`,
          alert_1_days: alert1Days,
          alert_2_days: alert2Days,
          alert_3_days: alert3Days,
          target_customer: true,
          target_internal: true,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,product_id' }
      );

    if (error) throw error;
  },

  /**
   * Evaluates live internal finished goods inventory batches.
   * Source of truth: Batches + Batch Stock + Product Rules + Current Date.
   */
  async fetchStaffStockExpiry(): Promise<StaffStockExpiryItem[]> {
    // 1. Fetch live batches with stock
    const { data: batchesData, error: bErr } = await supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        product_sku_id,
        production_date,
        expiry_date,
        status,
        product_skus(
          product_id,
          products(id, name, shelf_life_days)
        ),
        batch_stock(
          location_id,
          quantity_on_hand,
          quantity_reserved,
          locations(id, name)
        )
      `)
      .neq('status', 'exhausted')
      .order('expiry_date', { ascending: true });

    if (bErr) throw bErr;

    // 2. Fetch product rules for threshold matching
    const productRules = await this.fetchProductExpiryRules();
    const ruleByProduct = new Map<string, ProductExpiryRule>();
    productRules.forEach(r => ruleByProduct.set(r.productId, r));

    const results: StaffStockExpiryItem[] = [];

    (batchesData || []).forEach((b: any) => {
      const prod = b.product_skus?.products;
      const prodId = prod?.id || b.product_sku_id;
      const prodName = prod?.name || 'Dairy Product';

      const rule = ruleByProduct.get(prodId) || {
        alert1Days: 10,
        alert2Days: 5,
        alert3Days: 3,
        enabled: true,
      };

      const daysRemaining = calculateDaysRemaining(b.expiry_date);

      (b.batch_stock || []).forEach((st: any) => {
        const onHand = Number(st.quantity_on_hand || 0);
        const reserved = Number(st.quantity_reserved || 0);
        const available = Math.max(0, onHand - reserved);

        // Only show if available quantity > 0 or expired
        if (available <= 0 && daysRemaining >= 0) return;

        let alertLevel: StaffStockExpiryItem['alertLevel'] = 'active';
        if (daysRemaining < 0) {
          alertLevel = 'expired';
        } else if (daysRemaining === 0) {
          alertLevel = 'expiring_today';
        } else if (rule.enabled && daysRemaining <= rule.alert3Days) {
          alertLevel = 'urgent';
        } else if (rule.enabled && daysRemaining <= rule.alert2Days) {
          alertLevel = 'warning';
        } else if (rule.enabled && daysRemaining <= rule.alert1Days) {
          alertLevel = 'upcoming';
        }

        results.push({
          batchId: b.id,
          batchNumber: b.batch_number,
          productId: prodId,
          productName: prodName,
          locationId: st.locations?.id,
          locationName: st.locations?.name || 'Central Cold Storage',
          availableQty: available,
          productionDate: b.production_date,
          expiryDate: b.expiry_date,
          daysRemaining,
          alertLevel,
          status: (daysRemaining < 0 ? 'expired' : b.status) as BatchStatus,
        });
      });
    });

    return results;
  },

  /**
   * Fetches real customer delivered batch tracking records.
   * Source of truth: customer_product_batches (is_current = true).
   */
  async fetchCustomerExpiryTracking(customerId?: string): Promise<CustomerProductBatch[]> {
    let query = supabase
      .from('customer_product_batches')
      .select(`
        id,
        customer_id,
        product_id,
        batch_id,
        order_id,
        invoice_id,
        quantity_purchased,
        quantity_remaining,
        delivered_at,
        expiry_date,
        is_current,
        tracking_status,
        customers(id, business_name),
        products(id, name),
        batches(id, batch_number),
        orders(order_number),
        invoices(invoice_number)
      `)
      .eq('is_current', true)
      .order('expiry_date', { ascending: true });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any): CustomerProductBatch => {
      const daysRemaining = calculateDaysRemaining(row.expiry_date);

      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customers?.business_name || 'Retailer Customer',
        productId: row.product_id,
        productName: row.products?.name || 'Dairy Product',
        batchId: row.batch_id,
        batchNumber: row.batches?.batch_number || 'BATCH-STD',
        orderId: row.order_id || undefined,
        orderNumber: row.orders?.order_number || undefined,
        invoiceId: row.invoice_id || undefined,
        invoiceNumber: row.invoices?.invoice_number || undefined,
        quantityPurchased: Number(row.quantity_purchased),
        quantityRemaining: Number(row.quantity_remaining),
        deliveredAt: row.delivered_at,
        expiryDate: row.expiry_date,
        daysRemaining,
        isCurrent: row.is_current,
        trackingStatus: (daysRemaining < 0 ? 'expired' : row.tracking_status) as any,
      };
    });
  },

  /**
   * Fetches generated expiry alerts from public.expiry_alerts.
   */
  async fetchExpiryAlerts(): Promise<ExpiryAlertItem[]> {
    const { data: alerts, error } = await supabase
      .from('expiry_alerts')
      .select(`
        id,
        batch_id,
        product_id,
        location_id,
        customer_id,
        quantity,
        remaining_quantity,
        threshold_days,
        expiry_date,
        severity,
        status,
        alert_type,
        notification_id,
        generated_at,
        batches(
          batch_number,
          production_date,
          expiry_date,
          product_skus(
            products(id, name)
          )
        ),
        products(id, name),
        customers(id, business_name),
        locations(name)
      `)
      .order('generated_at', { ascending: false });

    if (error) throw error;

    return (alerts || []).map((a: any): ExpiryAlertItem => {
      const b = a.batches;
      const prod = a.products || b?.product_skus?.products;
      const expDate = a.expiry_date || b?.expiry_date || '';
      const daysRemaining = calculateDaysRemaining(expDate);

      return {
        id: a.id,
        batchId: a.batch_id,
        batchNumber: b?.batch_number || 'BATCH-STD',
        productId: prod?.id || a.product_id || '',
        productName: prod?.name || 'Dairy Product',
        retailerId: a.customers?.id || undefined,
        retailerName: a.customers?.business_name || undefined,
        location: a.locations?.name || (a.customers ? 'Retail Shelf' : 'Cold Storage'),
        quantity: Number(a.remaining_quantity || a.quantity || 0),
        productionDate: b?.production_date || '',
        expiryDate: expDate,
        daysRemaining,
        severity: a.severity as ExpirySeverity,
        alertType: a.alert_type as 'staff' | 'customer',
        thresholdDays: a.threshold_days,
        alertStatus: a.status as any,
        notificationId: a.notification_id || undefined,
        generatedAt: a.generated_at,
      };
    });
  },

  /**
   * Runs the backend expiry evaluation engine via RPC.
   * Safe to call repeatedly without generating duplicate alerts or notifications.
   */
  async evaluateExpiryRisk(): Promise<any> {
    const { data, error } = await supabase.rpc('evaluate_expiry_alerts');
    if (error) throw error;
    return data;
  },

  /**
   * Sends an authentic website in-app notification to staff or customer.
   * Replaces fake simulation toasts.
   */
  async sendManualWebsiteNotification(params: {
    batchId: string;
    batchNumber: string;
    productName: string;
    daysRemaining: number;
    locationName?: string;
    customerId?: string;
    retailerName?: string;
  }): Promise<void> {
    const { batchId, batchNumber, productName, daysRemaining, locationName, customerId, retailerName } = params;

    const isCustomer = Boolean(customerId);
    let title = '';
    let message = '';

    if (isCustomer) {
      title = daysRemaining <= 0
        ? `⚠ Your ${productName} has expired`
        : `⚠ Your ${productName} expires in ${daysRemaining} days`;
      message = `Delivered batch ${batchNumber} reached its shelf-life threshold. Target store: ${retailerName || 'Customer Store'}.`;
    } else {
      title = daysRemaining <= 0
        ? `⚠ ${productName} batch ${batchNumber} has expired`
        : `⚠ ${productName} batch ${batchNumber} is expiring in ${daysRemaining} days`;
      message = `Warehouse surveillance alert. Location: ${locationName || 'Finished Goods Storage'}. Traceable batch ${batchNumber}.`;
    }

    // Resolve recipient user ID
    let recipientUserId: string | null = null;
    if (isCustomer && customerId) {
      const { data: custUser } = await supabase
        .from('customer_users')
        .select('auth_user_id')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();

      recipientUserId = custUser?.auth_user_id || null;
    }

    if (!recipientUserId) {
      const { data: adminProf } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', 'internal')
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      recipientUserId = adminProf?.id || null;
    }

    if (!recipientUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      recipientUserId = user?.id || null;
    }

    if (!recipientUserId) {
      console.warn('Cannot send expiry notification: no valid authenticated recipient user found.');
      return;
    }

    const orgId = await getEffectiveOrgId();

    const { error } = await supabase.from('notifications').insert({
      organization_id: orgId,
      recipient_user_id: recipientUserId,
      customer_id: customerId || null,
      title,
      message,
      type: 'expiry',
      channel: 'in_app',
      reference_type: 'batches',
      reference_id: batchId,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  },

  /**
   * Toggles whether a product's expiry rule is enabled.
   */
  async toggleProductExpiryRule(productId: string, currentEnabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('expiry_rules')
      .update({ enabled: !currentEnabled, updated_at: new Date().toISOString() })
      .eq('product_id', productId);

    if (error) throw error;
  }
};
