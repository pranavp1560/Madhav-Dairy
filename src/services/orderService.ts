import { supabase } from '../lib/supabase';
import { Order, OrderItem, OrderStatus } from '../types/dairy';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

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
        customers(
          id,
          business_name,
          sales_channel_id,
          sales_channels(id, name, code)
        ),
        order_items(
          id,
          product_sku_id,
          quantity,
          unit_price,
          line_total,
          product_skus(
            id,
            sku_code,
            variant_name,
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
        const sku = it.product_skus;
        const variantLabel = sku?.variant_name || sku?.pack_size || '';
        const displayName = prod?.name ? (variantLabel ? `${prod.name} (${variantLabel})` : prod.name) : 'Dairy Product';

        return {
          productId: prod?.id || it.product_sku_id,
          skuId: sku?.id || it.product_sku_id,
          skuCode: sku?.sku_code,
          variantName: sku?.variant_name || sku?.pack_size,
          productName: displayName,
          unit: sku?.pack_size || sku?.unit || 'pack',
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
        retailerChannelId: o.customers?.sales_channel_id,
        retailerChannelName: o.customers?.sales_channels?.name,
        retailerChannelCode: o.customers?.sales_channels?.code,
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

  async resolveCustomerChannelPricing(customerId: string): Promise<Record<string, { standardPrice: number; minimumPrice: number; channelName: string }>> {
    const { data: customer } = await supabase
      .from('customers')
      .select('sales_channel_id, sales_channels(name)')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer?.sales_channel_id) return {};

    const channelName = (customer as any)?.sales_channels?.name || 'Channel';

    // 1. Fetch SKU channel prices
    const { data: skuPrices } = await supabase
      .from('sku_channel_prices')
      .select('sku_id, standard_price, minimum_price')
      .eq('channel_id', customer.sales_channel_id)
      .eq('is_active', true);

    // 2. Fetch legacy product channel prices for fallback
    const { data: prodPrices } = await supabase
      .from('product_channel_prices')
      .select('product_id, standard_price, minimum_price')
      .eq('channel_id', customer.sales_channel_id)
      .eq('is_active', true);

    const result: Record<string, { standardPrice: number; minimumPrice: number; channelName: string }> = {};

    if (prodPrices) {
      prodPrices.forEach((p: any) => {
        result[p.product_id] = {
          standardPrice: Number(p.standard_price),
          minimumPrice: Number(p.minimum_price),
          channelName,
        };
      });
    }

    if (skuPrices) {
      skuPrices.forEach((p: any) => {
        result[p.sku_id] = {
          standardPrice: Number(p.standard_price),
          minimumPrice: Number(p.minimum_price),
          channelName,
        };
      });
    }

    return result;
  },

  async createOrder(params: {
    customerId: string;
    items: {
      productId?: string;
      skuId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
  }): Promise<Order> {
    // 1. Fetch customer's sales channel and validate minimum prices
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, sales_channel_id, sales_channels(id, name, code)')
      .eq('id', params.customerId)
      .maybeSingle();

    const channelId = customerData?.sales_channel_id;
    const channelName = (customerData as any)?.sales_channels?.name || 'Channel';

    const itemSkuIds = params.items.map(i => i.skuId).filter(Boolean) as string[];
    const itemProdIds = params.items.map(i => i.productId).filter(Boolean) as string[];

    if (channelId) {
      // Lookup SKU channel prices
      const { data: skuChannelPrices } = await supabase
        .from('sku_channel_prices')
        .select('sku_id, standard_price, minimum_price, is_active')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .in('sku_id', itemSkuIds.length > 0 ? itemSkuIds : ['00000000-0000-0000-0000-000000000000']);

      // Lookup product channel prices fallback
      const { data: prodChannelPrices } = await supabase
        .from('product_channel_prices')
        .select('product_id, standard_price, minimum_price, is_active')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .in('product_id', itemProdIds.length > 0 ? itemProdIds : ['00000000-0000-0000-0000-000000000000']);

      const priceMap: Record<string, { standard: number; minimum: number }> = {};
      if (prodChannelPrices) {
        prodChannelPrices.forEach((cp: any) => {
          priceMap[cp.product_id] = {
            standard: Number(cp.standard_price),
            minimum: Number(cp.minimum_price),
          };
        });
      }
      if (skuChannelPrices) {
        skuChannelPrices.forEach((cp: any) => {
          priceMap[cp.sku_id] = {
            standard: Number(cp.standard_price),
            minimum: Number(cp.minimum_price),
          };
        });
      }

      // Validate each item against the channel minimum price rule
      for (const item of params.items) {
        const rule = (item.skuId ? priceMap[item.skuId] : undefined) || (item.productId ? priceMap[item.productId] : undefined);
        if (rule && item.unitPrice < rule.minimum) {
          throw new Error(
            `Selling price ₹${item.unitPrice} cannot be lower than the minimum allowed price of ₹${rule.minimum} for the ${channelName} channel on "${item.productName}".`
          );
        }
      }
    }

    // Generate atomic sequence number
    let orderNum = `MD-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const { data: seqNum, error: rpcErr } = await supabase.rpc('next_document_number', {
        p_org_id: DEFAULT_ORG_ID,
        p_doc_type: 'order',
        p_prefix: 'MD-ORD',
        p_padding: 4
      });
      if (!rpcErr && seqNum) {
        orderNum = seqNum;
      }
    } catch {
      // Fallback
    }

    const totalAmount = params.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // 2. Insert order header
    const { data: newOrder, error: oErr } = await supabase
      .from('orders')
      .insert({
        organization_id: DEFAULT_ORG_ID,
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

    // 3. Resolve SKU ID for each item
    // If item.skuId already provided, use directly; otherwise lookup default SKU for product_id
    const needsSkuLookup = params.items.filter(i => !i.skuId && i.productId).map(i => i.productId as string);
    const skuMap: Record<string, any> = {};

    if (needsSkuLookup.length > 0) {
      const { data: lookedUpSkus } = await supabase
        .from('product_skus')
        .select('id, product_id, pack_size, unit, selling_price')
        .in('product_id', needsSkuLookup);

      if (lookedUpSkus) {
        lookedUpSkus.forEach((s: any) => {
          if (!skuMap[s.product_id]) skuMap[s.product_id] = s;
        });
      }
    }

    // 4. Insert order line items (snapshots the unit_price permanently)
    const orderItemsRows = params.items.map(i => {
      let finalSkuId = i.skuId;
      if (!finalSkuId && i.productId) {
        finalSkuId = skuMap[i.productId]?.id;
      }
      if (!finalSkuId) {
        finalSkuId = '1c1d1971-da7e-4669-889a-5eb33e62a53e'; // Fallback
      }

      return {
        order_id: newOrder.id,
        product_sku_id: finalSkuId,
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

    if (itemsErr) {
      // Clean up order if item insertion failed (e.g. database trigger error)
      await supabase.from('orders').delete().eq('id', newOrder.id);
      throw new Error(`Order failed: ${itemsErr.message}`);
    }

    // 5. Record status history
    await supabase.from('order_status_history').insert({
      order_id: newOrder.id,
      from_status: null,
      to_status: 'pending',
      notes: 'Order created with snapshotted channel pricing'
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
      retailerChannelId: channelId,
      retailerChannelName: channelName,
      retailerChannelCode: (customerData as any)?.sales_channels?.code,
      orderDate: newOrder.order_date,
      deliveryDate: params.deliveryDate,
      status: 'pending',
      totalAmount,
      paymentStatus: 'unpaid',
      notes: params.notes,
      items: params.items.map(i => ({
        productId: i.productId || i.skuId || '',
        skuId: i.skuId,
        productName: i.productName,
        unit: (i.productId ? skuMap[i.productId]?.pack_size : undefined) || 'pack',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice
      }))
    };
  },

  async updateOrder(orderId: string, params: {
    customerId?: string;
    items: {
      productId?: string;
      skuId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
    status?: OrderStatus;
  }): Promise<Order> {
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 1. Fetch current order details
    const { data: currentOrder, error: curErr } = await supabase
      .from('orders')
      .select('id, customer_id, order_number, order_date, status, notes, requested_delivery_date, payment_status, customers(id, business_name, sales_channel_id, sales_channels(name, code))')
      .eq('id', orderId)
      .single();

    if (curErr) throw curErr;

    const targetCustomerId = params.customerId || currentOrder.customer_id;

    // 2. Fetch customer's sales channel and validate minimum prices
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, business_name, sales_channel_id, sales_channels(id, name, code)')
      .eq('id', targetCustomerId)
      .maybeSingle();

    const channelId = customerData?.sales_channel_id;
    const channelName = (customerData as any)?.sales_channels?.name || 'Channel';

    const itemSkuIds = params.items.map(i => i.skuId).filter(Boolean) as string[];
    const itemProdIds = params.items.map(i => i.productId).filter(Boolean) as string[];

    if (channelId) {
      // Lookup SKU channel prices
      const { data: skuChannelPrices } = await supabase
        .from('sku_channel_prices')
        .select('sku_id, standard_price, minimum_price, is_active')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .in('sku_id', itemSkuIds.length > 0 ? itemSkuIds : ['00000000-0000-0000-0000-000000000000']);

      // Lookup product channel prices fallback
      const { data: prodChannelPrices } = await supabase
        .from('product_channel_prices')
        .select('product_id, standard_price, minimum_price, is_active')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .in('product_id', itemProdIds.length > 0 ? itemProdIds : ['00000000-0000-0000-0000-000000000000']);

      const priceMap: Record<string, { standard: number; minimum: number }> = {};
      if (prodChannelPrices) {
        prodChannelPrices.forEach((cp: any) => {
          priceMap[cp.product_id] = {
            standard: Number(cp.standard_price),
            minimum: Number(cp.minimum_price),
          };
        });
      }
      if (skuChannelPrices) {
        skuChannelPrices.forEach((cp: any) => {
          priceMap[cp.sku_id] = {
            standard: Number(cp.standard_price),
            minimum: Number(cp.minimum_price),
          };
        });
      }

      // Enforce floor prices strictly
      for (const item of params.items) {
        const rule = (item.skuId ? priceMap[item.skuId] : undefined) || (item.productId ? priceMap[item.productId] : undefined);
        if (rule && item.unitPrice < rule.minimum) {
          throw new Error(
            `Selling price ₹${item.unitPrice} cannot be lower than the minimum allowed price of ₹${rule.minimum} for the ${channelName} channel on "${item.productName || 'selected product'}".`
          );
        }
      }
    }

    // 3. Resolve SKUs for each product
    const needsSkuLookup = params.items.filter(i => !i.skuId && i.productId).map(i => i.productId as string);
    const skuMap: Record<string, any> = {};

    if (needsSkuLookup.length > 0) {
      const { data: allSkus } = await supabase
        .from('product_skus')
        .select('id, product_id, pack_size, unit, selling_price')
        .in('product_id', needsSkuLookup);

      if (allSkus) {
        allSkus.forEach((s: any) => {
          if (!skuMap[s.product_id]) skuMap[s.product_id] = s;
        });
      }
    }

    const totalAmount = params.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // 4. Update order header
    const updatePayload: Record<string, any> = {
      subtotal: totalAmount,
      total_amount: totalAmount,
    };
    if (params.customerId) updatePayload.customer_id = params.customerId;
    if (params.notes !== undefined) updatePayload.notes = params.notes;
    if (params.deliveryDate !== undefined) updatePayload.requested_delivery_date = params.deliveryDate || null;
    if (params.status) updatePayload.status = params.status;

    const { error: updErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updErr) throw updErr;

    // 5. Replace order items: delete old, insert new
    const { error: delErr } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (delErr) throw delErr;

    const orderItemsRows = params.items.map(i => {
      let finalSkuId = i.skuId;
      if (!finalSkuId && i.productId) {
        finalSkuId = skuMap[i.productId]?.id;
      }
      if (!finalSkuId) {
        finalSkuId = '1c1d1971-da7e-4669-889a-5eb33e62a53e'; // Fallback
      }

      return {
        order_id: orderId,
        product_sku_id: finalSkuId,
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

    if (itemsErr) throw itemsErr;

    // 6. Record status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      from_status: currentOrder.status,
      to_status: params.status || currentOrder.status,
      notes: 'Order items and pricing modified by staff'
    });

    return {
      id: orderId,
      orderNumber: currentOrder.order_number.startsWith('#') ? currentOrder.order_number : `#${currentOrder.order_number}`,
      retailerId: targetCustomerId,
      retailerName: customerData?.business_name || (currentOrder as any).customers?.business_name || 'Retailer',
      retailerChannelId: channelId,
      retailerChannelName: channelName,
      retailerChannelCode: (customerData as any)?.sales_channels?.code,
      orderDate: currentOrder.order_date,
      deliveryDate: params.deliveryDate !== undefined ? params.deliveryDate : currentOrder.requested_delivery_date,
      status: (params.status || currentOrder.status) as OrderStatus,
      totalAmount,
      paymentStatus: (currentOrder as any).payment_status || 'unpaid',
      notes: params.notes !== undefined ? params.notes : currentOrder.notes,
      items: params.items.map(i => ({
        productId: i.productId || i.skuId || '',
        skuId: i.skuId,
        productName: i.productName || 'Dairy Product',
        unit: (i.productId ? skuMap[i.productId]?.pack_size : undefined) || 'pack',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice,
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
