-- =============================================================================
-- Migration 039: Security Hardening, Tenant Isolation & Access Control Enforcement
-- Module: Security Hardening (Zero UI and Business Logic Changes)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SECURE TENANT RESOLUTION FUNCTIONS (REMOVE INSECURE DEMO/INTERNAL FALLBACKS)
-- -----------------------------------------------------------------------------
-- Prevents unauthenticated anonymous requests from automatically inheriting
-- internal staff privileges or demo organization access.

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_type FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

-- Ensure org-scoped role and permission checks
CREATE OR REPLACE FUNCTION public.has_role(p_role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND r.name = p_role_name
      AND (r.organization_id = public.current_user_org_id() OR public.current_user_org_id() IS NULL)
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. REVOKE ANONYMOUS EXECUTE PRIVILEGES FROM SENSITIVE MUTATION & FINANCIAL RPCS
-- -----------------------------------------------------------------------------
-- Anonymous users must not be able to execute dispatch, invoicing, payment allocation,
-- vendor adjustment, employee provisioning, or customer import operations.

-- Order & Invoice Operations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dispatch_order_and_create_invoice') THEN
    REVOKE EXECUTE ON FUNCTION public.dispatch_order_and_create_invoice FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_confirm_orders') THEN
    REVOKE EXECUTE ON FUNCTION public.bulk_confirm_orders FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_dispatch_orders') THEN
    REVOKE EXECUTE ON FUNCTION public.bulk_dispatch_orders FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_invoice_delivered') THEN
    REVOKE EXECUTE ON FUNCTION public.mark_invoice_delivered FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_deliver_invoices') THEN
    REVOKE EXECUTE ON FUNCTION public.bulk_deliver_invoices FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_invoice_for_order') THEN
    REVOKE EXECUTE ON FUNCTION public.generate_invoice_for_order FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_generate_invoices') THEN
    REVOKE EXECUTE ON FUNCTION public.bulk_generate_invoices FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_delivery_trip') THEN
    REVOKE EXECUTE ON FUNCTION public.assign_delivery_trip FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_delivery_trip') THEN
    REVOKE EXECUTE ON FUNCTION public.complete_delivery_trip FROM anon;
  END IF;
END $$;

-- Payment & Financial RPCs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'allocate_invoice_payment') THEN
    REVOKE EXECUTE ON FUNCTION public.allocate_invoice_payment FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_invoice_payment') THEN
    REVOKE EXECUTE ON FUNCTION public.confirm_invoice_payment FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_confirm_invoice_payments') THEN
    REVOKE EXECUTE ON FUNCTION public.bulk_confirm_invoice_payments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_customer_outstanding_invoices') THEN
    REVOKE EXECUTE ON FUNCTION public.get_customer_outstanding_invoices FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_customer_outstanding_summary') THEN
    REVOKE EXECUTE ON FUNCTION public.get_customer_outstanding_summary FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_customer_payment_with_allocations') THEN
    REVOKE EXECUTE ON FUNCTION public.record_customer_payment_with_allocations FROM anon;
  END IF;
END $$;

-- Vendor Advance & Bill RPCs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_vendor_advance') THEN
    REVOKE EXECUTE ON FUNCTION public.record_vendor_advance FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_vendor_bill') THEN
    REVOKE EXECUTE ON FUNCTION public.create_vendor_bill FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adjust_vendor_advance_against_bill') THEN
    REVOKE EXECUTE ON FUNCTION public.adjust_vendor_advance_against_bill FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adjust_vendor_advance') THEN
    REVOKE EXECUTE ON FUNCTION public.adjust_vendor_advance FROM anon;
  END IF;
END $$;

-- Customer Import RPCs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_customer_import_job') THEN
    REVOKE EXECUTE ON FUNCTION public.create_customer_import_job FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_customer_import_batch') THEN
    REVOKE EXECUTE ON FUNCTION public.process_customer_import_batch FROM anon;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. REMOVE OVERLY PERMISSIVE / ANONYMOUS RLS POLICIES
-- -----------------------------------------------------------------------------

-- Drop unauthenticated import access
DROP POLICY IF EXISTS "customer_import_jobs_anon" ON public.customer_import_jobs;
DROP POLICY IF EXISTS "customer_import_job_rows_anon" ON public.customer_import_job_rows;

