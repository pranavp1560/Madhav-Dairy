import { supabase } from '../lib/supabase';
import { DirectCustomer, Order, OrderItem, OrderStatus } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const normalizeMobile = (mobile: string): string => {
  return (mobile || '').replace(/\D/g, '').slice(-10);
};

export const directCustomerService = {
  /**
   * Fetches all direct customers along with their aggregate order counts & last order dates.
   */
  async fetchDirectCustomers(): Promise<DirectCustomer[]> {
    const { data: customers, error } = await supabase
      .from('direct_customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch order aggregates for direct customers
    const { data: orderAggregates, error: aggErr } = await supabase
      .from('orders')
      .select('direct_customer_id, order_date')
      .eq('order_type', 'direct_customer');

    if (aggErr) {
      console.warn('Could not fetch direct order aggregates:', aggErr);
    }

    const orderCountMap: Record<string, number> = {};
    const lastOrderDateMap: Record<string, string> = {};

    (orderAggregates || []).forEach((ord: any) => {
      if (!ord.direct_customer_id) return;
      const id = ord.direct_customer_id;
      orderCountMap[id] = (orderCountMap[id] || 0) + 1;
      if (!lastOrderDateMap[id] || ord.order_date > lastOrderDateMap[id]) {
        lastOrderDateMap[id] = ord.order_date;
      }
    });

    return (customers || []).map((c: any): DirectCustomer => ({
      id: c.id,
      organizationId: c.organization_id,
      customerCode: c.customer_code,
      name: c.name,
      mobile: c.mobile,
      alternateMobile: c.alternate_mobile || undefined,
      email: c.email || undefined,
      address: c.address,
      notes: c.notes || undefined,
      status: c.status as 'active' | 'inactive',
      createdAt: c.created_at,
      createdBy: c.created_by || undefined,
      updatedAt: c.updated_at,
      updatedBy: c.updated_by || undefined,
      totalOrders: orderCountMap[c.id] || 0,
      lastOrderDate: lastOrderDateMap[c.id] || undefined,
    }));
  },

  /**
   * Checks for an existing direct customer with the same normalized 10-digit mobile.
   */
  async findDuplicateByMobile(mobile: string, excludeId?: string): Promise<DirectCustomer | null> {
    const clean = normalizeMobile(mobile);
    if (!clean || clean.length < 10) return null;

    const { data, error } = await supabase
      .from('direct_customers')
      .select('*');

    if (error || !data) return null;

    const match = data.find((c: any) => {
      if (excludeId && c.id === excludeId) return false;
      return normalizeMobile(c.mobile) === clean;
    });

    if (!match) return null;

    return {
      id: match.id,
      organizationId: match.organization_id,
      customerCode: match.customer_code,
      name: match.name,
      mobile: match.mobile,
      alternateMobile: match.alternate_mobile || undefined,
      email: match.email || undefined,
      address: match.address,
      notes: match.notes || undefined,
      status: match.status as 'active' | 'inactive',
      createdAt: match.created_at,
      updatedAt: match.updated_at,
    };
  },

  /**
   * Creates a new direct customer in the master table.
   */
  async createDirectCustomer(params: {
    name: string;
    mobile: string;
    address: string;
    alternateMobile?: string;
    email?: string;
    notes?: string;
  }): Promise<DirectCustomer> {
    const orgId = await getEffectiveOrgId();

    // Generate atomic customer code (e.g. DC-2026-0001 or DC-0001)
    let customerCode = `DC-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const { data: seqNum, error: rpcErr } = await supabase.rpc('next_document_number', {
        p_org_id: orgId,
        p_doc_type: 'direct_customer',
        p_prefix: 'DC',
        p_padding: 4
      });
      if (!rpcErr && seqNum) {
        customerCode = seqNum;
      }
    } catch (e) {
      console.warn('Failed to get sequence for direct_customer, fallback used:', e);
    }

    const { data, error } = await supabase
      .from('direct_customers')
      .insert({
        organization_id: orgId,
        customer_code: customerCode,
        name: params.name.trim(),
        mobile: params.mobile.trim(),
        address: params.address.trim(),
        alternate_mobile: params.alternateMobile?.trim() || null,
        email: params.email?.trim() || null,
        notes: params.notes?.trim() || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      organizationId: data.organization_id,
      customerCode: data.customer_code,
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternate_mobile || undefined,
      email: data.email || undefined,
      address: data.address,
      notes: data.notes || undefined,
      status: data.status as 'active' | 'inactive',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      totalOrders: 0,
      lastOrderDate: undefined,
    };
  },

  /**
   * Updates an existing direct customer.
   */
  async updateDirectCustomer(
    id: string,
    params: {
      name?: string;
      mobile?: string;
      address?: string;
      alternateMobile?: string;
      email?: string;
      notes?: string;
      status?: 'active' | 'inactive';
    }
  ): Promise<DirectCustomer> {
    const updateData: Record<string, any> = {};
    if (params.name !== undefined) updateData.name = params.name.trim();
    if (params.mobile !== undefined) updateData.mobile = params.mobile.trim();
    if (params.address !== undefined) updateData.address = params.address.trim();
    if (params.alternateMobile !== undefined) updateData.alternate_mobile = params.alternateMobile?.trim() || null;
    if (params.email !== undefined) updateData.email = params.email?.trim() || null;
    if (params.notes !== undefined) updateData.notes = params.notes?.trim() || null;
    if (params.status !== undefined) updateData.status = params.status;

    const { data, error } = await supabase
      .from('direct_customers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      organizationId: data.organization_id,
      customerCode: data.customer_code,
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternate_mobile || undefined,
      email: data.email || undefined,
      address: data.address,
      notes: data.notes || undefined,
      status: data.status as 'active' | 'inactive',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Toggles customer status between active and inactive.
   */
  async toggleStatus(id: string, currentStatus: 'active' | 'inactive'): Promise<'active' | 'inactive'> {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('direct_customers')
      .update({ status: nextStatus })
      .eq('id', id);

    if (error) throw error;
    return nextStatus;
  },

  /**
   * Fetches orders associated with a specific direct customer.
   */
  async fetchOrdersForCustomer(directCustomerId: string): Promise<Order[]> {
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_type,
        direct_customer_id,
        direct_customer_name,
        direct_customer_mobile,
        direct_customer_address,
        delivery_address,
        delivery_instructions,
        delivery_contact_person,
        delivery_contact_number,
        event_name,
        event_type,
        order_date,
        requested_delivery_date,
        status,
        subtotal,
        discount_amount,
        tax_amount,
        total_amount,
        payment_status,
        notes,
        created_at,
        invoices(id, invoice_number),
        order_items(
          id,
          product_sku_id,
          batch_id,
          quantity,
          unit_price,
          line_total,
          batches(id, batch_number, expiry_date),
          product_skus(id, sku_code, variant_name, pack_size, unit, products(id, name))
        )
      `)
      .eq('direct_customer_id', directCustomerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (ordersData || []).map((o: any): Order => {
      // Defensive deduplication by SKU to avoid repeating duplicate items
      const rawOrderItems = o.order_items || [];
      const seenSkus = new Set<string>();
      const uniqueOrderItems: any[] = [];
      for (const it of rawOrderItems) {
        const key = it.product_sku_id || it.id;
        if (!seenSkus.has(key)) {
          seenSkus.add(key);
          uniqueOrderItems.push(it);
        }
      }

      const items: OrderItem[] = uniqueOrderItems.map((it: any) => {
        const prod = it.product_skus?.products;
        const sku = it.product_skus;
        const variantLabel = sku?.variant_name || sku?.pack_size || '';
        const displayName = prod?.name ? (variantLabel ? `${prod.name} (${variantLabel})` : prod.name) : 'Dairy Product';

        return {
          productId: prod?.id || it.product_sku_id,
          skuId: sku?.id || it.product_sku_id,
          skuCode: sku?.sku_code,
          variantName: sku?.variant_name || sku?.pack_size,
          batchId: it.batch_id || it.batches?.id || undefined,
          batchNumber: it.batches?.batch_number || undefined,
          expiryDate: it.batches?.expiry_date || undefined,
          productName: displayName,
          unit: sku?.pack_size || sku?.unit || 'pack',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalPrice: Number(it.line_total),
        };
      });

      const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;

      return {
        id: o.id,
        orderNumber: o.order_number?.startsWith('#') ? o.order_number : `#${o.order_number}`,
        orderType: 'direct_customer',
        retailerName: o.direct_customer_name || 'Direct Customer',
        directCustomerId: o.direct_customer_id,
        directCustomerName: o.direct_customer_name,
        directCustomerMobile: o.direct_customer_mobile,
        directCustomerAddress: o.direct_customer_address,
        deliveryAddress: o.delivery_address,
        deliveryInstructions: o.delivery_instructions,
        deliveryContactPerson: o.delivery_contact_person,
        deliveryContactNumber: o.delivery_contact_number,
        eventName: o.event_name,
        eventType: o.event_type,
        orderDate: o.order_date,
        deliveryDate: o.requested_delivery_date || undefined,
        status: o.status as OrderStatus,
        totalAmount: Number(o.total_amount),
        paymentStatus: o.payment_status as 'paid' | 'unpaid' | 'partial',
        notes: o.notes || undefined,
        invoiceId: inv?.id || undefined,
        invoiceNumber: inv?.invoice_number || undefined,
        items,
      };
    });
  }
};
