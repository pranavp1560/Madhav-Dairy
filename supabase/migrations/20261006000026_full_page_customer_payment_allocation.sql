-- =============================================================================
-- Migration 026: Full-Page Customer Payment & Multi-Invoice Allocation System
-- Provides authoritative outstanding calculations, concurrency locks,
-- and atomic multi-invoice payment allocation RPCs.
-- =============================================================================

-- 1. AUTHORITATIVE OUTSTANDING INVOICES QUERY FUNCTION
CREATE OR REPLACE FUNCTION public.get_customer_outstanding_invoices(
  p_customer_id uuid
)
RETURNS TABLE (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  due_date date,
  total_amount numeric,
  allocated_amount numeric,
  outstanding_amount numeric,
  status text,
  order_id uuid,
  order_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    COALESCE(pa.total_allocated, 0::numeric) AS allocated_amount,
    ROUND((i.total_amount - COALESCE(pa.total_allocated, 0::numeric)), 2) AS outstanding_amount,
    i.status,
    i.order_id,
    o.order_number
  FROM public.invoices i
  LEFT JOIN public.orders o ON i.order_id = o.id
  LEFT JOIN (
    SELECT 
      invoice_id, 
      SUM(allocated_amount) AS total_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.customer_id = p_customer_id
    AND i.status != 'cancelled'
    AND (i.total_amount - COALESCE(pa.total_allocated, 0::numeric)) > 0
  ORDER BY i.invoice_date ASC, i.created_at ASC; -- Oldest first for predictable FIFO allocation
$$;


-- 2. AUTHORITATIVE CUSTOMER OUTSTANDING SUMMARY FUNCTION
CREATE OR REPLACE FUNCTION public.get_customer_outstanding_summary(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_cust record;
  v_total_outstanding numeric(12,2) := 0;
  v_invoice_count int := 0;
BEGIN
  SELECT id, business_name, customer_code, mobile, credit_limit
  INTO v_cust
  FROM public.customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  SELECT 
    COALESCE(SUM(ROUND(i.total_amount - COALESCE(pa.total_allocated, 0::numeric), 2)), 0),
    COUNT(i.id)
  INTO v_total_outstanding, v_invoice_count
  FROM public.invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(allocated_amount) AS total_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.customer_id = p_customer_id
    AND i.status != 'cancelled'
    AND (i.total_amount - COALESCE(pa.total_allocated, 0::numeric)) > 0;

  RETURN jsonb_build_object(
    'customer_id', v_cust.id,
    'business_name', v_cust.business_name,
    'customer_code', v_cust.customer_code,
    'mobile', v_cust.mobile,
    'credit_limit', v_cust.credit_limit,
    'total_outstanding', v_total_outstanding,
    'outstanding_invoice_count', v_invoice_count
  );
END;
$$;


-- 3. ATOMIC MULTI-INVOICE PAYMENT ALLOCATION RPC WITH STRICT CONCURRENCY LOCKS
CREATE OR REPLACE FUNCTION public.record_customer_payment_with_allocations(
  p_customer_id uuid,
  p_payment_amount numeric,
  p_payment_method text,
  p_allocations jsonb,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cust record;
  v_org_id uuid;
  v_alloc_item jsonb;
  v_inv_id uuid;
  v_alloc_amount numeric(12,2);
  v_inv record;
  v_already_allocated numeric(12,2);
  v_inv_remaining numeric(12,2);
  v_sum_allocations numeric(12,2) := 0;
  v_cust_total_outstanding numeric(12,2) := 0;
  v_payment_id uuid;
  v_payment_number text;
  v_alloc_result jsonb := '[]'::jsonb;
BEGIN
  -- 1. Validate payment amount
  IF p_payment_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 2. Validate allocations array
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one invoice must be allocated';
  END IF;

  -- 3. Lock customer row for concurrency control
  SELECT * INTO v_cust
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_org_id := v_cust.organization_id;

  -- 4. Calculate authoritative customer total outstanding across all eligible invoices
  SELECT COALESCE(SUM(i.total_amount - COALESCE(pa.allocated, 0)), 0)
  INTO v_cust_total_outstanding
  FROM public.invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(allocated_amount) as allocated 
    FROM public.payment_allocations 
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.customer_id = p_customer_id 
    AND i.status != 'cancelled';

  IF p_payment_amount > v_cust_total_outstanding THEN
    RAISE EXCEPTION 'Payment amount of ₹% exceeds the customer total current outstanding of ₹%', p_payment_amount, v_cust_total_outstanding;
  END IF;

  -- 5. Validate each allocated invoice with row-level locks
  FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_inv_id := (v_alloc_item->>'invoice_id')::uuid;
    v_alloc_amount := ROUND((v_alloc_item->>'amount')::numeric, 2);

    IF v_alloc_amount <= 0 THEN
      RAISE EXCEPTION 'Allocation amounts must be greater than zero';
    END IF;

    -- Lock invoice row
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE id = v_inv_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice % not found', v_inv_id;
    END IF;

    IF v_inv.customer_id != p_customer_id THEN
      RAISE EXCEPTION 'Invoice % does not belong to the selected customer', v_inv.invoice_number;
    END IF;

    IF v_inv.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot allocate payment to cancelled invoice %', v_inv.invoice_number;
    END IF;

    -- If invoice is still 'ready', advance it to 'delivered' so allocation can proceed smoothly
    IF v_inv.status = 'ready' THEN
      UPDATE public.invoices
      SET status = 'delivered',
          delivered_at = now(),
          delivered_by = p_user_id,
          updated_at = now()
      WHERE id = v_inv_id;
      v_inv.status := 'delivered';
    END IF;

    -- Calculate remaining balance for this invoice
    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO v_already_allocated
    FROM public.payment_allocations
    WHERE invoice_id = v_inv_id;

    v_inv_remaining := ROUND(v_inv.total_amount - v_already_allocated, 2);

    IF v_alloc_amount > v_inv_remaining THEN
      RAISE EXCEPTION 'Allocation of ₹% exceeds remaining balance of ₹% on invoice %', v_alloc_amount, v_inv_remaining, v_inv.invoice_number;
    END IF;

    v_sum_allocations := v_sum_allocations + v_alloc_amount;
  END LOOP;

  -- 6. Enforce that sum of allocations must equal payment amount exactly
  IF v_sum_allocations != p_payment_amount THEN
    RAISE EXCEPTION 'Sum of invoice allocations (₹%) must exactly equal the payment amount (₹%)', v_sum_allocations, p_payment_amount;
  END IF;

  -- 7. Generate payment document sequence number
  BEGIN
    v_payment_number := public.next_document_number(v_org_id, 'payment', 'REC', 4);
  EXCEPTION WHEN OTHERS THEN
    v_payment_number := NULL;
  END;

  IF v_payment_number IS NULL OR v_payment_number = '' THEN
    v_payment_number := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- 8. Insert payment master record (starts as unconfirmed / Open Payment)
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
    recorded_by,
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    p_customer_id,
    v_payment_number,
    p_payment_date,
    p_payment_amount,
    p_payment_method,
    p_reference_number,
    p_notes,
    false, -- Pending accounting verification
    p_user_id,
    now(),
    now()
  ) RETURNING id INTO v_payment_id;

  -- 9. Insert allocations and transition invoice statuses to open_payment
  FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_inv_id := (v_alloc_item->>'invoice_id')::uuid;
    v_alloc_amount := ROUND((v_alloc_item->>'amount')::numeric, 2);

    INSERT INTO public.payment_allocations (
      payment_id,
      invoice_id,
      allocated_amount
    ) VALUES (
      v_payment_id,
      v_inv_id,
      v_alloc_amount
    );

    -- Move invoice to open_payment
    UPDATE public.invoices
    SET status = 'open_payment',
        updated_at = now()
    WHERE id = v_inv_id;

    -- Fetch invoice details for return payload
    SELECT 
      i.invoice_number,
      i.total_amount,
      ROUND(i.total_amount - (SELECT COALESCE(SUM(allocated_amount), 0) FROM public.payment_allocations WHERE invoice_id = i.id), 2) AS remaining
    INTO v_inv
    FROM public.invoices i
    WHERE i.id = v_inv_id;

    v_alloc_result := v_alloc_result || jsonb_build_object(
      'invoice_id', v_inv_id,
      'invoice_number', v_inv.invoice_number,
      'allocated_amount', v_alloc_amount,
      'remaining_balance', v_inv.remaining
    );
  END LOOP;

  -- 10. Recalculate remaining customer outstanding after this transaction
  SELECT COALESCE(SUM(i.total_amount - COALESCE(pa.allocated, 0)), 0)
  INTO v_cust_total_outstanding
  FROM public.invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(allocated_amount) as allocated 
    FROM public.payment_allocations 
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.customer_id = p_customer_id 
    AND i.status != 'cancelled';

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_number', v_payment_number,
    'customer_id', p_customer_id,
    'customer_name', v_cust.business_name,
    'payment_amount', p_payment_amount,
    'payment_method', p_payment_method,
    'payment_date', p_payment_date,
    'reference_number', p_reference_number,
    'notes', p_notes,
    'status', 'open_payment',
    'allocations', v_alloc_result,
    'remaining_customer_outstanding', v_cust_total_outstanding
  );
END;
$$;


-- 4. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_customer_outstanding_invoices TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_outstanding_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_with_allocations TO authenticated, anon;
