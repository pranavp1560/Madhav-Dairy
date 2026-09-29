import { supabase } from '../lib/supabase';
import { Order, OrderItem, OrderStatus } from '../types/dairy';

export const orderService = {
  async fetchOrders(): Promise<Order[]> {
    const { data: ordersData, error: oErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        order_date,
        requested_delivery_date,
        status,
        subtotal,
        discount_amount,
        tax_amount,
        total_amount,
        payment_status,
        notes,
        customers(business_name),
        order_items(
          id,
          product_sku_id,
          quantity,
          unit_price,
          line_total,
          product_skus(
            pack_size,
            unit,
            products(id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (oErr) throw oErr;

    return (ordersData || []).map((o: any): Order => {
      const items: OrderItem[] = (o.order_items || []).map((it: any) => {
        const prod = it.product_skus?.products;
        return {
          productId: prod?.id || it.product_sku_id,
          productName: prod?.name || 'Dairy Product',
          unit: it.product_skus?.packSize || it.product_skus?.unit || 'pack',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalPrice: Number(it.line_total),
        };
      });

      return {
        id: o.id,
        orderNumber: o.order_number.startsWith('#') ? o.order_number : `#${o.order_number}`,
        retailerId: o.customer_id,
        retailerName: o.customers?.business_name || 'Retailer Customer',
        orderDate: o.order_date,
        deliveryDate: o.requested_delivery_date || undefined,
        status: o.status as OrderStatus,
        totalAmount: Number(o.total_amount),
        paymentStatus: o.payment_status as 'paid' | 'unpaid' | 'partial',
        notes: o.notes || undefined,
        items,
      };
    });
  },

  async createOrder(params: {
    customerId: string;
    items: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
  }): Promise<Order> {
    const orgId = '00000000-0000-0000-0000-000000000001';

    // Generate atomic sequence number
    let orderNum = `MD-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const { data: seqNum, error: rpcErr } = await supabase.rpc('next_document_number', {
        p_org_id: orgId,
        p_doc_type: 'order',
        p_prefix: 'MD-ORD',
        p_padding: 4
      });
      if (!rpcErr && seqNum) {
        orderNum = seqNum;
      }
    } catch {
      // Fallback to random unique sequence
    }

    const totalAmount = params.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // 1. Insert order
    const { data: newOrder, error: oErr } = await supabase
      .from('orders')
      .insert({
        organization_id: orgId,
        customer_id: params.customerId,
        order_number: orderNum,
        order_date: new Date().toISOString().split('T')[0],
        requested_delivery_date: params.deliveryDate || null,
        status: 'pending',
        subtotal: totalAmount,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: totalAmount,
        payment_status: 'unpaid',
        notes: params.notes || null,
      })
      .select('*, customers(business_name)')
      .single();

    if (oErr) throw oErr;

    // 2. Fetch default sku for each product to link order items
    const { data: allSkus } = await supabase
      .from('product_skus')
      .select('id, product_id, pack_size, unit, selling_price')
      .in('product_id', params.items.map(i => i.productId));

    const skuMap: Record<string, any> = {};
    if (allSkus) {
      allSkus.forEach((s: any) => {
        if (!skuMap[s.product_id]) skuMap[s.product_id] = s;
      });
    }

    // 3. Insert order items
    const orderItemsRows = params.items.map(i => {
      const sku = skuMap[i.productId];
      const skuId = sku?.id || '41000000-0000-0000-0000-000000000001';
      return {
        order_id: newOrder.id,
        product_sku_id: skuId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: i.quantity * i.unitPrice,
      };
    });

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemsRows);

    if (itemsErr) console.warn('Could not insert line items:', itemsErr.message);

    // 4. Record status history
    await supabase.from('order_status_history').insert({
      order_id: newOrder.id,
      from_status: null,
      to_status: 'pending',
      notes: 'Customer placed order'
    });

    // Update customer last_order_at
    await supabase.from('customers').update({
      last_order_at: new Date().toISOString()
    }).eq('id', params.customerId);

    return {
      id: newOrder.id,
      orderNumber: `#${orderNum}`,
      retailerId: params.customerId,
      retailerName: newOrder.customers?.business_name || 'Retailer',
      orderDate: newOrder.order_date,
      deliveryDate: params.deliveryDate,
      status: 'pending',
      totalAmount,
      paymentStatus: 'unpaid',
      notes: params.notes,
      items: params.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        unit: skuMap[i.productId]?.pack_size || 'pack',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice
      }))
    };
  },

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      to_status: status,
      notes: `Status changed to ${status}`
    });
  }
};