-- Remove anonymous price exposure policy (confidential channel pricing)
DROP POLICY IF EXISTS "sku_channel_prices_anon_select" ON public.sku_channel_prices;

-- Ensure internal import management policy is strictly organization-isolated
DROP POLICY IF EXISTS "customer_import_jobs_internal" ON public.customer_import_jobs;
CREATE POLICY "customer_import_jobs_internal" ON public.customer_import_jobs
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

DROP POLICY IF EXISTS "customer_import_job_rows_internal" ON public.customer_import_job_rows;
CREATE POLICY "customer_import_job_rows_internal" ON public.customer_import_job_rows
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal' AND
    EXISTS (
      SELECT 1 FROM public.customer_import_jobs j
      WHERE j.id = customer_import_job_rows.job_id
        AND j.organization_id = (SELECT public.current_user_org_id())
    )
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' AND
    EXISTS (
      SELECT 1 FROM public.customer_import_jobs j
      WHERE j.id = customer_import_job_rows.job_id
        AND j.organization_id = (SELECT public.current_user_org_id())
    )
  );

-- -----------------------------------------------------------------------------
-- 4. HARDEN SECURITY DEFINER RPCS WITH STRICT AUTH & TENANT VALIDATION
-- -----------------------------------------------------------------------------

-- 4.1 Customer Import Job Creation: enforce internal auth & valid tenant
CREATE OR REPLACE FUNCTION public.create_customer_import_job(
  p_filename text,
  p_file_size bigint,
  p_total_records integer,
  p_submitted_by_name text DEFAULT 'Staff Member',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid := auth.uid();
  v_job_seq integer;
  v_job_number text;
  v_new_job public.customer_import_jobs%ROWTYPE;
  v_current_year text := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  -- Authenticated internal check
  IF v_user_id IS NULL OR (SELECT public.current_user_type()) != 'internal' THEN
    RAISE EXCEPTION 'Access denied: Only authenticated internal staff can create import jobs.';
  END IF;

  -- Determine effective organization
  SELECT public.current_user_org_id() INTO v_org_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization context could not be determined for authenticated user.';
  END IF;

  -- Generate sequential job number e.g. IMP-2026-0001
  SELECT COALESCE(MAX(SUBSTRING(job_number FROM 'IMP-[0-9]+-([0-9]+)')::integer), 0) + 1
  INTO v_job_seq
  FROM public.customer_import_jobs
  WHERE organization_id = v_org_id;

  v_job_number := 'IMP-' || v_current_year || '-' || LPAD(v_job_seq::text, 4, '0');

  INSERT INTO public.customer_import_jobs (
    organization_id,
    job_number,
    filename,
    file_size_bytes,
    submitted_by_id,
    submitted_by_name,
    total_records,
    processed_records,
    successful_records,
    updated_records,
    failed_records,
    status,
    summary_metadata
  ) VALUES (
    v_org_id,
    v_job_number,
    p_filename,
    p_file_size,
    v_user_id,
    p_submitted_by_name,
    p_total_records,
    0,
    0,
    0,
    0,
    'processing',
    p_metadata
  )
  RETURNING * INTO v_new_job;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_new_job.id,
    'job_number', v_new_job.job_number,
    'status', v_new_job.status
  );
END;
$$;

