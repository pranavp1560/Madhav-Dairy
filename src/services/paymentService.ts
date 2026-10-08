import { supabase } from '../lib/supabase';
import { 
  Payment, 
  PaymentMethod, 
  CustomerOutstandingSummary, 
  CustomerOutstandingInvoice, 
  InvoiceAllocationInput, 
  RecordCustomerPaymentResult 
} from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

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
        is_accounted,
        accounted_at,
        accounted_by,
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
        isAccounted: p.is_accounted || false,
        accountedAt: p.accounted_at || undefined,
        accountedBy: p.accounted_by || undefined,
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
    const orgId = await getEffectiveOrgId();
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

    // If linked to an invoice, use the workflow RPC
    if (params.invoiceNumber && params.invoiceNumber !== 'Direct Payment') {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, total_amount, status')
        .eq('invoice_number', params.invoiceNumber)
        .maybeSingle();

      if (inv) {
        // If invoice is still 'ready', mark it delivered first so payment can be allocated
        if (inv.status === 'ready') {
          await supabase.rpc('mark_invoice_delivered', { p_invoice_id: inv.id });
        }

        const { data: allocResult, error: allocErr } = await supabase.rpc('allocate_invoice_payment', {
          p_invoice_id: inv.id,
          p_amount: params.amount,
          p_payment_method: params.paymentMethod,
          p_reference: params.reference,
          p_notes: params.notes || null,
          p_payment_date: today
        });

        if (allocErr) throw allocErr;

        return {
          id: allocResult?.payment_id || `temp-${Date.now()}`,
          paymentNumber: allocResult?.payment_number || payNum,
          date: today,
          retailerId: params.retailerId,
          retailerName: 'Retailer Customer',
          invoiceNumber: params.invoiceNumber,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          reference: params.reference,
          notes: params.notes,
          recordedBy: 'Finance Desk',
          isAccounted: false,
        };
      }
    }

    // Direct unallocated payment fallback
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
        is_accounted: false,
      })
      .select('*, customers(business_name)')
      .single();

    if (pErr) throw pErr;

    // Post double-entry Credit to customer ledger
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
      isAccounted: false,
    };
  },

  async getCustomerOutstandingSummary(customerId: string): Promise<CustomerOutstandingSummary | null> {
    const { data, error } = await supabase.rpc('get_customer_outstanding_summary', {
      p_customer_id: customerId,
    });
    if (error) throw error;
    if (!data) return null;
    return {
      customer_id: data.customer_id,
      business_name: data.business_name,
      customer_code: data.customer_code,
      mobile: data.mobile,
      credit_limit: Number(data.credit_limit || 0),
      total_outstanding: Number(data.total_outstanding || 0),
      outstanding_invoice_count: Number(data.outstanding_invoice_count || 0),
    };
  },

  async getCustomerOutstandingInvoices(customerId: string): Promise<CustomerOutstandingInvoice[]> {
    const { data, error } = await supabase.rpc('get_customer_outstanding_invoices', {
      p_customer_id: customerId,
    });
    if (error) throw error;
    return (data || []).map((inv: any): CustomerOutstandingInvoice => ({
      id: inv.id || inv.invoice_id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      status: inv.status,
      total_amount: Number(inv.total_amount || 0),
      already_paid: Number(inv.already_paid ?? inv.allocated_amount ?? 0),
      outstanding_amount: Number(inv.outstanding_amount || 0),
    }));
  },

  async recordCustomerPaymentWithAllocations(params: {
    customerId: string;
    paymentAmount: number;
    paymentMethod: PaymentMethod;
    allocations: InvoiceAllocationInput[];
    referenceNumber: string;
    notes?: string;
    paymentDate?: string;
    userId?: string;
  }): Promise<RecordCustomerPaymentResult> {
    const { data, error } = await supabase.rpc('record_customer_payment_with_allocations', {
      p_customer_id: params.customerId,
      p_payment_amount: params.paymentAmount,
      p_payment_method: params.paymentMethod,
      p_allocations: params.allocations,
      p_reference_number: params.referenceNumber,
      p_notes: params.notes || null,
      p_payment_date: params.paymentDate || new Date().toISOString().split('T')[0],
      p_user_id: params.userId || null,
    });

    if (error) throw error;
    return data as RecordCustomerPaymentResult;
  },
};
