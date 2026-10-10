-- =============================================================================
-- Migration 034: Secure Payment Details Management & Customer Payment Verification
-- Module: Business Payment Methods, Customer Submissions, RLS & Verification RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BUSINESS PAYMENT METHODS TABLE
-- Stores official business bank accounts and UPI IDs managed by Owner / Admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type IN ('bank_account', 'upi')),
  display_name text NOT NULL,
  account_holder_name text,
  bank_name text,
  account_number text,
  ifsc_code text,
  branch_name text,
  upi_id text,
  qr_code_url text,
  instructions text,
  is_active boolean DEFAULT true NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_business_payment_methods_updated_at
  BEFORE UPDATE ON public.business_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for fast lookup and FK integrity
CREATE INDEX IF NOT EXISTS idx_biz_pm_org_id ON public.business_payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_biz_pm_active ON public.business_payment_methods(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_biz_pm_default ON public.business_payment_methods(organization_id, is_default);
CREATE INDEX IF NOT EXISTS idx_biz_pm_method_type ON public.business_payment_methods(organization_id, method_type);

-- -----------------------------------------------------------------------------
-- 2. CUSTOMER PAYMENT SUBMISSIONS TABLE
-- Stores payment claims submitted by customers against their invoices
-- Note: Submissions are claims only and NEVER automatically count as accounted payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  payment_method_id uuid REFERENCES public.business_payment_methods(id) ON DELETE SET NULL,
  payment_method_type text NOT NULL CHECK (payment_method_type IN ('upi', 'bank_transfer', 'other')),
  transaction_reference text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  transaction_date date DEFAULT CURRENT_DATE NOT NULL,
  receipt_url text,
  notes text,
  status text DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'accounted', 'rejected')),
  submitted_at timestamptz DEFAULT now() NOT NULL,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  rejection_reason text,
  accounted_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_customer_payment_submissions_updated_at
  BEFORE UPDATE ON public.customer_payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Partial unique index to prevent duplicate transaction reference claims
-- If a submission was rejected, customer can rectify and submit without collision
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_submission_ref_active
  ON public.customer_payment_submissions (organization_id, lower(trim(transaction_reference)))
  WHERE status != 'rejected';

-- Indexes for performance and query filtering
CREATE INDEX IF NOT EXISTS idx_pay_sub_org_id ON public.customer_payment_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_pay_sub_customer_id ON public.customer_payment_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_sub_invoice_id ON public.customer_payment_submissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pay_sub_status ON public.customer_payment_submissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pay_sub_submitted_at ON public.customer_payment_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_sub_accounted_pay ON public.customer_payment_submissions(accounted_payment_id);

-- -----------------------------------------------------------------------------
-- 3. STORAGE BUCKET INITIALIZATION
-- Bucket for official payment QR images and customer-submitted receipt screenshots
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-assets', 'payment-assets', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.business_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_submissions ENABLE ROW LEVEL SECURITY;

-- 4.1. Policies for business_payment_methods
-- Customers can read active payment methods to make payments
CREATE POLICY "Customers can view active payment methods"
  ON public.business_payment_methods
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- Internal staff and admin can view all payment methods
CREATE POLICY "Internal staff can view all payment methods"
  ON public.business_payment_methods
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal'
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- Only Owner / Admin can insert payment methods
CREATE POLICY "Admins can insert payment methods"
  ON public.business_payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- Only Owner / Admin can update payment methods
CREATE POLICY "Admins can update payment methods"
  ON public.business_payment_methods
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- Only Owner / Admin can delete payment methods
CREATE POLICY "Admins can delete payment methods"
  ON public.business_payment_methods
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- 4.2. Policies for customer_payment_submissions
-- Customers can view only their own payment submissions
CREATE POLICY "Customers can view own submissions"
  ON public.customer_payment_submissions
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT public.current_customer_id())
  );

-- Internal staff and admin can view all submissions for their organization
CREATE POLICY "Internal staff can view org payment submissions"
  ON public.customer_payment_submissions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal'
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- Customers can submit payment claims for their own invoices
CREATE POLICY "Customers can insert own payment submissions"
  ON public.customer_payment_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.current_user_type()) = 'customer'
    AND customer_id = (SELECT public.current_customer_id())
    AND organization_id = (SELECT public.current_user_org_id())
    AND status = 'open'
  );