-- 4.2 Customer Import Batch Processing: verify caller and job tenant ownership
CREATE OR REPLACE FUNCTION public.process_customer_import_batch(
  p_job_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.customer_import_jobs%ROWTYPE;
  v_row_elem jsonb;
  v_caller_org uuid;
  v_processed integer := 0;
  v_successful integer := 0;
  v_updated integer := 0;
  v_failed integer := 0;
  v_customer_id uuid;
  v_business_name text;
  v_owner_name text;
  v_mobile text;
  v_alt_phone text;
  v_email text;
  v_address text;
  v_city text;
  v_state text;
  v_pincode text;
  v_gstin text;
  v_fssai text;
  v_sales_channel_id uuid;
  v_credit_limit numeric;
  v_credit_days integer;
  v_status text;
  v_notes text;
  v_err_msg text;
  v_row_action text;
  v_channel_record record;
  v_row_status text;
  v_opening_balance numeric := 0;
BEGIN
  -- Authenticated internal check
  IF auth.uid() IS NULL OR (SELECT public.current_user_type()) != 'internal' THEN
    RAISE EXCEPTION 'Access denied: Only authenticated internal staff can process customer import batches.';
  END IF;

  v_caller_org := public.current_user_org_id();

  -- Lock and validate parent job
  SELECT * INTO v_job
  FROM public.customer_import_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import job not found with ID: %', p_job_id;
  END IF;

  -- Ensure job belongs to caller's organization
  IF v_caller_org IS NOT NULL AND v_job.organization_id != v_caller_org THEN
    RAISE EXCEPTION 'Access denied: Import job belongs to a different organization.';
  END IF;

  -- Process rows
  FOR v_row_elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_processed := v_processed + 1;
    v_err_msg := NULL;
    v_row_action := lower(COALESCE(v_row_elem->>'action', 'create'));
    v_row_status := 'success';

    BEGIN
      v_business_name := trim(COALESCE(v_row_elem->>'business_name', ''));
      v_owner_name := trim(COALESCE(v_row_elem->>'owner_name', ''));
      v_mobile := trim(COALESCE(v_row_elem->>'mobile', ''));
      v_alt_phone := NULLIF(trim(COALESCE(v_row_elem->>'alternate_phone', '')), '');
      v_email := NULLIF(lower(trim(COALESCE(v_row_elem->>'email', ''))), '');
      v_address := trim(COALESCE(v_row_elem->>'address', ''));
      v_city := COALESCE(NULLIF(trim(COALESCE(v_row_elem->>'city', '')), ''), 'Patan');
      v_state := COALESCE(NULLIF(trim(COALESCE(v_row_elem->>'state', '')), ''), 'Gujarat');
      v_pincode := NULLIF(trim(COALESCE(v_row_elem->>'pincode', '')), '');
      v_gstin := NULLIF(upper(trim(COALESCE(v_row_elem->>'gstin', ''))), '');
      v_fssai := NULLIF(trim(COALESCE(v_row_elem->>'fssai_license', '')), '');
      v_credit_limit := COALESCE((v_row_elem->>'credit_limit')::numeric, 0);
      v_credit_days := COALESCE((v_row_elem->>'credit_period_days')::integer, 7);
      v_status := COALESCE(NULLIF(trim(COALESCE(v_row_elem->>'status', '')), ''), 'active');
      v_notes := NULLIF(trim(COALESCE(v_row_elem->>'notes', '')), '');
      v_opening_balance := COALESCE((v_row_elem->>'opening_balance')::numeric, 0);

      IF v_business_name = '' THEN RAISE EXCEPTION 'Business name is required'; END IF;
      IF v_owner_name = '' THEN RAISE EXCEPTION 'Owner name is required'; END IF;
      IF v_mobile = '' OR length(v_mobile) < 10 THEN RAISE EXCEPTION 'Valid 10-digit mobile number is required'; END IF;

      -- Resolve sales channel
      SELECT id INTO v_sales_channel_id
      FROM public.sales_channels
      WHERE organization_id = v_job.organization_id AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_row_action = 'update' AND (v_row_elem->>'matched_customer_id') IS NOT NULL THEN
        UPDATE public.customers SET
          business_name = v_business_name,
          owner_name = v_owner_name,
          alternate_phone = COALESCE(v_alt_phone, alternate_phone),
          email = COALESCE(v_email, email),
          billing_address = COALESCE(v_address, billing_address),
          city = v_city,
          state = v_state,
          pincode = COALESCE(v_pincode, pincode),
          gstin = COALESCE(v_gstin, gstin),
          fssai_license = COALESCE(v_fssai, fssai_license),
          credit_limit = v_credit_limit,
          credit_period_days = v_credit_days,
          status = v_status,
          notes = COALESCE(v_notes, notes),
          updated_at = now()
        WHERE id = (v_row_elem->>'matched_customer_id')::uuid
          AND organization_id = v_job.organization_id
        RETURNING id INTO v_customer_id;

        IF v_customer_id IS NOT NULL THEN
          v_updated := v_updated + 1;
        ELSE
          RAISE EXCEPTION 'Customer with ID % not found in organization', (v_row_elem->>'matched_customer_id');
        END IF;
      ELSE
        -- Insert new customer record
        INSERT INTO public.customers (
          organization_id,
          business_name,
          owner_name,
          mobile,
          alternate_phone,
          email,
          billing_address,
          city,
          state,
          pincode,
          gstin,
          fssai_license,
          sales_channel_id,
          credit_limit,
          credit_period_days,
          status,
          notes,
          outstanding_balance,
          created_at,
          updated_at
        ) VALUES (
          v_job.organization_id,
          v_business_name,
          v_owner_name,
          v_mobile,
          v_alt_phone,
          v_email,
          v_address,
          v_city,
          v_state,
          v_pincode,
          v_gstin,
          v_fssai,
          v_sales_channel_id,
          v_credit_limit,
          v_credit_days,
          v_status,
          v_notes,
          v_opening_balance,
          now(),
          now()
        )
        RETURNING id INTO v_customer_id;

        v_successful := v_successful + 1;
      END IF;

      -- Insert audit row entry
      INSERT INTO public.customer_import_job_rows (
        job_id,
        row_number,
        raw_data,
        status,
        action_taken,
        customer_id
      ) VALUES (
        p_job_id,
        COALESCE((v_row_elem->>'row_number')::integer, v_processed),
        v_row_elem,
        'success',
        v_row_action,
        v_customer_id
      );

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_err_msg := SQLERRM;

      INSERT INTO public.customer_import_job_rows (
        job_id,
        row_number,
        raw_data,
        status,
        action_taken,
        error_message
      ) VALUES (
        p_job_id,
        COALESCE((v_row_elem->>'row_number')::integer, v_processed),
        v_row_elem,
        'failed',
        'skipped',
        v_err_msg
      );
    END;
  END LOOP;

  -- Update job aggregates atomically
  UPDATE public.customer_import_jobs SET
    processed_records = processed_records + v_processed,
    successful_records = successful_records + v_successful,
    updated_records = updated_records + v_updated,
    failed_records = failed_records + v_failed,
    status = CASE
      WHEN processed_records + v_processed >= total_records AND failed_records + v_failed > 0 THEN 'completed_with_errors'
      WHEN processed_records + v_processed >= total_records THEN 'completed'
      ELSE 'processing'
    END,
    completed_at = CASE WHEN processed_records + v_processed >= total_records THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'created', v_successful,
    'updated', v_updated,
    'failed', v_failed
  );
