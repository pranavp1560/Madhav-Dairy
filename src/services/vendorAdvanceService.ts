import { supabase } from '../lib/supabase';

export type AdvancePaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';

export interface VendorAdvance {
  id: string;
  advanceNumber: string;
  vendorName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: AdvancePaymentMethod;
  referenceNumber: string;
  notes: string;
  createdAt: string;
}

export interface VendorAdvanceAdjustment {
  id: string;
  advanceId: string;
  expenseId: string;
  amount: number;
  notes: string;
  createdAt: string;
}

export const vendorAdvanceService = {
  async fetchAdvances(): Promise<VendorAdvance[]> {
    const { data, error } = await supabase
      .from('vendor_advances')
      .select('id, advance_number, vendor_name, amount, payment_date, payment_method, reference_number, notes, created_at')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      advanceNumber: row.advance_number,
      vendorName: row.vendor_name,
      amount: Number(row.amount),
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number || '',
      notes: row.notes || '',
      createdAt: row.created_at,
    }));
  },

  async fetchAdjustments(): Promise<VendorAdvanceAdjustment[]> {
    const { data, error } = await supabase
      .from('vendor_advance_adjustments')
      .select('id, advance_id, expense_id, amount, notes, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      advanceId: row.advance_id,
      expenseId: row.expense_id,
      amount: Number(row.amount),
      notes: row.notes || '',
      createdAt: row.created_at,
    }));
  },

  async createAdvance(params: {
    vendorName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: AdvancePaymentMethod;
    referenceNumber?: string;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('create_vendor_advance', {
      p_vendor_name: params.vendorName.trim(),
      p_amount: params.amount,
      p_payment_date: params.paymentDate,
      p_payment_method: params.paymentMethod,
      p_reference_number: params.referenceNumber || null,
      p_notes: params.notes || null,
    });
    if (error) throw error;
  },

  async adjustAdvance(params: {
    advanceId: string;
    expenseId: string;
    amount: number;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('adjust_vendor_advance_to_expense', {
      p_advance_id: params.advanceId,
      p_expense_id: params.expenseId,
      p_amount: params.amount,
      p_notes: params.notes || null,
    });
    if (error) throw error;
  },
};
