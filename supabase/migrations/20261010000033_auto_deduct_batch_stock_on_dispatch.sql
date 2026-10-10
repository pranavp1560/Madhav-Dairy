-- =============================================================================
-- Migration: 20261010000033_auto_deduct_batch_stock_on_dispatch.sql
-- Description:
--   1. Add produced_quantity to public.batches to permanently track initial production.
--   2. Backfill produced_quantity from production inventory transactions.
--   3. Update dispatch_order_and_create_invoice RPC to:
--      - Automatically deduct sold quantity from batch_stock on order dispatch.
--      - Record outward inventory_transactions (transaction_type = 'sale').
--      - Mark batch as 'exhausted' when quantity_on_hand reaches 0.
--   4. Re-align existing batch_stock based on produced_quantity minus invoiced sales.
-- =============================================================================

-- 1. Ensure produced_quantity exists on batches table
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS produced_quantity numeric(12,2) DEFAULT 0;

-- 2. Backfill produced_quantity for existing batches from inventory_transactions
UPDATE public.batches b
SET produced_quantity = COALESCE(
  (
    SELECT quantity 
    FROM public.inventory_transactions 
    WHERE batch_id = b.id AND transaction_type = 'production' 
    ORDER BY created_at ASC 
    LIMIT 1
  ),
  (
    SELECT quantity_on_hand 
    FROM public.batch_stock 
    WHERE batch_id = b.id 
    LIMIT 1
  ),
  0
)
WHERE b.produced_quantity IS NULL OR b.produced_quantity = 0;

-- 3. Adjust existing batch_stock.quantity_on_hand = GREATEST(0, produced_quantity - already_invoiced_quantity)
UPDATE public.batch_stock bs
SET quantity_on_hand = GREATEST(
  0,
  COALESCE(b.produced_quantity, bs.quantity_on_hand) - COALESCE(sold.total_sold, 0)
),
updated_at = now()
FROM public.batches b
LEFT JOIN (
  SELECT batch_id, SUM(quantity) AS total_sold
  FROM public.invoice_items
  WHERE batch_id IS NOT NULL
  GROUP BY batch_id
) sold ON sold.batch_id = b.id
WHERE bs.batch_id = b.id;

-- Mark batches with 0 quantity on hand as exhausted
UPDATE public.batches
SET status = 'exhausted',
    updated_at = now()
WHERE id IN (
  SELECT batch_id 
  FROM public.batch_stock 
  GROUP BY batch_id 
  HAVING SUM(quantity_on_hand) <= 0
) AND status = 'active';

-- Backfill missing 'sale' inventory_transactions for historical invoices
INSERT INTO public.inventory_transactions (
  organization_id,
  location_id,
  product_sku_id,
  batch_id,
  transaction_type,
  quantity,
  reference_type,
  reference_id,
  notes,
  created_at
)
SELECT 
  inv.organization_id,
  COALESCE(bs.location_id, (SELECT id FROM public.locations WHERE organization_id = inv.organization_id LIMIT 1)),
  ii.product_sku_id,
  ii.batch_id,
  'sale',
  -ii.quantity,
  'invoice',
  inv.id,
  'Historical invoice sales stock deduction',
  inv.created_at
FROM public.invoice_items ii
JOIN public.invoices inv ON inv.id = ii.invoice_id
LEFT JOIN public.batch_stock bs ON bs.batch_id = ii.batch_id
WHERE ii.batch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_transactions tx
    WHERE tx.reference_id = inv.id 
      AND tx.batch_id = ii.batch_id 
      AND tx.transaction_type = 'sale'
  );

-- 4. CREATE OR REPLACE dispatch_order_and_create_invoice with automatic stock deduction
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
  v_batch_location_id uuid;
  v_rem_stock numeric(12,2);
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
    v_order.total_amount,
    'ready',
    COALESCE(v_order.notes, 'Generated on order dispatch'),
    v_effective_user_id
  )
  RETURNING id INTO v_invoice_id;

  -- 6. Create invoice items with FEFO or explicitly chosen batch allocation
  --    AND AUTOMATICALLY DEDUCT BATCH STOCK
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

    -- =========================================================================
    -- ATOMIC STOCK DEDUCTION UPON DISPATCH
    -- =========================================================================
    IF v_allocated_batch_id IS NOT NULL THEN
      -- Resolve storage location
      SELECT location_id INTO v_batch_location_id
      FROM public.batch_stock
      WHERE batch_id = v_allocated_batch_id
      LIMIT 1;

      IF v_batch_location_id IS NULL THEN
        SELECT id INTO v_batch_location_id
        FROM public.locations
        WHERE organization_id = v_org_id
        LIMIT 1;
      END IF;

      -- Deduct from batch_stock
      UPDATE public.batch_stock
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - v_oi.quantity),
          updated_at = now()
      WHERE batch_id = v_allocated_batch_id;

      -- Check remaining stock across all locations for this batch
      SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_rem_stock
      FROM public.batch_stock
      WHERE batch_id = v_allocated_batch_id;

      -- If batch stock is completely exhausted, update batch status to exhausted
      IF v_rem_stock <= 0 THEN
        UPDATE public.batches
        SET status = 'exhausted',
            updated_at = now()
        WHERE id = v_allocated_batch_id AND status = 'active';
      END IF;

      -- Record outward inventory audit transaction
      INSERT INTO public.inventory_transactions (
        organization_id,
        location_id,
        product_sku_id,
        batch_id,
        transaction_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_at
      ) VALUES (
        v_org_id,
        v_batch_location_id,
        v_oi.product_sku_id,
        v_allocated_batch_id,
        'sale',
        -v_oi.quantity,
        'invoice',
        v_invoice_id,
        'Dispatched order invoice sales deduction',
        now()
      );
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
    'Order dispatched with invoice ' || v_invoice_num || ' and stock deducted'
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.dispatch_order_and_create_invoice(uuid, uuid) TO authenticated, anon;
