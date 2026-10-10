import { supabase } from '../lib/supabase';
import { BusinessPaymentMethod, CustomerPaymentSubmission, PaymentSubmissionStatus } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const paymentMethodService = {
  /**
   * Fetch all business payment methods.
   * Customers receive active methods; Internal staff receive all methods for their organization.
   */
  async fetchPaymentMethods(): Promise<BusinessPaymentMethod[]> {
    const { data, error } = await supabase
      .from('business_payment_methods')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }

    return (data || []).map((row: any): BusinessPaymentMethod => ({
      id: row.id,
      organizationId: row.organization_id,
      methodType: row.method_type,
      displayName: row.display_name,
      accountHolderName: row.account_holder_name || undefined,
      bankName: row.bank_name || undefined,
      accountNumber: row.account_number || undefined,
      ifscCode: row.ifsc_code || undefined,
      branchName: row.branch_name || undefined,
      upiId: row.upi_id || undefined,
      qrCodeUrl: row.qr_code_url || undefined,
      instructions: row.instructions || undefined,
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Create a new business payment method (Admin only).
   */
  async createPaymentMethod(method: {
    methodType: 'bank_account' | 'upi';
    displayName: string;
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    upiId?: string;
    qrCodeUrl?: string;
    instructions?: string;
    isActive: boolean;
    isDefault: boolean;
  }): Promise<BusinessPaymentMethod> {
    const orgId = await getEffectiveOrgId();
    const { data: { user } } = await supabase.auth.getUser();

    // If set as default, unset other defaults of the same method type first
    if (method.isDefault) {
      await supabase
        .from('business_payment_methods')
        .update({ is_default: false })
        .eq('organization_id', orgId)
        .eq('method_type', method.methodType);
    }

    const { data, error } = await supabase
      .from('business_payment_methods')
      .insert({
        organization_id: orgId,
        method_type: method.methodType,
        display_name: method.displayName.trim(),
        account_holder_name: method.accountHolderName?.trim() || null,
        bank_name: method.bankName?.trim() || null,
        account_number: method.accountNumber?.trim() || null,
        ifsc_code: method.ifscCode?.trim().toUpperCase() || null,
        branch_name: method.branchName?.trim() || null,
        upi_id: method.upiId?.trim() || null,
        qr_code_url: method.qrCodeUrl || null,
        instructions: method.instructions?.trim() || null,
        is_active: method.isActive,
        is_default: method.isDefault,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      methodType: data.method_type,
      displayName: data.display_name,
      accountHolderName: data.account_holder_name || undefined,
      bankName: data.bank_name || undefined,
      accountNumber: data.account_number || undefined,
      ifscCode: data.ifsc_code || undefined,
      branchName: data.branch_name || undefined,
      upiId: data.upi_id || undefined,
      qrCodeUrl: data.qr_code_url || undefined,
      instructions: data.instructions || undefined,
      isActive: Boolean(data.is_active),
      isDefault: Boolean(data.is_default),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Update an existing payment method (Admin only).
   */
  async updatePaymentMethod(id: string, updates: Partial<BusinessPaymentMethod>): Promise<void> {
    const orgId = await getEffectiveOrgId();
    const { data: { user } } = await supabase.auth.getUser();

    // If making this method default, unset other defaults of same type
    if (updates.isDefault && updates.methodType) {
      await supabase
        .from('business_payment_methods')
        .update({ is_default: false })
        .eq('organization_id', orgId)
        .eq('method_type', updates.methodType)
        .neq('id', id);
    }

    const payload: any = {
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    };

    if (updates.displayName !== undefined) payload.display_name = updates.displayName.trim();
    if (updates.methodType !== undefined) payload.method_type = updates.methodType;
    if (updates.accountHolderName !== undefined) payload.account_holder_name = updates.accountHolderName?.trim() || null;
    if (updates.bankName !== undefined) payload.bank_name = updates.bankName?.trim() || null;
    if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber?.trim() || null;
    if (updates.ifscCode !== undefined) payload.ifsc_code = updates.ifscCode?.trim().toUpperCase() || null;
    if (updates.branchName !== undefined) payload.branch_name = updates.branchName?.trim() || null;
    if (updates.upiId !== undefined) payload.upi_id = updates.upiId?.trim() || null;
    if (updates.qrCodeUrl !== undefined) payload.qr_code_url = updates.qrCodeUrl || null;
    if (updates.instructions !== undefined) payload.instructions = updates.instructions?.trim() || null;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;

    const { error } = await supabase
      .from('business_payment_methods')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  },

  /**
   * Toggle payment method active status (Admin only).
   */
  async togglePaymentMethodStatus(id: string, isActive: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('business_payment_methods')
      .update({
        is_active: isActive,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling payment method status:', error);
      throw error;
    }
  },

  /**
   * Delete payment method (Admin only).
   */
  async deletePaymentMethod(id: string): Promise<void> {
    const { error } = await supabase
      .from('business_payment_methods')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  },

  /**
   * Upload QR code image to Supabase Storage bucket 'payment-assets'.
   * Validates file size (max 2MB) and type.
   */
  async uploadQrCode(file: File): Promise<string> {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file format. Only PNG, JPG, or WEBP images are allowed.');
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('QR code image size must not exceed 2MB.');
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `qr-codes/qr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading QR code:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('payment-assets')
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  /**
   * Upload payment receipt or transaction screenshot to Supabase Storage.
   * Validates file size (max 5MB) and type.
   */
  async uploadReceipt(file: File): Promise<string> {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file format. Only PNG, JPG, WEBP images or PDF files are allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Receipt file size must not exceed 5MB.');
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `receipts/rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading receipt:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('payment-assets')
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  /**
   * Customer submits a payment transaction reference claim for an invoice.
   * Invokes atomic validation RPC `submit_customer_payment`.
   */
  async submitCustomerPayment(params: {
    invoiceId: string;
    paymentMethodType: 'upi' | 'bank_transfer' | 'other';
    transactionReference: string;
    amount: number;
    paymentMethodId?: string;
    transactionDate?: string;
    receiptUrl?: string;
    notes?: string;
  }): Promise<{ success: boolean; submission_id: string; message: string }> {
    const { data, error } = await supabase.rpc('submit_customer_payment', {
      p_invoice_id: params.invoiceId,
      p_payment_method_type: params.paymentMethodType,
      p_transaction_reference: params.transactionReference,
      p_amount: params.amount,
      p_payment_method_id: params.paymentMethodId || null,
      p_transaction_date: params.transactionDate || new Date().toISOString().split('T')[0],
      p_receipt_url: params.receiptUrl || null,
      p_notes: params.notes || null,
    });

    if (error) {
      console.error('Error submitting customer payment:', error);
      throw error;
    }

    return data as any;
  },

  /**
   * Fetch customer payment submissions.
   * If customerId is provided, filters to that customer; otherwise returns organization-wide submissions.
   */
  async fetchPaymentSubmissions(options?: {
    customerId?: string;
    status?: PaymentSubmissionStatus;
  }): Promise<CustomerPaymentSubmission[]> {
    let query = supabase
      .from('customer_payment_submissions')
      .select(`
        *,
        customers (
          id,
          business_name,
          customer_code
        ),
        invoices (
          id,
          invoice_number,
          total_amount
        ),
        payments (
          id,
          payment_number
        )
      `)
      .order('submitted_at', { ascending: false });

    if (options?.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payment submissions:', error);
      throw error;
    }

    return (data || []).map((row: any): CustomerPaymentSubmission => ({
      id: row.id,
      organizationId: row.organization_id,
      customerId: row.customer_id,
      customerName: row.customers?.business_name || 'Retail Customer',
      customerCode: row.customers?.customer_code || undefined,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoices?.invoice_number || 'INV-REF',
      invoiceTotalAmount: Number(row.invoices?.total_amount || 0),
      paymentMethodId: row.payment_method_id || undefined,
      paymentMethodType: row.payment_method_type,
      transactionReference: row.transaction_reference,
      amount: Number(row.amount),
      transactionDate: row.transaction_date,
      receiptUrl: row.receipt_url || undefined,
      notes: row.notes || undefined,
      status: row.status as PaymentSubmissionStatus,
      submittedAt: row.submitted_at,
      verifiedBy: row.verified_by || undefined,
      verifiedAt: row.verified_at || undefined,
      rejectionReason: row.rejection_reason || undefined,
      accountedPaymentId: row.accounted_payment_id || undefined,
      accountedPaymentNumber: row.payments?.payment_number || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Owner / Admin verifies and marks an open submission as accounted.
   * Atomically logs payment, allocates to invoice, updates ledger, and transitions submission.
   */
  async verifyAndAccountSubmission(
    submissionId: string,
    verificationNotes?: string
  ): Promise<{
    success: boolean;
    payment_id: string;
    payment_number: string;
    invoice_number: string;
    new_invoice_status: string;
  }> {
    const { data, error } = await supabase.rpc('verify_and_account_payment_submission', {
      p_submission_id: submissionId,
      p_verification_notes: verificationNotes || null,
    });

    if (error) {
      console.error('Error verifying and accounting submission:', error);
      throw error;
    }

    return data as any;
  },

  /**
   * Owner / Admin rejects a customer payment submission with a required rejection reason.
   */
  async rejectSubmission(
    submissionId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; status: string; rejection_reason: string }> {
    const { data, error } = await supabase.rpc('reject_payment_submission', {
      p_submission_id: submissionId,
      p_rejection_reason: rejectionReason,
    });

    if (error) {
      console.error('Error rejecting payment submission:', error);
      throw error;
    }

    return data as any;
  },
};