END;
$$;

-- 4.3 Vendor Advance Adjustment: verify authentication and internal role
CREATE OR REPLACE FUNCTION public.adjust_vendor_advance(
  p_advance_id uuid,
  p_adjustment_amount numeric,
  p_goods_description text,
  p_adjustment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance public.vendor_advances%ROWTYPE;
  v_adj_seq integer;
  v_adj_number text;
  v_new_adjusted_amount numeric;
  v_new_balance numeric;
  v_adj_id uuid;
  v_current_year text := to_char(COALESCE(p_adjustment_date, CURRENT_DATE), 'YYYY');
  v_effective_user_id uuid;
BEGIN
  -- Strict server-side authorization check
  IF auth.uid() IS NULL AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required to adjust vendor advances.';
  END IF;

  v_effective_user_id := COALESCE(auth.uid(), p_user_id);

  IF (SELECT public.current_user_type()) != 'internal' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied: Only internal staff can record vendor advance adjustments.';
  END IF;

  IF p_adjustment_amount IS NULL OR p_adjustment_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be strictly greater than zero.';
  END IF;

  -- Lock advance row for update
  SELECT * INTO v_advance
  FROM public.vendor_advances
  WHERE id = p_advance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor advance record not found.';
  END IF;

  IF v_advance.organization_id != public.current_user_org_id() AND public.current_user_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied: Advance record belongs to another organization.';
  END IF;

  IF p_adjustment_amount > v_advance.balance_amount THEN
    RAISE EXCEPTION 'Adjustment amount (₹%) exceeds remaining advance balance (₹%).',
      p_adjustment_amount, v_advance.balance_amount;
  END IF;

  v_new_adjusted_amount := v_advance.adjusted_amount + p_adjustment_amount;
  v_new_balance := v_advance.balance_amount - p_adjustment_amount;

  -- Generate sequential adjustment document number
  SELECT COALESCE(MAX(SUBSTRING(adjustment_number FROM 'ADJ-[0-9]+-([0-9]+)')::integer), 0) + 1
  INTO v_adj_seq
  FROM public.vendor_advance_adjustments
  WHERE organization_id = v_advance.organization_id;

  v_adj_number := 'ADJ-' || v_current_year || '-' || LPAD(v_adj_seq::text, 4, '0');

  INSERT INTO public.vendor_advance_adjustments (
    organization_id,
    advance_id,
    adjustment_number,
    adjustment_amount,
    adjustment_date,
    goods_description,
    notes,
    adjusted_by
  ) VALUES (
    v_advance.organization_id,
    p_advance_id,
    v_adj_number,
    p_adjustment_amount,
    COALESCE(p_adjustment_date, CURRENT_DATE),
    p_goods_description,
    p_notes,
    v_effective_user_id
  ) RETURNING id INTO v_adj_id;

  UPDATE public.vendor_advances SET
    adjusted_amount = v_new_adjusted_amount,
    balance_amount = v_new_balance,
    status = CASE WHEN v_new_balance = 0 THEN 'fully_adjusted' ELSE 'partially_adjusted' END,
    updated_at = now()
  WHERE id = p_advance_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adj_id,
    'adjustment_number', v_adj_number,
    'advance_id', p_advance_id,
    'adjusted_amount', p_adjustment_amount,
    'new_balance', v_new_balance,
    'advance_status', CASE WHEN v_new_balance = 0 THEN 'fully_adjusted' ELSE 'partially_adjusted' END
  );
