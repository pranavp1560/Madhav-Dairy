-- =============================================================================
-- Migration 038: Customer Import Module & Persistent Background Feed
-- Tracks bulk customer import jobs, row-level validation/execution audits,
-- and provides atomic batch processing functions with organization-level isolation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CUSTOMER IMPORT JOBS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_number text NOT NULL,
  filename text NOT NULL,
  file_size_bytes bigint DEFAULT 0,
  submitted_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name text NOT NULL DEFAULT 'Staff Member',
  total_records integer NOT NULL DEFAULT 0,
  processed_records integer NOT NULL DEFAULT 0,
  successful_records integer NOT NULL DEFAULT 0,
  updated_records integer NOT NULL DEFAULT 0,
  failed_records integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_errors', 'failed')),
  error_message text,
  summary_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_cust_import_job_num UNIQUE (organization_id, job_number)
);

DROP TRIGGER IF EXISTS trg_customer_import_jobs_updated_at ON public.customer_import_jobs;
CREATE TRIGGER trg_customer_import_jobs_updated_at
  BEFORE UPDATE ON public.customer_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cust_imp_org_id ON public.customer_import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_cust_imp_status ON public.customer_import_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cust_imp_created_at ON public.customer_import_jobs(created_at DESC);


-- -----------------------------------------------------------------------------
-- 2. CUSTOMER IMPORT JOB ROWS TABLE (Row-level Audit Log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.customer_import_jobs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'skip')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  owner_name text,
  mobile text,
  email text,
  address text,
  area text,
  city text,
  state text,
  pincode text,
  gstin text,
  credit_limit numeric(12,2),
  sales_channel_name text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'warning', 'skipped')),
  error_messages text[] DEFAULT '{}'::text[],
  warning_messages text[] DEFAULT '{}'::text[],
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cust_imp_rows_job_id ON public.customer_import_job_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_cust_imp_rows_status ON public.customer_import_job_rows(job_id, status);


-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_job_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_import_jobs_internal" ON public.customer_import_jobs;
CREATE POLICY "customer_import_jobs_internal" ON public.customer_import_jobs
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

DROP POLICY IF EXISTS "customer_import_job_rows_internal" ON public.customer_import_job_rows;
CREATE POLICY "customer_import_job_rows_internal" ON public.customer_import_job_rows
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_import_jobs j
      WHERE j.id = customer_import_job_rows.job_id
        AND j.organization_id = (SELECT public.current_user_org_id())
    )
  );

-- Anonymous policy for development/testing if needed
DROP POLICY IF EXISTS "customer_import_jobs_anon" ON public.customer_import_jobs;
CREATE POLICY "customer_import_jobs_anon" ON public.customer_import_jobs
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "customer_import_job_rows_anon" ON public.customer_import_job_rows;
CREATE POLICY "customer_import_job_rows_anon" ON public.customer_import_job_rows
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- 4. RPC: CREATE CUSTOMER IMPORT JOB
-- -----------------------------------------------------------------------------
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
  -- Determine effective organization
  SELECT public.current_user_org_id() INTO v_org_id;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
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


-- -----------------------------------------------------------------------------
-- 5. RPC: PROCESS CUSTOMER IMPORT BATCH (Atomic Server Execution)
-- -----------------------------------------------------------------------------
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
  v_row jsonb;
  v_index integer;
  v_action text;
  v_cust_id uuid;
  v_matched_id uuid;
  v_bname text;
  v_oname text;
  v_mobile text;
  v_email text;
  v_address text;
  v_area text;
  v_city text;
  v_state text;
  v_pincode text;
  v_gstin text;
  v_credit_limit numeric(12,2);
  v_channel_name text;
  v_channel_id uuid;
  v_opening_balance numeric(12,2);
  v_cust_code text;
  v_success_count integer := 0;
  v_update_count integer := 0;
  v_failed_count integer := 0;
  v_row_errors text[];
  v_row_warnings text[];
  v_row_status text;
