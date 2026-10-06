-- =============================================================================
-- Migration 025: Production Order, Invoice & Payment Workflow
-- Redesign order, invoice, and payment workflow into:
--   Order: Pending -> Confirmed -> Dispatched
--   Invoice: Ready -> Delivered -> Open Payment -> Settled
-- Automatic invoice generation upon dispatch, bulk operations, and audit trail
-- =============================================================================

-- 1. ORDER SCHEMA & STATUS MIGRATION
-- First drop existing constraint before migrating statuses so new values are allowed
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Migrate any historical orders with retired statuses
UPDATE public.orders
SET status = 'dispatched'
WHERE status IN ('delivered', 'invoiced', 'partially_invoiced');

UPDATE public.orders
SET status = 'confirmed'
WHERE status IN ('preparing', 'approved', 'picked');

-- Add updated 3-status operational constraint
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'dispatched', 'cancelled'));

-- Add order lifecycle audit columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'confirmed_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'dispatched_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN dispatched_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'dispatched_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN dispatched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


-- 2. INVOICE SCHEMA & STATUS MIGRATION
-- First drop old invoice status check constraint
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Migrate existing invoice statuses:
-- unpaid -> ready
-- partial -> open_payment
-- paid -> settled
UPDATE public.invoices
SET status = 'ready'
WHERE status = 'unpaid';

UPDATE public.invoices
SET status = 'open_payment'
WHERE status = 'partial';

UPDATE public.invoices
SET status = 'settled'
WHERE status = 'paid';

-- Alter default and add new constraint
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'ready';
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('ready', 'delivered', 'open_payment', 'settled', 'cancelled'));

-- Add invoice lifecycle audit columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'delivered_by'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN delivered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'settled_at'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN settled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'settled_by'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN settled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enforce idempotent rule: Exactly one invoice per source order
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_order_id
  ON public.invoices(order_id)
  WHERE order_id IS NOT NULL;


-- 3. PAYMENT ACCOUNTING AUDIT COLUMNS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'is_accounted'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN is_accounted boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'accounted_at'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN accounted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'accounted_by'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN accounted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


-- 4. ATOMIC DISPATCH & AUTOMATIC INVOICE GENERATION RPC
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
  v_existing_inv record;
BEGIN
  -- 1. Lock and validate order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotency check: If already dispatched, return existing invoice
  IF v_order.status = 'dispatched' THEN
    SELECT * INTO v_existing_inv
    FROM public.invoices
    WHERE order_id = p_order_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_status', 'dispatched',
        'invoice_id', v_existing_inv.id,
        'invoice_number', v_existing_inv.invoice_number,
        'already_dispatched', true
      );
    END IF;
  ELSIF v_order.status != 'confirmed' THEN
    RAISE EXCEPTION 'This order cannot be dispatched because it has not been confirmed.';
  END IF;

  v_org_id := v_order.organization_id;

  -- Check if invoice already exists for this order
  SELECT * INTO v_existing_inv
  FROM public.invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.orders
    SET status = 'dispatched',
        dispatched_at = now(),
        dispatched_by = p_user_id,
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_order.id,
      'order_status', 'dispatched',
      'invoice_id', v_existing_inv.id,
      'invoice_number', v_existing_inv.invoice_number
    );
  END IF;

  -- Generate atomic invoice document number
  BEGIN
    v_invoice_number := public.next_document_number(v_org_id, 'invoice', 'INV', 4);
  EXCEPTION WHEN OTHERS THEN
    v_invoice_number := NULL;
  END;

  IF v_invoice_number IS NULL OR v_invoice_number = '' THEN
    v_invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- Create Invoice with status 'ready'
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