END;
$$;

-- 4.4 Admin Employee Provisioning: server-side role check
CREATE OR REPLACE FUNCTION public.admin_provision_invited_employee(
  p_user_id uuid,
  p_organization_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_department text,
  p_role text,
  p_status text DEFAULT 'invited'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended', 'invited') THEN p_status ELSE 'invited' END;
  v_profile_record public.profiles%ROWTYPE;
BEGIN
  -- Strict server-side check: caller must be admin, or running under service role (auth.uid() is null)
  IF auth.uid() IS NOT NULL THEN
    IF NOT (SELECT public.has_role('admin')) THEN
      RAISE EXCEPTION 'Access denied: Only administrators can provision internal staff members.';
    END IF;
    IF p_organization_id != (SELECT public.current_user_org_id()) AND (SELECT public.current_user_org_id()) IS NOT NULL THEN
      RAISE EXCEPTION 'Access denied: Target organization mismatch.';
    END IF;
  END IF;

  -- Validate role exists in org
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = p_organization_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found for organization', p_role;
  END IF;

  -- Insert or update profile for invited employee
  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    mobile,
    user_type,
    status,
    department_id,
    invited_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_organization_id,
    trim(p_full_name),
    lower(trim(p_email)),
    trim(p_mobile),
    'internal',
    v_clean_status,
    trim(p_department),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    user_type = 'internal',
    status = EXCLUDED.status,
    department_id = EXCLUDED.department_id,
    invited_at = COALESCE(public.profiles.invited_at, now()),
    updated_at = now()
  RETURNING * INTO v_profile_record;

  -- Assign user role
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (p_user_id, v_role_id);

  RETURN to_jsonb(v_profile_record);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. STORAGE BUCKET ACCESS HARDENING
-- -----------------------------------------------------------------------------
-- Ensure official payment QR codes cannot be replaced by arbitrary users.
-- Customers can upload to receipts/ path, while admins manage qr-codes/ path.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    DROP POLICY IF EXISTS "Authenticated users can upload payment assets" ON storage.objects;

    CREATE POLICY "Customers and staff upload receipts"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'payment-assets' AND
        (
          name LIKE 'receipts/%' OR
          (SELECT public.has_role('admin'))
        )
      );

    DROP POLICY IF EXISTS "Public and authenticated can read payment assets" ON storage.objects;
    CREATE POLICY "Public and authenticated can read payment assets"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'payment-assets');
  END IF;
END $$;

COMMIT;
