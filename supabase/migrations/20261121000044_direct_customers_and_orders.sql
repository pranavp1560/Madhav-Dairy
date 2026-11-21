-- Migration: 20261121000044_direct_customers_and_orders.sql
-- Description: Direct Customer Master + Bulk Order Management

-- 1. Create direct_customers Master Table
CREATE TABLE IF NOT EXISTS public.direct_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_code text NOT NULL,
  name text NOT NULL,
  mobile text NOT NULL,
  alternate_mobile text,
  email text,
  address text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_direct_customers_org ON public.direct_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_direct_customers_status ON public.direct_customers(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_customers_name ON public.direct_customers(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_direct_customers_mobile ON public.direct_customers(organization_id, mobile);
-- Normalized mobile lookup (digits only)
CREATE INDEX IF NOT EXISTS idx_direct_customers_clean_mobile 
  ON public.direct_customers (organization_id, regexp_replace(mobile, '\D', '', 'g'));

-- Enable RLS
ALTER TABLE public.direct_customers ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (staff, admins)
DROP POLICY IF EXISTS "Direct customers authenticated select" ON public.direct_customers;
CREATE POLICY "Direct customers authenticated select" ON public.direct_customers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Direct customers authenticated insert" ON public.direct_customers;
CREATE POLICY "Direct customers authenticated insert" ON public.direct_customers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Direct customers authenticated update" ON public.direct_customers;
CREATE POLICY "Direct customers authenticated update" ON public.direct_customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Direct customers authenticated delete" ON public.direct_customers;
CREATE POLICY "Direct customers authenticated delete" ON public.direct_customers
  FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_direct_customers_updated_at ON public.direct_customers;
CREATE TRIGGER trg_direct_customers_updated_at
  BEFORE UPDATE ON public.direct_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Modify public.orders table
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'shop' CHECK (order_type IN ('shop', 'direct_customer'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS direct_customer_id uuid REFERENCES public.direct_customers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS direct_customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS direct_customer_mobile text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS direct_customer_address text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_instructions text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_contact_person text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_contact_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_type text;

CREATE INDEX IF NOT EXISTS idx_orders_direct_customer_id ON public.orders(direct_customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);

-- 3. Modify public.invoices table
ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS direct_customer_id uuid REFERENCES public.direct_customers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS direct_customer_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS direct_customer_mobile text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS direct_customer_address text;

CREATE INDEX IF NOT EXISTS idx_invoices_direct_customer_id ON public.invoices(direct_customer_id);

-- 4. Initialize document_sequences for direct_customer
INSERT INTO public.document_sequences (organization_id, document_type, prefix, current_year, last_number)
VALUES ('00000000-0000-0000-0000-000000000001', 'direct_customer', 'DC', EXTRACT(YEAR FROM CURRENT_DATE)::integer, 0)
ON CONFLICT (organization_id, document_type, current_year) DO NOTHING;

-- 5. Update dispatch_order_and_create_invoice to handle direct customer orders safely
CREATE OR REPLACE FUNCTION public.dispatch_order_and_create_invoice(p_order_id uuid, p_user_id uuid DEFAULT NULL::uuid)
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
    direct_customer_id,
    direct_customer_name,
    direct_customer_mobile,
    direct_customer_address,
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
    v_order.direct_customer_id,
    v_order.direct_customer_name,
    v_order.direct_customer_mobile,
    v_order.direct_customer_address,
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

    -- If batch was not originally bound to order_item, link it now for traceability
    IF v_oi.batch_id IS NULL AND v_allocated_batch_id IS NOT NULL THEN
      UPDATE public.order_items
      SET batch_id = v_allocated_batch_id
      WHERE id = v_oi.id;
    END IF;

    -- Deduct physical batch stock and record outward transaction
    IF v_allocated_batch_id IS NOT NULL THEN
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

      UPDATE public.batch_stock
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - v_oi.quantity),
          updated_at = now()
      WHERE batch_id = v_allocated_batch_id;

      SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_rem_stock
      FROM public.batch_stock
      WHERE batch_id = v_allocated_batch_id;

      IF v_rem_stock <= 0 THEN
        UPDATE public.batches
        SET status = 'exhausted',
            updated_at = now()
        WHERE id = v_allocated_batch_id AND status = 'active';
      END IF;

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
        'Auto-deducted on dispatch for invoice ' || v_invoice_num,
        now()
      );
    END IF;
  END LOOP;

  -- 7. Post double-entry customer ledger debit (ONLY for registered shop customers)
  IF v_order.customer_id IS NOT NULL THEN
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
  END IF;

  -- 8. Transition order status to 'dispatched'
  UPDATE public.orders
  SET status = 'dispatched',
      dispatched_at = now(),
      dispatched_by = v_effective_user_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- 9. Record status history
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
    'Order dispatched and Tax Invoice ' || v_invoice_num || ' generated automatically'
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

-- 6. Update generate_invoice_for_order to handle direct customer orders safely
CREATE OR REPLACE FUNCTION public.generate_invoice_for_order(p_order_id uuid, p_user_id uuid DEFAULT NULL::uuid)
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
  -- 1. Validate order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 2. Idempotency safeguard: if invoice already exists, return existing
  SELECT id, invoice_number INTO v_invoice_id, v_invoice_num
  FROM public.invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_num,
      'status', 'ready',
      'already_exists', true
    );
  END IF;

  -- 3. Verify order can have an invoice generated
  IF v_order.status NOT IN ('confirmed', 'dispatched', 'delivered') THEN
    RAISE EXCEPTION 'Invoice can only be generated for confirmed, dispatched, or delivered orders. Current status: %', v_order.status;
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

  -- 5. Create invoice header
  INSERT INTO public.invoices (
    organization_id,
    order_id,
    customer_id,
    direct_customer_id,
    direct_customer_name,
    direct_customer_mobile,
    direct_customer_address,
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
    v_order.direct_customer_id,
    v_order.direct_customer_name,
    v_order.direct_customer_mobile,
    v_order.direct_customer_address,
    v_invoice_num,
    CURRENT_DATE,
    CURRENT_DATE + 7, -- Default Net 7 Days
    v_order.subtotal,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total_amount,
    v_order.total_amount,
    'ready',
    COALESCE(v_order.notes, 'Generated for confirmed order'),
    v_effective_user_id
  )
  RETURNING id INTO v_invoice_id;

  -- 6. Allocate batch items (FEFO) and create invoice items
  FOR v_oi IN (
    SELECT oi.*, sku.product_id
    FROM public.order_items oi
    JOIN public.product_skus sku ON sku.id = oi.product_sku_id
    WHERE oi.order_id = p_order_id
  ) LOOP
    v_allocated_batch_id := v_oi.batch_id;

    -- FEFO allocation
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

    -- Fallback batch
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

    IF v_oi.batch_id IS NULL AND v_allocated_batch_id IS NOT NULL THEN
      UPDATE public.order_items
      SET batch_id = v_allocated_batch_id
      WHERE id = v_oi.id;
    END IF;

    -- Deduct batch stock and record outward transaction
    IF v_allocated_batch_id IS NOT NULL THEN
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

      UPDATE public.batch_stock
      SET quantity_on_hand = GREATEST(0, quantity_on_hand - v_oi.quantity),
          updated_at = now()
      WHERE batch_id = v_allocated_batch_id;

      SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_rem_stock
      FROM public.batch_stock
      WHERE batch_id = v_allocated_batch_id;

      IF v_rem_stock <= 0 THEN
        UPDATE public.batches
        SET status = 'exhausted',
            updated_at = now()
        WHERE id = v_allocated_batch_id AND status = 'active';
      END IF;

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
        'Invoice generated sales allocation',
        now()
      );
    END IF;
  END LOOP;

  -- 7. Post double-entry customer ledger debit (ONLY for registered shop customers)
  IF v_order.customer_id IS NOT NULL THEN
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
  END IF;

  -- 8. Note: Order status remains 'confirmed'
  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    notes
  ) VALUES (
    p_order_id,
    v_order.status,
    v_order.status,
    v_effective_user_id,
    'Invoice ' || v_invoice_num || ' generated in Ready status'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_num,
    'status', 'ready'
  );
END;
$function$;