-- Only Admins can update submissions directly (e.g. status transition)
CREATE POLICY "Admins can update payment submissions"
  ON public.customer_payment_submissions
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal'
    AND public.has_role('admin')
    AND organization_id = (SELECT public.current_user_org_id())
  );

-- 4.3. Storage policies for payment-assets bucket
DO $$
BEGIN
  -- Authenticated users can view payment-assets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public and authenticated can read payment assets'
  ) THEN
    CREATE POLICY "Public and authenticated can read payment assets"
      ON storage.objects FOR SELECT
      TO public, authenticated
      USING (bucket_id = 'payment-assets');
  END IF;

  -- Authenticated users can upload to payment-assets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload payment assets'
  ) THEN
    CREATE POLICY "Authenticated users can upload payment assets"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'payment-assets');
  END IF;

  -- Admins can update/delete payment assets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can modify payment assets'
  ) THEN
    CREATE POLICY "Admins can modify payment assets"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'payment-assets' AND public.has_role('admin'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. FUNCTION: SUBMIT_CUSTOMER_PAYMENT (Client RPC)
-- Validates customer identity, invoice ownership, outstanding balance, and duplicates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_customer_payment(
  p_invoice_id uuid,
  p_payment_method_type text,
  p_transaction_reference text,
  p_amount numeric,
  p_payment_method_id uuid DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE,
  p_receipt_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := (SELECT auth.uid());
  v_cust_id uuid;
  v_org_id uuid;
  v_inv record;
  v_already_allocated numeric(12,2) := 0;
  v_pending_open_amount numeric(12,2) := 0;
  v_effective_outstanding numeric(12,2) := 0;
  v_submission_id uuid;
  v_clean_ref text;
BEGIN
  -- 1. Ensure user is authenticated
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit payment';
  END IF;

  -- 2. Validate calling customer identity
  SELECT customer_id INTO v_cust_id
  FROM public.customer_users
  WHERE auth_user_id = v_caller_uid AND is_active = true
  LIMIT 1;

  IF v_cust_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is not linked to an active customer profile';
  END IF;

  -- 3. Clean and validate transaction reference
  v_clean_ref := trim(p_transaction_reference);
  IF v_clean_ref IS NULL OR length(v_clean_ref) < 3 THEN
    RAISE EXCEPTION 'A valid transaction reference / UTR number is required (minimum 3 characters)';
  END IF;

  -- 4. Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment submission amount must be greater than zero';
  END IF;

  -- 5. Validate payment method type
  IF p_payment_method_type NOT IN ('upi', 'bank_transfer', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method type. Supported types: upi, bank_transfer, other';
  END IF;

  -- 6. Lock and validate invoice ownership & status
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.customer_id != v_cust_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only submit payments for your own invoices';
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot submit payment for a cancelled invoice';
  END IF;

  IF v_inv.status = 'settled' THEN
    RAISE EXCEPTION 'Invoice % is already fully settled', v_inv.invoice_number;
  END IF;

  v_org_id := v_inv.organization_id;

  -- 7. Calculate authoritative outstanding balance
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_already_allocated
  FROM public.payment_allocations
  WHERE invoice_id = p_invoice_id;

  -- Calculate already pending open submissions on this invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending_open_amount
  FROM public.customer_payment_submissions
  WHERE invoice_id = p_invoice_id AND status = 'open';

  v_effective_outstanding := ROUND(v_inv.total_amount - v_already_allocated, 2);

  IF v_effective_outstanding <= 0 THEN
    RAISE EXCEPTION 'Invoice % has zero outstanding balance', v_inv.invoice_number;
  END IF;

  IF p_amount > v_effective_outstanding THEN
    RAISE EXCEPTION 'Submitted amount (₹%) exceeds invoice remaining outstanding balance (₹%)', 
      p_amount, v_effective_outstanding;
  END IF;

  -- 8. Check for duplicate reference
  IF EXISTS (
    SELECT 1 FROM public.customer_payment_submissions
    WHERE organization_id = v_org_id
      AND lower(trim(transaction_reference)) = lower(v_clean_ref)
      AND status != 'rejected'
  ) THEN
    RAISE EXCEPTION 'Transaction reference "%" has already been submitted and is currently being verified or accounted', v_clean_ref;
  END IF;

  -- 9. Insert submission record in Open status
  INSERT INTO public.customer_payment_submissions (
    organization_id,
    customer_id,
    invoice_id,
    payment_method_id,
    payment_method_type,
    transaction_reference,
    amount,
    transaction_date,
    receipt_url,
    notes,
    status,
    submitted_at,
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    v_cust_id,
    p_invoice_id,
    p_payment_method_id,
    p_payment_method_type,
    v_clean_ref,
    ROUND(p_amount, 2),
    p_transaction_date,
    p_receipt_url,
    p_notes,
    'open',
    now(),
    now(),
    now()
  ) RETURNING id INTO v_submission_id;

  -- 10. Generate in-app notification for internal team
  BEGIN
    INSERT INTO public.notifications (
      organization_id,
      recipient_user_id,
      customer_id,
      title,
      message,
      type,
      channel,
      reference_type,
      reference_id,
      created_at
    )
    SELECT
      v_org_id,
      p.id,
      v_cust_id,
      'New Payment Submission Awaiting Verification',
      'Retailer submitted ₹' || p_amount::text || ' for Invoice ' || v_inv.invoice_number || ' (Ref: ' || v_clean_ref || ')',
      'payment',
      'in_app',
      'payment_submission',
      v_submission_id,
      now()
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.organization_id = v_org_id 
      AND r.name IN ('admin', 'accountant')
    LIMIT 10;
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort notification, do not fail submission transaction
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_inv.invoice_number,
    'amount', p_amount,
    'transaction_reference', v_clean_ref,
    'status', 'open',
    'message', 'Payment reference submitted successfully. Your payment is awaiting verification by Madhav Dairy finance desk.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. FUNCTION: VERIFY_AND_ACCOUNT_PAYMENT_SUBMISSION (Admin RPC)
-- Atomically creates official payment, records ledger credit, updates invoice,
-- and transitions submission to 'accounted'. Idempotent and concurrency-locked.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_and_account_payment_submission(
  p_submission_id uuid,
  p_verification_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := (SELECT auth.uid());
  v_sub record;
  v_inv record;
  v_cust record;
  v_pay_id uuid;
  v_pay_num text;
  v_total_allocated numeric(12,2) := 0;
  v_new_invoice_status text;
  v_method_for_payment text;
BEGIN
  -- 1. Strict Authorization: Only Owner / Admin can verify and account payments
  IF v_caller_uid IS NULL OR NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Only Owner / Admin users are authorized to verify and mark payments as accounted';
  END IF;

  -- 2. Lock submission row FOR UPDATE
  SELECT * INTO v_sub
  FROM public.customer_payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;

  IF v_sub.status = 'accounted' THEN
    RAISE EXCEPTION 'Payment submission % has already been verified and accounted', p_submission_id;
  END IF;

  IF v_sub.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot account a rejected payment submission';
  END IF;

  -- 3. Lock linked invoice row FOR UPDATE
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = v_sub.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked invoice % not found', v_sub.invoice_id;
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Linked invoice % is cancelled', v_inv.invoice_number;
  END IF;

  -- 4. Lock customer row
  SELECT * INTO v_cust
  FROM public.customers
  WHERE id = v_sub.customer_id
  FOR UPDATE;

  -- 5. Generate official payment document number (REC-YYYY-XXXX)
  BEGIN
    v_pay_num := public.next_document_number(v_sub.organization_id, 'payment', 'REC', 4);
  EXCEPTION WHEN OTHERS THEN
    v_pay_num := NULL;
  END;

  IF v_pay_num IS NULL OR v_pay_num = '' THEN
    v_pay_num := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- Normalize payment method type for payments table
  IF v_sub.payment_method_type = 'upi' THEN
    v_method_for_payment := 'upi';
  ELSIF v_sub.payment_method_type = 'bank_transfer' THEN
    v_method_for_payment := 'bank_transfer';
  ELSE
    v_method_for_payment := 'other';
  END IF;

  -- 6. Insert official payment record
  INSERT INTO public.payments (
    organization_id,
    customer_id,
    payment_number,
    payment_date,
    amount,
    payment_method,
    reference_number,
    notes,
    is_accounted,
    accounted_at,
    accounted_by,
    recorded_by,
    created_at,
    updated_at
  ) VALUES (
    v_sub.organization_id,
    v_sub.customer_id,
    v_pay_num,
    v_sub.transaction_date,
    v_sub.amount,
    v_method_for_payment,
    v_sub.transaction_reference,
    COALESCE(p_verification_notes, v_sub.notes, 'Verified customer online payment'),
    true,
    now(),
    v_caller_uid,
    v_caller_uid,
    now(),
    now()
  ) RETURNING id INTO v_pay_id;

  -- 7. Insert payment allocation
  INSERT INTO public.payment_allocations (
    payment_id,
    invoice_id,
    allocated_amount,
    created_at
  ) VALUES (
    v_pay_id,
    v_sub.invoice_id,
    v_sub.amount,
    now()
  );

  -- 8. Post authoritative Double-Entry Ledger Credit
  INSERT INTO public.ledger_entries (
    organization_id,
    customer_id,
    entry_date,
    entry_type,
    reference_type,
    reference_id,
    debit,
    credit,
    description,
    created_at
  ) VALUES (
    v_sub.organization_id,
    v_sub.customer_id,
    v_sub.transaction_date,
    'payment',
    'payments',
    v_pay_id,
    null,
    v_sub.amount,
    'Accounted verified payment ' || v_pay_num || ' for Invoice ' || v_inv.invoice_number || ' (Ref: ' || v_sub.transaction_reference || ')',
    now()
  );

  -- 9. Recalculate total allocated amount for this invoice
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_total_allocated
  FROM public.payment_allocations
  WHERE invoice_id = v_sub.invoice_id;

  -- If total allocated >= invoice total_amount, mark Settled; otherwise Open Payment
  IF v_total_allocated >= v_inv.total_amount THEN
    v_new_invoice_status := 'settled';
    UPDATE public.invoices
    SET status = 'settled',
        settled_at = now(),
        settled_by = v_caller_uid,
        updated_at = now()
    WHERE id = v_sub.invoice_id;
  ELSE
    v_new_invoice_status := 'open_payment';
    UPDATE public.invoices
    SET status = 'open_payment',
        updated_at = now()
    WHERE id = v_sub.invoice_id;
  END IF;

  -- 10. Mark submission record as accounted
  UPDATE public.customer_payment_submissions
  SET status = 'accounted',
      verified_by = v_caller_uid,
      verified_at = now(),
      accounted_payment_id = v_pay_id,
      notes = CASE 
        WHEN p_verification_notes IS NOT NULL THEN COALESCE(notes || E'\nVerification note: ' || p_verification_notes, p_verification_notes)
        ELSE notes 
      END,
      updated_at = now()
  WHERE id = p_submission_id;

  -- 11. Send notification to Customer
  BEGIN
    INSERT INTO public.notifications (
      organization_id,
      recipient_user_id,
      customer_id,
      title,
      message,
      type,
      channel,
      reference_type,
      reference_id,
      created_at
    )
    SELECT
      v_sub.organization_id,
      cu.auth_user_id,
      v_sub.customer_id,
      'Payment Verified & Accounted',
      'Your payment of ₹' || v_sub.amount::text || ' for Invoice ' || v_inv.invoice_number || ' has been verified and accounted (Receipt: ' || v_pay_num || ').',
      'payment',
      'in_app',
      'invoices',
      v_sub.invoice_id,
      now()
    FROM public.customer_users cu
    WHERE cu.customer_id = v_sub.customer_id AND cu.is_active = true
    LIMIT 5;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'payment_id', v_pay_id,
    'payment_number', v_pay_num,
    'amount', v_sub.amount,
    'invoice_id', v_sub.invoice_id,
    'invoice_number', v_inv.invoice_number,
    'new_invoice_status', v_new_invoice_status,
    'total_allocated', v_total_allocated,
    'verified_at', now()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. FUNCTION: REJECT_PAYMENT_SUBMISSION (Admin RPC)
-- Marks submission as rejected with required reason, preserving audit history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_payment_submission(
  p_submission_id uuid,
  p_rejection_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid := (SELECT auth.uid());
  v_sub record;
  v_inv record;
  v_clean_reason text;
BEGIN
  -- 1. Strict Authorization: Only Owner / Admin can reject payments
  IF v_caller_uid IS NULL OR NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Only Owner / Admin users are authorized to reject payment submissions';
  END IF;

  v_clean_reason := trim(p_rejection_reason);
  IF v_clean_reason IS NULL OR length(v_clean_reason) < 3 THEN
    RAISE EXCEPTION 'A clear rejection reason is mandatory (minimum 3 characters)';
  END IF;

  -- 2. Lock submission row FOR UPDATE
  SELECT * INTO v_sub
  FROM public.customer_payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;

  IF v_sub.status = 'accounted' THEN
    RAISE EXCEPTION 'Cannot reject a payment submission that has already been verified and accounted';
  END IF;

  IF v_sub.status = 'rejected' THEN
    RAISE EXCEPTION 'Payment submission % is already rejected', p_submission_id;
  END IF;

  -- 3. Fetch linked invoice for notification
  SELECT invoice_number INTO v_inv
  FROM public.invoices
  WHERE id = v_sub.invoice_id;

  -- 4. Update submission status to rejected
  UPDATE public.customer_payment_submissions
  SET status = 'rejected',
      rejection_reason = v_clean_reason,
      verified_by = v_caller_uid,
      verified_at = now(),
      updated_at = now()
  WHERE id = p_submission_id;

  -- 5. Send notification to Customer
  BEGIN
    INSERT INTO public.notifications (
      organization_id,
      recipient_user_id,
      customer_id,
      title,
      message,
      type,
      channel,
      reference_type,
      reference_id,
      created_at
    )
    SELECT
      v_sub.organization_id,
      cu.auth_user_id,
      v_sub.customer_id,
      'Payment Verification Update: Rejected',
      'Your payment submission of ₹' || v_sub.amount::text || ' for Invoice ' || COALESCE(v_inv.invoice_number, '') || ' was not accepted. Reason: ' || v_clean_reason,
      'payment',
      'in_app',
      'payment_submission',
      p_submission_id,
      now()
    FROM public.customer_users cu
    WHERE cu.customer_id = v_sub.customer_id AND cu.is_active = true
    LIMIT 5;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'status', 'rejected',
    'rejection_reason', v_clean_reason,
    'verified_at', now()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. SEED INITIAL OFFICIAL BUSINESS PAYMENT METHODS
-- Seeds official Bank and UPI methods for Madhav Dairy
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Official Primary Bank Account
  IF NOT EXISTS (
    SELECT 1 FROM public.business_payment_methods 
    WHERE organization_id = v_org_id AND method_type = 'bank_account' AND is_default = true
  ) THEN
    INSERT INTO public.business_payment_methods (
      organization_id,
      method_type,
      display_name,
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      instructions,
      is_active,
      is_default
    ) VALUES (
      v_org_id,
      'bank_account',
      'Madhav Dairy Current Account (HDFC)',
      'Madhav Dairy Products Pvt. Ltd.',
      'HDFC Bank',
      '50200084920194',
      'HDFC0001234',
      'Shirwal Branch, Satara',
      'Please mention your Invoice Number or Customer Code in the NEFT / RTGS transfer remarks.',
      true,
      true
    );
  END IF;

  -- Official Primary UPI ID
  IF NOT EXISTS (
    SELECT 1 FROM public.business_payment_methods 
    WHERE organization_id = v_org_id AND method_type = 'upi' AND is_default = true
  ) THEN
    INSERT INTO public.business_payment_methods (
      organization_id,
      method_type,
      display_name,
      account_holder_name,
      upi_id,
      instructions,
      is_active,
      is_default
    ) VALUES (
      v_org_id,
      'upi',
      'Madhav Dairy Official UPI',
      'Madhav Dairy Products Pvt Ltd',
      'madhavdairy@hdfcbank',
      'Scan QR code or pay to UPI ID. Copy the 12-digit UTR transaction reference number and submit it below.',
      true,
      true
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.submit_customer_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_account_payment_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_submission TO authenticated;