-- 5. BULK ORDER ACTIONS RPCS
-- Bulk Confirm Orders
CREATE OR REPLACE FUNCTION public.bulk_confirm_orders(
  p_order_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_confirmed_count int := 0;
  v_skipped_count int := 0;
  v_order_status text;
BEGIN
  FOREACH v_id IN ARRAY p_order_ids
  LOOP
    SELECT status INTO v_order_status
    FROM public.orders
    WHERE id = v_id
    FOR UPDATE;

    IF v_order_status = 'pending' THEN
      UPDATE public.orders
      SET status = 'confirmed',
          confirmed_at = now(),
          confirmed_by = p_user_id,
          updated_at = now()
      WHERE id = v_id;

      INSERT INTO public.order_status_history (
        order_id,
        from_status,
        to_status,
        changed_by,
        notes
      ) VALUES (
        v_id,
        'pending',
        'confirmed',
        p_user_id,
        'Bulk confirmed by staff'
      );

      v_confirmed_count := v_confirmed_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'confirmed_count', v_confirmed_count,
    'skipped_count', v_skipped_count,
    'total_processed', array_length(p_order_ids, 1)
  );
END;
$$;

-- Bulk Dispatch Orders & Create Invoices
CREATE OR REPLACE FUNCTION public.bulk_dispatch_orders(
  p_order_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    IF v_order_status = 'confirmed' THEN
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
$$;


-- 6. INVOICE LIFECYCLE & BULK RPCS
-- Mark Invoice Delivered
CREATE OR REPLACE FUNCTION public.mark_invoice_delivered(
  p_invoice_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_status != 'ready' THEN
    RAISE EXCEPTION 'Only invoices in Ready status can be marked as Delivered (current status: %)', v_status;
  END IF;

  UPDATE public.invoices
  SET status = 'delivered',
      delivered_at = now(),
      delivered_by = p_user_id,
      updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'status', 'delivered'
  );
END;
$$;

-- Bulk Mark Invoices Delivered
CREATE OR REPLACE FUNCTION public.bulk_deliver_invoices(
  p_invoice_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_delivered_count int := 0;
  v_skipped_count int := 0;
  v_status text;
BEGIN
  FOREACH v_id IN ARRAY p_invoice_ids
  LOOP
    SELECT status INTO v_status
    FROM public.invoices
    WHERE id = v_id
    FOR UPDATE;

    IF v_status = 'ready' THEN
      UPDATE public.invoices
      SET status = 'delivered',
          delivered_at = now(),
          delivered_by = p_user_id,
          updated_at = now()
      WHERE id = v_id;

      v_delivered_count := v_delivered_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'delivered_count', v_delivered_count,
    'skipped_count', v_skipped_count,
    'total_processed', array_length(p_invoice_ids, 1)
  );
END;
$$;


-- 7. PAYMENT ALLOCATION & ACCOUNTING CONFIRMATION RPCS
-- Allocate Payment Against an Invoice
CREATE OR REPLACE FUNCTION public.allocate_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv record;
  v_already_allocated numeric(12,2) := 0;
  v_remaining numeric(12,2);
  v_payment_id uuid;
  v_payment_number text;
  v_org_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment allocation amount must be greater than zero';
  END IF;

  -- 1. Lock invoice
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.status NOT IN ('delivered', 'open_payment') THEN
    RAISE EXCEPTION 'Payments can only be allocated to invoices that are Delivered or Open Payment (current status: %)', v_inv.status;
  END IF;

  v_org_id := v_inv.organization_id;

  -- 2. Calculate remaining amount
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_already_allocated
  FROM public.payment_allocations
  WHERE invoice_id = p_invoice_id;

  v_remaining := v_inv.total_amount - v_already_allocated;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Payment allocation of ₹% exceeds the remaining invoice amount of ₹%', p_amount, v_remaining;
  END IF;

  -- 3. Generate payment receipt number
  BEGIN
    v_payment_number := public.next_document_number(v_org_id, 'payment', 'REC', 4);
  EXCEPTION WHEN OTHERS THEN
    v_payment_number := NULL;
  END;

  IF v_payment_number IS NULL OR v_payment_number = '' THEN
    v_payment_number := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- 4. Create payment record (unaccounted by default)
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
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    v_inv.customer_id,
    v_payment_number,
    p_payment_date,
    p_amount,
    p_payment_method,
    p_reference,
    p_notes,
    false, -- Pending accounting verification
    now(),
    now()
  ) RETURNING id INTO v_payment_id;

  -- 5. Record allocation
  INSERT INTO public.payment_allocations (
    payment_id,
    invoice_id,
    allocated_amount
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    p_amount
  );

  -- 6. Move Invoice to 'open_payment'
  UPDATE public.invoices
  SET status = 'open_payment',
      updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_number', v_payment_number,
    'invoice_id', p_invoice_id,
    'allocated_amount', p_amount,
    'new_invoice_status', 'open_payment',
    'remaining_amount', v_remaining - p_amount
  );
