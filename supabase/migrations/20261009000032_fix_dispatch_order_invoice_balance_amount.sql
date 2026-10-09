-- =============================================================================
-- Migration: 20261009000032_fix_dispatch_order_invoice_balance_amount.sql
-- Description: 
--   1. Add balance_amount and notes columns to public.invoices table.
--   2. Backfill existing invoices' balance_amount.
--   3. Ensure dispatch_order_and_create_invoice RPC is fully robust, idempotent,
--      handles batch assignment (FEFO), posts ledger sales charge, and manages
--      invoice balance_amount and notes.
--   4. Update bulk_dispatch_orders to support both pending and confirmed orders.
-- =============================================================================

-- 1. Ensure invoices table has balance_amount and notes columns
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance_amount numeric(12,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text;

-- Backfill balance_amount for existing invoices based on total_amount minus payment allocations
UPDATE public.invoices i
SET balance_amount = ROUND(i.total_amount - COALESCE(pa.allocated, 0), 2)
FROM (
  SELECT invoice_id, SUM(allocated_amount) AS allocated
  FROM public.payment_allocations
  GROUP BY invoice_id
) pa
WHERE i.id = pa.invoice_id AND i.balance_amount IS NULL;

UPDATE public.invoices
SET balance_amount = total_amount
WHERE balance_amount IS NULL;

-- 2. CREATE OR REPLACE dispatch_order_and_create_invoice
CREATE OR REPLACE FUNCTION public.dispatch_order_and_create_invoice(
  p_order_id uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_invoice_id uuid;
  v_invoice_num text;
  v_org_id uuid;
  v_oi record;
  v_allocated_batch_id uuid;
  v_effective_user_id uuid := NULL;
BEGIN
  -- 1. Validate and lock order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 2. Idempotency safeguard: if invoice already exists for this order, return existing
  SELECT id, invoice_number INTO v_invoice_id, v_invoice_num
  FROM public.invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF FOUND THEN
    IF v_order.status != 'dispatched' THEN
      UPDATE public.orders
      SET status = 'dispatched',
          dispatched_at = COALESCE(dispatched_at, now()),
          dispatched_by = COALESCE(dispatched_by, p_user_id),
          updated_at = now()
      WHERE id = p_order_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_num,
      'status', 'dispatched',
      'already_dispatched', true
    );
  END IF;

  -- 3. Verify order can be dispatched
  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order cannot be dispatched from status %', v_order.status;
  END IF;

  v_org_id := v_order.organization_id;

  -- Validate p_user_id against profiles foreign key
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
      v_effective_user_id := p_user_id;
    END IF;
  END IF;

  -- 4. Generate sequential atomic invoice document number
  BEGIN
    v_invoice_num := public.next_document_number(
      v_org_id,
      'invoice',
      'INV',
      4
    );
  EXCEPTION WHEN OTHERS THEN
    v_invoice_num := NULL;
  END;

  IF v_invoice_num IS NULL OR v_invoice_num = '' THEN
    v_invoice_num := 'INV-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- 5. Create invoice header (status = 'ready' / pending delivery)
  INSERT INTO public.invoices (
    organization_id,
    order_id,
    customer_id,
    invoice_number,
    invoice_date,
    due_date,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    balance_amount,
    status,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    v_order.id,
    v_order.customer_id,
    v_invoice_num,
    CURRENT_DATE,
    CURRENT_DATE + 7, -- Net 7 Days default
    v_order.subtotal,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total_amount,
    v_order.total_amount, -- initial balance equals total_amount
    'ready',
    COALESCE(v_order.notes, 'Generated on order dispatch'),
    v_effective_user_id
  )
  RETURNING id INTO v_invoice_id;

  -- 6. Create invoice items with FEFO or explicitly chosen batch allocation
  FOR v_oi IN (
    SELECT oi.*, sku.product_id
    FROM public.order_items oi
    JOIN public.product_skus sku ON sku.id = oi.product_sku_id
    WHERE oi.order_id = p_order_id
  ) LOOP
    -- Priority 1: Use batch_id explicitly specified on the order item
    v_allocated_batch_id := v_oi.batch_id;

    -- Priority 2: FEFO allocation - Pick earliest active batch with available stock
    IF v_allocated_batch_id IS NULL THEN
      SELECT b.id INTO v_allocated_batch_id
      FROM public.batches b
      JOIN public.batch_stock bs ON bs.batch_id = b.id
      WHERE b.product_sku_id = v_oi.product_sku_id
        AND b.organization_id = v_org_id
        AND b.status = 'active'
        AND b.expiry_date >= CURRENT_DATE
        AND (bs.quantity_on_hand - bs.quantity_reserved) > 0
      ORDER BY b.expiry_date ASC, b.production_date ASC
      LIMIT 1;
    END IF;

    -- Priority 3: Fallback - Pick any active batch for this SKU or parent product
    IF v_allocated_batch_id IS NULL THEN
      SELECT b.id INTO v_allocated_batch_id
      FROM public.batches b
      JOIN public.product_skus sku ON sku.id = b.product_sku_id
      WHERE (b.product_sku_id = v_oi.product_sku_id OR sku.product_id = v_oi.product_id)
        AND b.organization_id = v_org_id
        AND b.status = 'active'
      ORDER BY b.expiry_date ASC
      LIMIT 1;
    END IF;

    INSERT INTO public.invoice_items (
      invoice_id,
      product_sku_id,
      batch_id,
      quantity,
      rate,
      discount_amount,
      tax_percent,
      tax_amount,
      line_total
    ) VALUES (
      v_invoice_id,
      v_oi.product_sku_id,
      v_allocated_batch_id,
      v_oi.quantity,
      v_oi.unit_price,
      v_oi.discount_amount,
      v_oi.tax_percent,
      v_oi.tax_amount,
      v_oi.line_total
    );

    -- If order item did not have batch_id recorded, save the allocated batch back for audit
    IF v_oi.batch_id IS NULL AND v_allocated_batch_id IS NOT NULL THEN
      UPDATE public.order_items
      SET batch_id = v_allocated_batch_id
      WHERE id = v_oi.id;
    END IF;
  END LOOP;

  -- 7. Post double-entry Customer Ledger Debit
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
    'Tax Invoice ' || v_invoice_num || ' sales charge'
  );

  -- 8. Transition order to dispatched
  UPDATE public.orders
  SET status = 'dispatched',
      dispatched_at = now(),
      dispatched_by = v_effective_user_id,
      updated_at = now()
  WHERE id = p_order_id;

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
    v_effective_user_id,
    'Order dispatched with invoice ' || v_invoice_num
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_num,
    'status', 'dispatched'
  );
