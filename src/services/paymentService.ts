import { supabase } from '../lib/supabase';
import { Payment, PaymentMethod } from '../types/dairy';

export const paymentService = {
  async fetchPayments(): Promise<Payment[]> {
    const { data: payList, error } = await supabase
      .from('payments')
      .select(`
        id,
        payment_number,
        payment_date,
        customer_id,
        amount,
        payment_method,
        reference_number,
        notes,
        customers(business_name),
        payment_allocations(
          allocated_amount,
          invoices(invoice_number)
        )
      `)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return (payList || []).map((p: any): Payment => {
      const invNum = (p.payment_allocations?.[0] as any)?.invoices?.invoice_number || 'Direct Payment';
      return {
        id: p.id,
        paymentNumber: p.payment_number,
        date: p.payment_date,
        retailerId: p.customer_id,
        retailerName: p.customers?.business_name || 'Retailer Customer',
        invoiceNumber: invNum,
        amount: Number(p.amount),
        paymentMethod: p.payment_method as PaymentMethod,
        reference: p.reference_number || 'Direct Transfer',
        notes: p.notes || undefined,
        recordedBy: 'Finance Desk',
      };
    });
  },

  async recordPayment(params: {
    retailerId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    reference: string;
    notes?: string;
  }): Promise<Payment> {
    const orgId = '00000000-0000-0000-0000-000000000001';
    let payNum = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { data: seq } = await supabase.rpc('next_document_number', {
        p_org_id: orgId,
        p_doc_type: 'payment',
        p_prefix: 'REC',
        p_padding: 4
      });
      if (seq) payNum = seq;
    } catch {
      // Fallback
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Insert payment
    const { data: newPay, error: pErr } = await supabase
      .from('payments')
      .insert({
        organization_id: orgId,
        customer_id: params.retailerId,
        payment_number: payNum,
        payment_date: today,
        amount: params.amount,
        payment_method: params.paymentMethod,
        reference_number: params.reference,
        notes: params.notes || null,
      })
      .select('*, customers(business_name)')
      .single();

    if (pErr) throw pErr;

    // 2. Locate invoice if applicable
    if (params.invoiceNumber && params.invoiceNumber !== 'Direct Payment') {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('invoice_number', params.invoiceNumber)
        .maybeSingle();

      if (inv) {
        // Allocate payment
        await supabase.from('payment_allocations').insert({
          payment_id: newPay.id,
          invoice_id: inv.id,
          allocated_amount: params.amount,
        });

        // Update invoice status if paid in full
        await supabase.from('invoices').update({
          status: 'paid'
        }).eq('id', inv.id);
      }
    }

    // 3. Post double-entry Credit to customer ledger
    await supabase.from('ledger_entries').insert({
      organization_id: orgId,
      customer_id: params.retailerId,
      entry_date: today,
      entry_type: 'payment',
      reference_type: 'payments',
      reference_id: newPay.id,
      debit: null,
      credit: params.amount,
      description: `Payment received (${params.paymentMethod.toUpperCase()}) Ref: ${params.reference}`,
    });

    return {
      id: newPay.id,
      paymentNumber: payNum,
      date: today,
      retailerId: params.retailerId,
      retailerName: newPay.customers?.business_name || 'Retailer Customer',
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      reference: params.reference,
      notes: params.notes,
      recordedBy: 'Finance Desk',
    };
  }
};