END;
$$;


-- Confirm & Account Payments (Moves invoice to Settled)
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_invoice_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv record;
  v_total_allocated numeric(12,2) := 0;
  v_accounted_allocations numeric(12,2) := 0;
  v_alloc record;
BEGIN
  -- 1. Lock invoice
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_inv.status != 'open_payment' THEN
    RAISE EXCEPTION 'Only invoices in Open Payment status can have payments confirmed (current status: %)', v_inv.status;
  END IF;

  -- 2. Confirm each allocated payment and post double-entry ledger credits
  FOR v_alloc IN
    SELECT pa.id AS allocation_id, pa.allocated_amount, p.id AS payment_id, p.payment_number, p.payment_method, p.reference_number, p.is_accounted
    FROM public.payment_allocations pa
    JOIN public.payments p ON pa.payment_id = p.id
    WHERE pa.invoice_id = p_invoice_id
  LOOP
    IF NOT v_alloc.is_accounted THEN
      -- Mark payment accounted
      UPDATE public.payments
      SET is_accounted = true,
          accounted_at = now(),
          accounted_by = p_user_id,
          updated_at = now()
      WHERE id = v_alloc.payment_id;

      -- Post Double-Entry Ledger Credit
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
        v_inv.organization_id,
        v_inv.customer_id,
        CURRENT_DATE,
        'payment',
        'payments',
        v_alloc.payment_id,
        null,
        v_alloc.allocated_amount,
        'Accounted payment ' || v_alloc.payment_number || ' for Invoice ' || v_inv.invoice_number
      );
    END IF;

    v_accounted_allocations := v_accounted_allocations + v_alloc.allocated_amount;
  END LOOP;

  -- 3. If accounted allocations cover the invoice amount, settle the invoice
  IF v_accounted_allocations >= v_inv.total_amount THEN
    UPDATE public.invoices
    SET status = 'settled',
        settled_at = now(),
        settled_by = p_user_id,
        updated_at = now()
    WHERE id = p_invoice_id;

    -- Also update source order payment_status to 'paid' if order linked
    IF v_inv.order_id IS NOT NULL THEN
      UPDATE public.orders
      SET payment_status = 'paid',
          updated_at = now()
      WHERE id = v_inv.order_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'status', 'settled',
      'total_amount', v_inv.total_amount,
      'accounted_amount', v_accounted_allocations,
      'fully_settled', true
    );
  ELSE
    -- Partial settlement: remains open_payment
    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'status', 'open_payment',
      'total_amount', v_inv.total_amount,
      'accounted_amount', v_accounted_allocations,
      'fully_settled', false
    );
  END IF;
END;
$$;


-- Bulk Confirm Invoice Payments
CREATE OR REPLACE FUNCTION public.bulk_confirm_invoice_payments(
  p_invoice_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_settled_count int := 0;
  v_skipped_count int := 0;
  v_res jsonb;
  v_status text;
BEGIN
  FOREACH v_id IN ARRAY p_invoice_ids
  LOOP
    SELECT status INTO v_status
    FROM public.invoices
    WHERE id = v_id;

    IF v_status = 'open_payment' THEN
      BEGIN
        v_res := public.confirm_invoice_payment(v_id, p_user_id);
        IF (v_res->>'fully_settled')::boolean THEN
          v_settled_count := v_settled_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_skipped_count := v_skipped_count + 1;
      END;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'settled_count', v_settled_count,
    'skipped_count', v_skipped_count,
    'total_processed', array_length(p_invoice_ids, 1)
  );
END;
$$;


-- 8. PERMISSIONS & GRANTS
GRANT EXECUTE ON FUNCTION public.dispatch_order_and_create_invoice TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_confirm_orders TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_dispatch_orders TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_delivered TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_deliver_invoices TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.allocate_invoice_payment TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_confirm_invoice_payments TO authenticated, anon;
