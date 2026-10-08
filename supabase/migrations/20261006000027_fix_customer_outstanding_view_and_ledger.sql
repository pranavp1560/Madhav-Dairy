-- =============================================================================
-- Migration 027: Fix Customer Outstanding View & Double-Entry Ledger Sync
-- Module: Single Source of Truth for Customer Dues
-- =============================================================================

-- 1. Redefine view_customer_outstanding to compute authoritative dues from non-cancelled invoices & payment allocations
CREATE OR REPLACE VIEW public.view_customer_outstanding
WITH (security_invoker = true)
AS
SELECT 
  c.id AS customer_id,
  c.organization_id,
  c.customer_code,
  c.business_name,
  c.owner_name,
  c.credit_limit,
  c.payment_terms_days,
  c.status AS customer_status,
  COALESCE(inv.total_billed, 0.00) AS total_billed,
  COALESCE(inv.total_paid, 0.00) AS total_paid,
  COALESCE(inv.outstanding_amount, 0.00) AS outstanding_amount,
  c.credit_limit - COALESCE(inv.outstanding_amount, 0.00) AS available_credit,
  inv.last_invoice_date AS last_transaction_date
FROM public.customers c
LEFT JOIN (
  SELECT 
    i.customer_id,
    ROUND(SUM(i.total_amount), 2) AS total_billed,
    ROUND(SUM(COALESCE(pa.total_allocated, 0.00)), 2) AS total_paid,
    ROUND(SUM(GREATEST(0.00, i.total_amount - COALESCE(pa.total_allocated, 0.00))), 2) AS outstanding_amount,
    MAX(i.invoice_date) AS last_invoice_date
  FROM public.invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(allocated_amount) AS total_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.status != 'cancelled'
  GROUP BY i.customer_id
) inv ON inv.customer_id = c.id;

-- 2. Update dispatch_order_and_create_invoice RPC to post double-entry debit into ledger_entries
CREATE OR REPLACE FUNCTION public.dispatch_order_and_create_invoice(
  p_order_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_org_id uuid;
BEGIN
  -- 1. Lock and validate order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'confirmed' THEN
    RAISE EXCEPTION 'Only Confirmed orders can be Dispatched (current status: %)', v_order.status;
  END IF;

  v_org_id := v_order.organization_id;

  -- 2. Check idempotent safeguard: has invoice already been generated?
  SELECT id, invoice_number INTO v_invoice_id, v_invoice_number
  FROM public.invoices
  WHERE order_id = p_order_id;

  IF FOUND THEN
    -- If already generated, ensure order is dispatched and return existing invoice
    UPDATE public.orders
    SET status = 'dispatched',
        dispatched_at = COALESCE(dispatched_at, now()),
        dispatched_by = COALESCE(dispatched_by, p_user_id),
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_order.id,
      'order_status', 'dispatched',
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'note', 'Invoice previously generated'
    );
  END IF;

  -- 3. Generate sequential invoice number (INV-YYYY-XXXX)
  v_invoice_number := public.next_document_number(
    v_org_id,
    'invoice',
    'INV',
    4
  );

  -- 4. Create new Invoice in 'ready' status
  INSERT INTO public.invoices (
    organization_id,
    customer_id,
    order_id,
    invoice_number,
    invoice_date,
    due_date,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    v_order.customer_id,
    v_order.id,
    v_invoice_number,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '15 days',
    v_order.subtotal,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total_amount,
    'ready',
    now(),
    now()
  ) RETURNING id INTO v_invoice_id;

  -- Create invoice items copying from order_items
  INSERT INTO public.invoice_items (
    invoice_id,
    product_sku_id,
    quantity,
    rate,
    discount_amount,
    tax_percent,
    tax_amount,
    line_total
  )
  SELECT
    v_invoice_id,
    oi.product_sku_id,
    oi.quantity,
    oi.unit_price,
    oi.discount_amount,
    oi.tax_percent,
    oi.tax_amount,
    oi.line_total
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  -- Post double-entry Customer Ledger Debit
  INSERT INTO public.ledger_entries (
    organization_id,
    customer_id,
    entry_date,
    entry_type,
    reference_type,
    reference_id,
    debit,
    credit,
    description
  ) VALUES (
    v_org_id,
    v_order.customer_id,
    CURRENT_DATE,
    'invoice',
    'invoices',
    v_invoice_id,
    v_order.total_amount,
    null,
    'Tax Invoice ' || v_invoice_number || ' sales charge'
  );

  -- Update Order status to 'dispatched'
  UPDATE public.orders
  SET status = 'dispatched',
      dispatched_at = now(),
      dispatched_by = p_user_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- Log status history audit
  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    notes
  ) VALUES (
    p_order_id,
    v_order.status,
    'dispatched',
    p_user_id,
    'Order dispatched and invoice ' || v_invoice_number || ' generated with status ready'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_status', 'dispatched',
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number
  );
END;
$$;

-- 3. Backfill debit entries for any existing non-cancelled invoices missing from ledger_entries
INSERT INTO public.ledger_entries (
  organization_id,
  customer_id,
  entry_date,
  entry_type,
  reference_type,
  reference_id,
  debit,
  credit,
  description
)
SELECT
  i.organization_id,
  i.customer_id,
  i.invoice_date,
  'invoice',
  'invoices',
  i.id,
  i.total_amount,
  null,
  'Tax Invoice ' || i.invoice_number || ' sales charge'
FROM public.invoices i
WHERE i.status != 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries l
    WHERE l.reference_type = 'invoices' AND l.reference_id = i.id
  );