BEGIN
  -- Acquire lock on job record
  SELECT * INTO v_job
  FROM public.customer_import_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import job % not found.', p_job_id;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_errors := ARRAY[]::text[];
    v_row_warnings := ARRAY[]::text[];
    v_index := (v_row->>'row_index')::integer;
    v_action := COALESCE(v_row->>'action', 'create');
    v_bname := trim(COALESCE(v_row->>'business_name', ''));
    v_oname := trim(COALESCE(v_row->>'owner_name', ''));
    v_mobile := trim(COALESCE(v_row->>'mobile', ''));
    v_email := trim(COALESCE(v_row->>'email', ''));
    v_address := trim(COALESCE(v_row->>'address', ''));
    v_area := trim(COALESCE(v_row->>'area', ''));
    v_city := COALESCE(NULLIF(trim(v_row->>'city'), ''), 'Pune');
    v_state := COALESCE(NULLIF(trim(v_row->>'state'), ''), 'Maharashtra');
    v_pincode := trim(COALESCE(v_row->>'pincode', ''));
    v_gstin := trim(COALESCE(v_row->>'gstin', ''));
    v_credit_limit := COALESCE((v_row->>'credit_limit')::numeric, 50000.00);
    v_channel_name := trim(COALESCE(v_row->>'sales_channel_name', ''));
    v_opening_balance := COALESCE((v_row->>'opening_balance')::numeric, 0.00);
    v_matched_id := NULL;

    IF v_row->>'matched_customer_id' IS NOT NULL AND v_row->>'matched_customer_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_matched_id := (v_row->>'matched_customer_id')::uuid;
    END IF;

    -- Validation checks
    IF v_bname = '' THEN
      v_row_errors := array_append(v_row_errors, 'Business name is required.');
    END IF;
    IF v_oname = '' THEN
      v_row_errors := array_append(v_row_errors, 'Owner name is required.');
    END IF;
    IF v_mobile = '' OR length(regexp_replace(v_mobile, '[^0-9]', '', 'g')) < 10 THEN
      v_row_errors := array_append(v_row_errors, 'Valid 10-digit mobile number is required.');
    END IF;
    IF v_address = '' THEN
      v_row_errors := array_append(v_row_errors, 'Address is required.');
    END IF;

    -- Lookup sales channel if name given
    v_channel_id := NULL;
    IF v_channel_name <> '' THEN
      SELECT id INTO v_channel_id
      FROM public.sales_channels
      WHERE organization_id = v_job.organization_id
        AND (lower(name) = lower(v_channel_name) OR lower(code) = lower(v_channel_name))
      LIMIT 1;

      IF v_channel_id IS NULL THEN
        v_row_warnings := array_append(v_row_warnings, 'Channel "' || v_channel_name || '" not recognized, defaulted to Wholesale.');
      END IF;
    END IF;

    IF v_channel_id IS NULL THEN
      SELECT id INTO v_channel_id
      FROM public.sales_channels
      WHERE organization_id = v_job.organization_id
        AND code = 'WHOLESALE'
      LIMIT 1;
    END IF;

    -- Execute Create or Update
    IF array_length(v_row_errors, 1) > 0 THEN
      v_row_status := 'failed';
      v_failed_count := v_failed_count + 1;

      INSERT INTO public.customer_import_job_rows (
        job_id, row_index, action, customer_id, business_name, owner_name, mobile, email,
        address, area, city, state, pincode, gstin, credit_limit, sales_channel_name,
        status, error_messages, warning_messages, raw_data
      ) VALUES (
        p_job_id, v_index, v_action, NULL, v_bname, v_oname, v_mobile, NULLIF(v_email, ''),
        v_address, NULLIF(v_area, ''), v_city, v_state, NULLIF(v_pincode, ''), NULLIF(v_gstin, ''),
        v_credit_limit, v_channel_name, 'failed', v_row_errors, v_row_warnings, v_row
      );
    ELSE
      -- Check if we match an existing customer
      IF v_matched_id IS NULL THEN
        SELECT id INTO v_matched_id
        FROM public.customers
        WHERE organization_id = v_job.organization_id
          AND (mobile = v_mobile OR lower(business_name) = lower(v_bname))
        LIMIT 1;
      END IF;

      IF v_matched_id IS NOT NULL THEN
        -- UPDATE existing customer
        UPDATE public.customers
        SET
          business_name = v_bname,
          owner_name = v_oname,
          mobile = v_mobile,
          email = NULLIF(v_email, '')::citext,
          address = v_address,
          area = NULLIF(v_area, ''),
          city = v_city,
          state = v_state,
          pincode = NULLIF(v_pincode, ''),
          gstin = NULLIF(v_gstin, ''),
          credit_limit = v_credit_limit,
          sales_channel_id = COALESCE(v_channel_id, sales_channel_id),
          updated_at = now()
        WHERE id = v_matched_id AND organization_id = v_job.organization_id;

        v_cust_id := v_matched_id;
        v_update_count := v_update_count + 1;
        v_row_status := CASE WHEN array_length(v_row_warnings, 1) > 0 THEN 'warning' ELSE 'success' END;

        INSERT INTO public.customer_import_job_rows (
          job_id, row_index, action, customer_id, business_name, owner_name, mobile, email,
          address, area, city, state, pincode, gstin, credit_limit, sales_channel_name,
          status, error_messages, warning_messages, raw_data
        ) VALUES (
          p_job_id, v_index, 'update', v_cust_id, v_bname, v_oname, v_mobile, NULLIF(v_email, ''),
          v_address, NULLIF(v_area, ''), v_city, v_state, NULLIF(v_pincode, ''), NULLIF(v_gstin, ''),
          v_credit_limit, v_channel_name, v_row_status, ARRAY[]::text[], v_row_warnings, v_row
        );
      ELSE
        -- CREATE new customer
        -- Generate customer code
        SELECT 'RET-' || LPAD((COALESCE(MAX(SUBSTRING(customer_code FROM 'RET-([0-9]+)')::integer), 1000) + 1)::text, 4, '0')
        INTO v_cust_code
        FROM public.customers
        WHERE organization_id = v_job.organization_id;

        INSERT INTO public.customers (
          organization_id, customer_code, business_name, owner_name, mobile, email,
          address, area, city, state, pincode, gstin, credit_limit, payment_terms_days,
          status, sales_channel_id
        ) VALUES (
          v_job.organization_id, v_cust_code, v_bname, v_oname, v_mobile, NULLIF(v_email, '')::citext,
          v_address, NULLIF(v_area, ''), v_city, v_state, NULLIF(v_pincode, ''), NULLIF(v_gstin, ''),
          v_credit_limit, 15, 'active', v_channel_id
        )
        RETURNING id INTO v_cust_id;

        -- Create opening balance entry in ledger if provided
        IF v_opening_balance > 0 THEN
          INSERT INTO public.ledger_entries (
            organization_id, customer_id, entry_type, reference_type, reference_id,
            description, debit, credit
          ) VALUES (
            v_job.organization_id, v_cust_id, 'opening_balance', 'manual', v_cust_id,
            'Initial Opening Balance from Bulk Import (' || v_cust_code || ')', v_opening_balance, 0.00
          );
        END IF;

        v_success_count := v_success_count + 1;
        v_row_status := CASE WHEN array_length(v_row_warnings, 1) > 0 THEN 'warning' ELSE 'success' END;

        INSERT INTO public.customer_import_job_rows (
          job_id, row_index, action, customer_id, business_name, owner_name, mobile, email,
          address, area, city, state, pincode, gstin, credit_limit, sales_channel_name,
          status, error_messages, warning_messages, raw_data
        ) VALUES (
          p_job_id, v_index, 'create', v_cust_id, v_bname, v_oname, v_mobile, NULLIF(v_email, ''),
          v_address, NULLIF(v_area, ''), v_city, v_state, NULLIF(v_pincode, ''), NULLIF(v_gstin, ''),
          v_credit_limit, v_channel_name, v_row_status, ARRAY[]::text[], v_row_warnings, v_row
        );
      END IF;
    END IF;
  END LOOP;

  -- Update job progress counters
  UPDATE public.customer_import_jobs
  SET
    processed_records = processed_records + jsonb_array_length(p_rows),
    successful_records = successful_records + v_success_count,
    updated_records = updated_records + v_update_count,
    failed_records = failed_records + v_failed_count,
    status = CASE
      WHEN (processed_records + jsonb_array_length(p_rows)) >= total_records AND (failed_records + v_failed_count) > 0 THEN 'completed_with_errors'
      WHEN (processed_records + jsonb_array_length(p_rows)) >= total_records THEN 'completed'
      ELSE 'processing'
    END,
    completed_at = CASE
      WHEN (processed_records + jsonb_array_length(p_rows)) >= total_records THEN now()
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_processed', jsonb_array_length(p_rows),
    'batch_created', v_success_count,
    'batch_updated', v_update_count,
    'batch_failed', v_failed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_import_job(text, bigint, integer, text, jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_customer_import_batch(uuid, jsonb) TO authenticated, anon;