END;
$function$;

-- 3. Update bulk_dispatch_orders to allow both confirmed and pending orders
CREATE OR REPLACE FUNCTION public.bulk_dispatch_orders(
  p_order_ids uuid[],
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_dispatched_count int := 0;
  v_skipped_count int := 0;
  v_failed_count int := 0;
  v_res jsonb;
  v_order_status text;
  v_invoices jsonb := '[]'::jsonb;
BEGIN
  FOREACH v_id IN ARRAY p_order_ids
  LOOP
    SELECT status INTO v_order_status
    FROM public.orders
    WHERE id = v_id;

    IF v_order_status IN ('confirmed', 'pending') THEN
      BEGIN
        v_res := public.dispatch_order_and_create_invoice(v_id, p_user_id);
        IF (v_res->>'success')::boolean THEN
          v_dispatched_count := v_dispatched_count + 1;
          v_invoices := v_invoices || jsonb_build_object(
            'order_id', v_id,
            'invoice_id', v_res->>'invoice_id',
            'invoice_number', v_res->>'invoice_number'
          );
        ELSE
          v_failed_count := v_failed_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_failed_count := v_failed_count + 1;
      END;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'dispatched_count', v_dispatched_count,
    'invoices_created', v_dispatched_count,
    'skipped_count', v_skipped_count,
    'failed_count', v_failed_count,
    'invoices', v_invoices
  );
END;
$function$;

-- 4. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.dispatch_order_and_create_invoice(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_dispatch_orders(uuid[], uuid) TO authenticated, anon;
