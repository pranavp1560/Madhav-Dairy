import { supabase } from '../lib/supabase';
import { Invoice, InvoiceItem } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const invoiceService = {
  async fetchInvoices(): Promise<Invoice[]> {
    const { data: invs, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        order_id,
        customer_id,
        invoice_date,
        due_date,
        subtotal,
        discount_amount,
        tax_amount,
        total_amount,
        status,
        delivered_at,
        delivered_by,
        settled_at,
        settled_by,
        orders(
          order_number
        ),
        customers(
          business_name,
          gstin,
          address
        ),
        invoice_items(
          id,
          product_sku_id,
          batch_id,
          quantity,
          rate,
          discount_amount,
          tax_percent,
          tax_amount,
          line_total,
          batches(batch_number),
          product_skus(
            pack_size,
            unit,
            products(id, name)
          )
        )
      `)
      .order('invoice_date', { ascending: false });

    if (error) throw error;

    // Fetch payments allocations to determine paid amounts
    const { data: allocs } = await supabase
      .from('payment_allocations')
      .select('invoice_id, allocated_amount');

    const paidMap: Record<string, number> = {};
    if (allocs) {
      allocs.forEach((a: any) => {
        paidMap[a.invoice_id] = (paidMap[a.invoice_id] || 0) + Number(a.allocated_amount);
      });
    }

    return (invs || []).map((inv: any): Invoice => {
      const items: InvoiceItem[] = (inv.invoice_items || []).map((it: any) => {
        const prod = it.product_skus?.products;
        return {
          productId: prod?.id || it.product_sku_id,
          productName: prod?.name || 'Dairy Product',
          batchNumber: it.batches?.batch_number || 'BATCH-STD',
          unit: it.product_skus?.pack_size || it.product_skus?.unit || 'pack',
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          taxPercent: Number(it.tax_percent || 0),
          discount: Number(it.discount_amount || 0),
          amount: Number(it.line_total),
        };
      });

      const total = Number(inv.total_amount);
      const paid = paidMap[inv.id] || (inv.status === 'settled' || inv.status === 'paid' ? total : 0);
      const outstanding = Math.max(0, total - paid);

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        orderId: inv.order_id || undefined,
        orderNumber: inv.orders?.order_number || undefined,
        retailerId: inv.customer_id,
        retailerName: inv.customers?.business_name || 'Retailer Customer',
        retailerGstin: inv.customers?.gstin || '27AABCM9124K1Z0',
        retailerAddress: inv.customers?.address || 'Maharashtra',
        date: inv.invoice_date,
        dueDate: inv.due_date,
        items,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.tax_amount),
        discountAmount: Number(inv.discount_amount),
        totalAmount: total,
        paidAmount: paid,
        outstandingAmount: outstanding,
        status: inv.status as any,
        deliveredAt: inv.delivered_at || undefined,
        deliveredBy: inv.delivered_by || undefined,
        settledAt: inv.settled_at || undefined,
        settledBy: inv.settled_by || undefined,
      };
    });
  },

  async createInvoice(params: {
    retailerId: string;
    items: {
      productId: string;
      batchNumber: string;
      quantity: number;
      rate: number;
      taxPercent: number;
      discount?: number;
    }[];
  }): Promise<Invoice> {
    const orgId = await getEffectiveOrgId();
    let invNum = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { data: seq } = await supabase.rpc('next_document_number', {
        p_org_id: orgId,
        p_doc_type: 'invoice',
        p_prefix: 'INV',
        p_padding: 4
      });
      if (seq) invNum = seq;
    } catch {
      // Fallback
    }

    const subtotal = params.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
    const taxAmount = params.items.reduce((s, it) => s + (it.quantity * it.rate * (it.taxPercent / 100)), 0);
    const discountAmount = params.items.reduce((s, it) => s + (it.discount || 0), 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

    // 1. Insert invoice
    const { data: newInv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        organization_id: orgId,
        customer_id: params.retailerId,
        invoice_number: invNum,
        invoice_date: today,
        due_date: dueDate,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: 'ready',
      })
      .select('*, customers(business_name, gstin, address)')
      .single();

    if (invErr) throw invErr;

    // 2. Fetch default skus and batches
    const { data: skus } = await supabase
      .from('product_skus')
      .select('id, product_id, pack_size')
      .in('product_id', params.items.map(i => i.productId));

    const skuMap: Record<string, string> = {};
    if (skus) {
      skus.forEach((s: any) => {
        if (!skuMap[s.product_id]) skuMap[s.product_id] = s.id;
      });
    }

    const { data: batches } = await supabase
      .from('batches')
      .select('id, batch_number');

    const batchMap: Record<string, string> = {};
    if (batches) {
      batches.forEach((b: any) => {
        batchMap[b.batch_number] = b.id;
      });
    }

    // 3. Insert invoice items
    const invItemsRows = params.items.map(it => {
      const skuId = skuMap[it.productId];
      if (!skuId) {
        throw new Error(`Cannot invoice item: No active SKU found for product ${it.productId}`);
      }
      return {
        invoice_id: newInv.id,
        product_sku_id: skuId,
        batch_id: batchMap[it.batchNumber] || null,
        quantity: it.quantity,
        rate: it.rate,
        discount_amount: it.discount || 0,
        tax_percent: it.taxPercent,
        tax_amount: it.quantity * it.rate * (it.taxPercent / 100),
        line_total: it.quantity * it.rate,
      };
    });

    await supabase.from('invoice_items').insert(invItemsRows);

    // 4. Deduct sold quantity from batch_stock and record inventory transaction
    for (const it of invItemsRows) {
      if (it.batch_id) {
        const { data: bStock } = await supabase
          .from('batch_stock')
          .select('location_id, quantity_on_hand')
          .eq('batch_id', it.batch_id)
          .maybeSingle();

        if (bStock) {
          const newOnHand = Math.max(0, Number(bStock.quantity_on_hand) - Number(it.quantity));
          await supabase
            .from('batch_stock')
            .update({ quantity_on_hand: newOnHand, updated_at: new Date().toISOString() })
            .eq('batch_id', it.batch_id);

          if (newOnHand === 0) {
            await supabase
              .from('batches')
              .update({ status: 'exhausted', updated_at: new Date().toISOString() })
              .eq('id', it.batch_id)
              .eq('status', 'active');
          }

          await supabase.from('inventory_transactions').insert({
            organization_id: orgId,
            location_id: bStock.location_id,
            product_sku_id: it.product_sku_id,
            batch_id: it.batch_id,
            transaction_type: 'sale',
            quantity: -it.quantity,
            reference_type: 'invoice',
            reference_id: newInv.id,
            notes: 'Direct invoice sales delivery',
          });
        }
      }
    }

    // 5. Double-Entry Customer Ledger (Debit Entry)
    await supabase.from('ledger_entries').insert({
      organization_id: orgId,
      customer_id: params.retailerId,
      entry_date: today,
      entry_type: 'invoice',
      reference_type: 'invoices',
      reference_id: newInv.id,
      debit: totalAmount,
      credit: null,
      description: `Tax Invoice ${invNum} sales charge`,
    });

    return {
      id: newInv.id,
      invoiceNumber: invNum,
      retailerId: params.retailerId,
      retailerName: newInv.customers?.business_name || 'Retailer Customer',
      retailerGstin: newInv.customers?.gstin || '',
      retailerAddress: newInv.customers?.address || '',
      date: today,
      dueDate,
      items: params.items.map(it => ({
        productId: it.productId,
        productName: 'Product Item',
        batchNumber: it.batchNumber,
        unit: 'pack',
        quantity: it.quantity,
        rate: it.rate,
        taxPercent: it.taxPercent,
        discount: it.discount || 0,
        amount: it.quantity * it.rate,
      })),
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paidAmount: 0,
      outstandingAmount: totalAmount,
      status: 'ready',
    };
  },

  async markDelivered(invoiceId: string, userId?: string) {
    const { data, error } = await supabase.rpc('mark_invoice_delivered', {
      p_invoice_id: invoiceId,
      p_user_id: userId || null,
    });
    if (error) throw error;
    return data;
  },

  async bulkDeliver(invoiceIds: string[], userId?: string) {
    const { data, error } = await supabase.rpc('bulk_deliver_invoices', {
      p_invoice_ids: invoiceIds,
      p_user_id: userId || null,
    });
    if (error) throw error;
    return data;
  },

  async allocatePayment(params: {
    invoiceId: string;
    amount: number;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
    userId?: string;
    paymentDate?: string;
  }) {
    const { data, error } = await supabase.rpc('allocate_invoice_payment', {
      p_invoice_id: params.invoiceId,
      p_amount: params.amount,
      p_payment_method: params.paymentMethod || 'cash',
      p_reference: params.reference || null,
      p_notes: params.notes || null,
      p_user_id: params.userId || null,
      p_payment_date: params.paymentDate || new Date().toISOString().split('T')[0],
    });
    if (error) throw error;
    return data;
  },

  async confirmPayment(invoiceId: string, userId?: string) {
    const { data, error } = await supabase.rpc('confirm_invoice_payment', {
      p_invoice_id: invoiceId,
      p_user_id: userId || null,
    });
    if (error) throw error;
    return data;
  },

  async bulkConfirmPayments(invoiceIds: string[], userId?: string) {
    const { data, error } = await supabase.rpc('bulk_confirm_invoice_payments', {
      p_invoice_ids: invoiceIds,
      p_user_id: userId || null,
    });
    if (error) throw error;
    return data;
  },

  async rejectPayment(invoiceId: string, reason: string) {
    const { data: inv, error: fetchErr } = await supabase
      .from('invoices')
      .select('notes')
      .eq('id', invoiceId)
      .single();
    if (fetchErr) throw fetchErr;

    const newNotes = inv?.notes
      ? `[Payment Rejected: ${reason.trim()}] ${inv.notes}`
      : `[Payment Rejected: ${reason.trim()}]`;

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'delivered',
        notes: newNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (error) throw error;
    return { success: true };
  }
};

