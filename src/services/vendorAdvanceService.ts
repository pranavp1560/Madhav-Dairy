import { supabase } from '../lib/supabase';
import {
  VendorAdvance,
  VendorBill,
  VendorAdvanceAdjustment,
  VendorAdvanceSummary,
  PaymentMethod,
  AdvanceStatus,
  VendorBillStatus
} from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const vendorAdvanceService = {
  /**
   * Fetch all vendor / farmer advances for the effective organization.
   */
  async fetchAdvances(): Promise<VendorAdvance[]> {
    const orgId = await getEffectiveOrgId();

    const { data, error } = await supabase
      .from('vendor_advances')
      .select('*')
      .order('advance_date', { ascending: false });

    if (error) {
      console.warn('Error fetching vendor advances:', error);
      throw error;
    }

    return (data || []).map((row: any): VendorAdvance => ({
      id: row.id,
      organizationId: row.organization_id,
      advanceNumber: row.advance_number,
      supplierId: row.supplier_id || undefined,
      vendorName: row.vendor_name,
      advanceDate: row.advance_date,
      amount: Number(row.amount || 0),
      adjustedAmount: Number(row.adjusted_amount || 0),
      balanceAmount: Number(row.balance_amount || 0),
      paymentMethod: row.payment_method as PaymentMethod,
      referenceNumber: row.reference_number || undefined,
      notes: row.notes || undefined,
      status: row.status as AdvanceStatus,
      recordedBy: row.recorded_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Fetch vendor bills. Optionally filter by supplier or vendor name.
   */
  async fetchBills(supplierId?: string): Promise<VendorBill[]> {
    let query = supabase
      .from('vendor_bills')
      .select('*')
      .order('bill_date', { ascending: false });

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Error fetching vendor bills:', error);
      throw error;
    }

    return (data || []).map((row: any): VendorBill => ({
      id: row.id,
      organizationId: row.organization_id,
      billNumber: row.bill_number,
      supplierId: row.supplier_id || undefined,
      vendorName: row.vendor_name,
      billDate: row.bill_date,
      dueDate: row.due_date || undefined,
      category: row.category || 'Raw Milk Procurement',
      totalAmount: Number(row.total_amount || 0),
      adjustedAmount: Number(row.adjusted_amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      balanceAmount: Number(row.balance_amount || 0),
      status: row.status as VendorBillStatus,
      notes: row.notes || undefined,
      expenseId: row.expense_id || undefined,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Fetch all advance adjustment audit log entries.
   */
  async fetchAdjustments(): Promise<VendorAdvanceAdjustment[]> {
    const { data, error } = await supabase
      .from('vendor_advance_adjustments')
      .select('*')
      .order('adjustment_date', { ascending: false });

    if (error) {
      console.warn('Error fetching advance adjustments:', error);
      throw error;
    }

    return (data || []).map((row: any): VendorAdvanceAdjustment => ({
      id: row.id,
      organizationId: row.organization_id,
      adjustmentNumber: row.adjustment_number,
      advanceId: row.advance_id,
      billId: row.bill_id,
      supplierId: row.supplier_id || undefined,
      vendorName: row.vendor_name,
      billNumber: row.bill_number,
      advanceNumber: row.advance_number,
      adjustmentDate: row.adjustment_date,
      adjustedAmount: Number(row.adjusted_amount || 0),
      notes: row.notes || undefined,
      adjustedBy: row.adjusted_by || undefined,
      createdAt: row.created_at,
    }));
  },

  /**
   * Record a new advance disbursed to a vendor/farmer.
   */
  async recordAdvance(params: {
    supplierId?: string;
    vendorName: string;
    amount: number;
    paymentMethod: PaymentMethod;
    advanceDate?: string;
    referenceNumber?: string;
    notes?: string;
  }): Promise<{ success: boolean; advanceId: string; advanceNumber: string }> {
    if (params.amount <= 0) {
      throw new Error('Advance amount must be greater than zero.');
    }

    // Try RPC first for server-side validation & sequence generation
    const { data: rpcResult, error: rpcError } = await supabase.rpc('record_vendor_advance', {
      p_supplier_id: params.supplierId || null,
      p_vendor_name: params.vendorName,
      p_amount: params.amount,
      p_payment_method: params.paymentMethod,
      p_advance_date: params.advanceDate || new Date().toISOString().split('T')[0],
      p_reference_number: params.referenceNumber || null,
      p_notes: params.notes || null,
    });

    if (!rpcError && rpcResult?.success) {
      return {
        success: true,
        advanceId: rpcResult.advance_id,
        advanceNumber: rpcResult.advance_number,
      };
    }

    // Fallback direct insert if RPC is unavailable
    const orgId = await getEffectiveOrgId();
    const advNum = `ADV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newRow, error: insertError } = await supabase
      .from('vendor_advances')
      .insert({
        organization_id: orgId,
        advance_number: advNum,
        supplier_id: params.supplierId || null,
        vendor_name: params.vendorName,
        advance_date: params.advanceDate || new Date().toISOString().split('T')[0],
        amount: params.amount,
        adjusted_amount: 0.00,
        balance_amount: params.amount,
        payment_method: params.paymentMethod,
        reference_number: params.referenceNumber || null,
        notes: params.notes || null,
        status: 'available',
      })
      .select('id, advance_number')
      .single();

    if (insertError) throw insertError;

    return {
      success: true,
      advanceId: newRow.id,
      advanceNumber: newRow.advance_number,
    };
  },

  /**
   * Create a new vendor bill / payable entry.
   */
  async createBill(params: {
    supplierId?: string;
    vendorName: string;
    billNumber?: string;
    billDate?: string;
    dueDate?: string;
    category?: string;
    totalAmount: number;
    notes?: string;
  }): Promise<{ success: boolean; billId: string; billNumber: string }> {
    if (params.totalAmount <= 0) {
      throw new Error('Bill amount must be greater than zero.');
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_vendor_bill', {
      p_supplier_id: params.supplierId || null,
      p_vendor_name: params.vendorName,
      p_bill_number: params.billNumber || null,
      p_bill_date: params.billDate || new Date().toISOString().split('T')[0],
      p_due_date: params.dueDate || null,
      p_category: params.category || 'Raw Milk Procurement',
      p_total_amount: params.totalAmount,
      p_notes: params.notes || null,
    });

    if (!rpcError && rpcResult?.success) {
      return {
        success: true,
        billId: rpcResult.bill_id,
        billNumber: rpcResult.bill_number,
      };
    }

    // Direct fallback
    const orgId = await getEffectiveOrgId();
    const billNum = params.billNumber?.trim() || `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newRow, error: insertError } = await supabase
      .from('vendor_bills')
      .insert({
        organization_id: orgId,
        bill_number: billNum,
        supplier_id: params.supplierId || null,
        vendor_name: params.vendorName,
        bill_date: params.billDate || new Date().toISOString().split('T')[0],
        due_date: params.dueDate || null,
        category: params.category || 'Raw Milk Procurement',
        total_amount: params.totalAmount,
        adjusted_amount: 0.00,
        paid_amount: 0.00,
        balance_amount: params.totalAmount,
        status: 'unpaid',
        notes: params.notes || null,
      })
      .select('id, bill_number')
      .single();

    if (insertError) throw insertError;

    return {
      success: true,
      billId: newRow.id,
      billNumber: newRow.bill_number,
    };
  },

  /**
   * Manually adjust an advance against a bill.
   * Guarantees atomic row-level locking and prevents over-adjustment.
   */
  async adjustAdvanceAgainstBill(params: {
    advanceId: string;
    billId: string;
    adjustmentAmount: number;
    adjustmentDate?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    adjustmentId: string;
    adjustmentNumber: string;
    newAdvanceBalance: number;
    newBillBalance: number;
  }> {
    if (params.adjustmentAmount <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }

    const { data, error } = await supabase.rpc('adjust_vendor_advance_against_bill', {
      p_advance_id: params.advanceId,
      p_bill_id: params.billId,
      p_adjustment_amount: params.adjustmentAmount,
      p_adjustment_date: params.adjustmentDate || new Date().toISOString().split('T')[0],
      p_notes: params.notes || null,
    });

    if (error) {
      console.error('Adjustment RPC failed:', error);
      throw new Error(error.message || 'Failed to adjust advance against bill');
    }

    if (!data?.success) {
      throw new Error('Failed to adjust advance against bill');
    }

    return {
      success: true,
      adjustmentId: data.adjustment_id,
      adjustmentNumber: data.adjustment_number,
      newAdvanceBalance: Number(data.new_advance_balance),
      newBillBalance: Number(data.new_bill_balance),
    };
  },

  /**
   * Adjust an advance directly against an expense / goods / raw material.
   * Guarantees atomic row-level locking and prevents over-adjustment.
   */
  async adjustAdvanceDirect(params: {
    advanceId: string;
    adjustmentAmount: number;
    description?: string;
    adjustmentDate?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    adjustmentId: string;
    adjustmentNumber: string;
    newAdvanceBalance: number;
    newAdjustedAmount: number;
  }> {
    if (params.adjustmentAmount <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }

    const { data, error } = await supabase.rpc('adjust_vendor_advance', {
      p_advance_id: params.advanceId,
      p_adjustment_amount: params.adjustmentAmount,
      p_description: params.description || null,
      p_adjustment_date: params.adjustmentDate || new Date().toISOString().split('T')[0],
      p_notes: params.notes || null,
    });

    if (error) {
      console.error('adjust_vendor_advance RPC failed:', error);
      throw new Error(error.message || 'Failed to adjust advance');
    }

    if (!data?.success) {
      throw new Error('Failed to adjust advance');
    }

    return {
      success: true,
      adjustmentId: data.adjustment_id,
      adjustmentNumber: data.adjustment_number,
      newAdvanceBalance: Number(data.new_advance_balance),
      newAdjustedAmount: Number(data.new_adjusted_amount),
    };
  }
};
