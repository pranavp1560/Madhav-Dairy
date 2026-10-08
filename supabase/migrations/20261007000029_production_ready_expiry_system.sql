-- =============================================================================
-- Migration 029: Production-Ready Expiry Management & In-App Notification System
-- Module: Cold-Chain Freshness Radar, FEFO Traceability & Customer Expiry Lifecycle
-- =============================================================================

-- Enable pg_cron if available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- 1. EXTEND EXPIRY RULES FOR PRODUCT-SPECIFIC THRESHOLDS
-- -----------------------------------------------------------------------------

-- Make legacy columns nullable so product-specific rules can be stored cleanly
ALTER TABLE public.expiry_rules ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.expiry_rules ALTER COLUMN days_before_expiry DROP NOT NULL;
ALTER TABLE public.expiry_rules ALTER COLUMN severity DROP NOT NULL;

-- Add product-specific rule columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_rules' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.expiry_rules ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_rules' AND column_name = 'alert_1_days'
  ) THEN
    ALTER TABLE public.expiry_rules ADD COLUMN alert_1_days integer DEFAULT 10;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_rules' AND column_name = 'alert_2_days'
  ) THEN
    ALTER TABLE public.expiry_rules ADD COLUMN alert_2_days integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_rules' AND column_name = 'alert_3_days'
  ) THEN
    ALTER TABLE public.expiry_rules ADD COLUMN alert_3_days integer DEFAULT 3;
  END IF;
END $$;

-- Validation constraint: Alert 1 > Alert 2 > Alert 3 > 0
ALTER TABLE public.expiry_rules DROP CONSTRAINT IF EXISTS chk_expiry_rules_alerts;
ALTER TABLE public.expiry_rules ADD CONSTRAINT chk_expiry_rules_alerts 
  CHECK (
    product_id IS NULL OR (
      alert_1_days > 0 AND 
      alert_2_days > 0 AND 
      alert_3_days > 0 AND 
      alert_1_days > alert_2_days AND 
      alert_2_days > alert_3_days
    )
  );

-- Unique index: Exactly one expiry rule per product per organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_expiry_rules_org_product 
  ON public.expiry_rules (organization_id, product_id) 
  WHERE product_id IS NOT NULL;

-- Populate default product expiry rules for existing products (preserving existing rows)
DO $$
DECLARE
  p RECORD;
  v_a1 int;
  v_a2 int;
  v_a3 int;
BEGIN
  FOR p IN SELECT id, organization_id, name, shelf_life_days FROM public.products LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.expiry_rules 
      WHERE product_id = p.id AND organization_id = p.organization_id
    ) THEN
      IF p.shelf_life_days >= 10 THEN
        v_a1 := 10;
        v_a2 := 5;
        v_a3 := 3;
      ELSIF p.shelf_life_days >= 6 THEN
        v_a1 := p.shelf_life_days;
        v_a2 := LEAST(5, v_a1 - 1);
        v_a3 := LEAST(3, v_a2 - 1);
      ELSIF p.shelf_life_days >= 3 THEN
        v_a1 := p.shelf_life_days;
        v_a2 := 2;
        v_a3 := 1;
      ELSE
        v_a1 := GREATEST(3, p.shelf_life_days);
        v_a2 := 2;
        v_a3 := 1;
      END IF;

      INSERT INTO public.expiry_rules (
        organization_id,
        product_id,
        title,
        alert_1_days,
        alert_2_days,
        alert_3_days,
        target_customer,
        target_internal,
        enabled,
        created_at,
        updated_at
      ) VALUES (
        p.organization_id,
        p.id,
        p.name || ' Expiry Rule',
        v_a1,
        v_a2,
        v_a3,
        true,
        true,
        true,
        now(),
        now()
      );
    END IF;
  END LOOP;
END $$;

-- Automatic trigger function: Whenever a new product is created, generate its default expiry rule
CREATE OR REPLACE FUNCTION public.trg_auto_create_product_expiry_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_a1 int;
  v_a2 int;
  v_a3 int;
BEGIN
  IF NEW.shelf_life_days >= 10 THEN
    v_a1 := 10;
    v_a2 := 5;
    v_a3 := 3;
  ELSIF NEW.shelf_life_days >= 6 THEN
    v_a1 := NEW.shelf_life_days;
    v_a2 := LEAST(5, v_a1 - 1);
    v_a3 := LEAST(3, v_a2 - 1);
  ELSE
    v_a1 := GREATEST(3, NEW.shelf_life_days);
    v_a2 := 2;
    v_a3 := 1;
  END IF;

  INSERT INTO public.expiry_rules (
    organization_id,
    product_id,
    title,
    alert_1_days,
    alert_2_days,
    alert_3_days,
    target_customer,
    target_internal,
    enabled
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.name || ' Expiry Rule',
    v_a1,
    v_a2,
    v_a3,
    true,
    true,
    true
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_auto_expiry_rule ON public.products;
CREATE TRIGGER trg_products_auto_expiry_rule
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_create_product_expiry_rule();


-- -----------------------------------------------------------------------------
-- 2. CUSTOMER DELIVERED PRODUCT BATCHES TRACKING TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  quantity_purchased numeric(12,2) NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining numeric(12,2) NOT NULL CHECK (quantity_remaining >= 0),
  delivered_at timestamptz DEFAULT now() NOT NULL,
  expiry_date date NOT NULL,
  is_current boolean DEFAULT true NOT NULL,
  tracking_status text DEFAULT 'active' NOT NULL CHECK (tracking_status IN ('active', 'superseded', 'completed', 'expired')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_customer_product_batches_updated_at
  BEFORE UPDATE ON public.customer_product_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cpb_org ON public.customer_product_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_cpb_customer ON public.customer_product_batches(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpb_product ON public.customer_product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_cpb_customer_product ON public.customer_product_batches(customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cpb_batch ON public.customer_product_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_cpb_is_current ON public.customer_product_batches(is_current);
CREATE INDEX IF NOT EXISTS idx_cpb_tracking_status ON public.customer_product_batches(tracking_status);


-- -----------------------------------------------------------------------------
-- 3. EXTEND EXPIRY ALERTS TABLE
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN organization_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN alert_type text DEFAULT 'staff' NOT NULL CHECK (alert_type IN ('staff', 'customer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'threshold_days'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN threshold_days integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN expiry_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'remaining_quantity'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN remaining_quantity numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'notification_id'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'customer_product_batch_id'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN customer_product_batch_id uuid REFERENCES public.customer_product_batches(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expiry_alerts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.expiry_alerts ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;
  END IF;
END $$;

-- Update status constraint to allow 'superseded' and 'expired'
ALTER TABLE public.expiry_alerts DROP CONSTRAINT IF EXISTS expiry_alerts_status_check;
ALTER TABLE public.expiry_alerts ADD CONSTRAINT expiry_alerts_status_check 
  CHECK (status IN ('active', 'acknowledged', 'resolved', 'superseded', 'expired'));

-- Populate product_id and expiry_date for any existing alerts
UPDATE public.expiry_alerts ea
SET product_id = sku.product_id,
    expiry_date = b.expiry_date
FROM public.batches b
JOIN public.product_skus sku ON sku.id = b.product_sku_id
WHERE ea.batch_id = b.id AND (ea.product_id IS NULL OR ea.expiry_date IS NULL);

-- Strict deduplication indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_expiry_alerts_staff_dedup
  ON public.expiry_alerts (organization_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid), batch_id, threshold_days)
  WHERE alert_type = 'staff' AND status IN ('active', 'acknowledged');

CREATE UNIQUE INDEX IF NOT EXISTS uq_expiry_alerts_customer_dedup
  ON public.expiry_alerts (customer_id, product_id, batch_id, threshold_days)
  WHERE alert_type = 'customer' AND status IN ('active', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_alert_type ON public.expiry_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_product ON public.expiry_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_cpb ON public.expiry_alerts(customer_product_batch_id);


-- -----------------------------------------------------------------------------
-- 4. EXTEND NOTIFICATIONS TABLE FOR STORE-LEVEL VISIBILITY
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_customer ON public.notifications(customer_id);


-- -----------------------------------------------------------------------------
-- 5. ORDER STATUS WORKFLOW: SUPPORT DELIVERED STATUS
-- -----------------------------------------------------------------------------

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_order_items_batch_id ON public.order_items(batch_id);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 6. ATOMIC ORDER DISPATCH WITH FEFO BATCH ALLOCATION
-- -----------------------------------------------------------------------------

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
  v_oi record;
  v_allocated_batch_id uuid;
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
  IF v_order.status = 'dispatched' OR v_order.status = 'delivered' THEN
    SELECT * INTO v_existing_inv
    FROM public.invoices
    WHERE order_id = p_order_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_status', v_order.status,
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
        dispatched_at = COALESCE(dispatched_at, now()),
        dispatched_by = COALESCE(dispatched_by, p_user_id),
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

  -- Create invoice items with FEFO or explicitly chosen batch allocation
  FOR v_oi IN (
    SELECT oi.*, sku.product_id
    FROM public.order_items oi
    JOIN public.product_skus sku ON sku.id = oi.product_sku_id
    WHERE oi.order_id = p_order_id
  ) LOOP
    -- Priority 1: Use batch_id explicitly specified on the order item
    v_allocated_batch_id := v_oi.batch_id;

    -- Priority 2: FEFO allocation: Pick earliest active batch that has available stock
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

    -- Priority 3: Fallback: Pick any active batch for this SKU or product
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
  END LOOP;

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
    'Order dispatched and invoice ' || v_invoice_number || ' generated with FEFO batch allocation'
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


-- -----------------------------------------------------------------------------
-- 7. CUSTOMER DELIVERY & REORDER LIFECYCLE HANDLER
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_delivery_customer_tracking(
  p_invoice_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_item record;
  v_batch record;
  v_sku record;
  v_prod_id uuid;
  v_batch_id uuid;
  v_created_count int := 0;
  v_superseded_count int := 0;
BEGIN
  -- Lock invoice
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Iterate through invoice items to record customer batch delivery
  FOR v_item IN (
    SELECT ii.*, s.product_id
    FROM public.invoice_items ii
    JOIN public.product_skus s ON s.id = ii.product_sku_id
    WHERE ii.invoice_id = p_invoice_id
  ) LOOP
    v_prod_id := v_item.product_id;
    v_batch_id := v_item.batch_id;

    -- If batch was not yet assigned, resolve via FEFO
    IF v_batch_id IS NULL THEN
      SELECT b.id INTO v_batch_id
      FROM public.batches b
      JOIN public.product_skus sku ON sku.id = b.product_sku_id
      WHERE (b.product_sku_id = v_item.product_sku_id OR sku.product_id = v_item.product_id)
        AND b.organization_id = v_inv.organization_id
        AND b.status = 'active'
      ORDER BY b.expiry_date ASC, b.production_date ASC
      LIMIT 1;

      IF v_batch_id IS NOT NULL THEN
        UPDATE public.invoice_items
        SET batch_id = v_batch_id
        WHERE id = v_item.id;
      END IF;
    END IF;

    -- If batch is known, process customer tracking
    IF v_batch_id IS NOT NULL THEN
      SELECT * INTO v_batch FROM public.batches WHERE id = v_batch_id;

      -- REORDER SUPPRESSION:
      -- Check if customer already has an active tracking record for this product
      -- If so, mark the old record as superseded and resolve/supersede old customer alerts
      UPDATE public.customer_product_batches
      SET is_current = false,
          tracking_status = 'superseded',
          updated_at = now()
      WHERE customer_id = v_inv.customer_id
        AND product_id = v_prod_id
        AND is_current = true;

      IF FOUND THEN
        v_superseded_count := v_superseded_count + 1;

        -- Supersede active customer alerts for the old batch
        UPDATE public.expiry_alerts
        SET status = 'superseded',
            resolved_at = now(),
            updated_at = now()
        WHERE customer_id = v_inv.customer_id
          AND product_id = v_prod_id
          AND alert_type = 'customer'
          AND status IN ('active', 'acknowledged');
      END IF;

      -- Create new current customer product batch tracking record
      INSERT INTO public.customer_product_batches (
        organization_id,
        customer_id,
        product_id,
        batch_id,
        order_id,
        invoice_id,
        quantity_purchased,
        quantity_remaining,
        delivered_at,
        expiry_date,
        is_current,
        tracking_status,
        created_at,
        updated_at
      ) VALUES (
        v_inv.organization_id,
        v_inv.customer_id,
        v_prod_id,
        v_batch_id,
        v_inv.order_id,
        v_inv.id,
        v_item.quantity,
        v_item.quantity,
        now(),
        v_batch.expiry_date,
        true,
        'active',
        now(),
        now()
      );

      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  -- Synchronize linked order status to 'delivered' if linked
  IF v_inv.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = now(),
        delivered_by = p_user_id,
        updated_at = now()
    WHERE id = v_inv.order_id;

    INSERT INTO public.order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by,
      notes
    ) VALUES (
      v_inv.order_id,
      'dispatched',
      'delivered',
      p_user_id,
      'Order marked delivered via Invoice ' || v_inv.invoice_number || ' delivery confirmation'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'tracked_items_created', v_created_count,
    'superseded_items', v_superseded_count
  );
END;
$$;

-- Override mark_invoice_delivered to automatically trigger customer tracking lifecycle
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
  v_tracking_res jsonb;
BEGIN
  SELECT status INTO v_status
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_status != 'ready' AND v_status != 'delivered' THEN
    RAISE EXCEPTION 'Only invoices in Ready status can be marked as Delivered (current status: %)', v_status;
  END IF;

  UPDATE public.invoices
  SET status = 'delivered',
      delivered_at = COALESCE(delivered_at, now()),
      delivered_by = COALESCE(delivered_by, p_user_id),
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Process customer delivered batch tracking
  v_tracking_res := public.process_delivery_customer_tracking(p_invoice_id, p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'status', 'delivered',
    'customer_tracking', v_tracking_res
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. CORE EXPIRY SURVEILLANCE & NOTIFICATION ENGINE
-- Evaluates real batches, stock, product rules, customer tracking, deduplication
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.evaluate_expiry_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Record cursors
  r RECORD;
  c_rec RECORD;
  v_rule RECORD;

  -- Variables
  v_days_remaining int;
  v_threshold int;
  v_severity text;
  v_existing_alert_id uuid;
  v_notif_id uuid;
  v_title text;
  v_msg text;
  v_customer_user_id uuid;
  v_admin_profile_id uuid;

  -- Audit Counters
  v_staff_alerts_created int := 0;
  v_staff_alerts_resolved int := 0;
  v_customer_alerts_created int := 0;
  v_customer_alerts_resolved int := 0;
BEGIN

  -- Resolve default system internal user for notifications
  SELECT id INTO v_admin_profile_id
  FROM public.profiles
  WHERE user_type = 'internal' AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  -- ===========================================================================
  -- PHASE 1: STAFF INVENTORY EXPIRY EVALUATION
  -- Source of Truth: Batches + Batch Stock + Product Rules + Current Date
  -- ===========================================================================
  FOR r IN (
    SELECT 
      b.id AS batch_id,
      b.organization_id,
      b.batch_number,
      b.expiry_date,
      b.production_date,
      p.id AS product_id,
      p.name AS product_name,
      p.shelf_life_days,
      bs.location_id,
      loc.name AS location_name,
      COALESCE(bs.quantity_on_hand, 0) - COALESCE(bs.quantity_reserved, 0) AS remaining_qty,
      (b.expiry_date - CURRENT_DATE) AS days_remaining
    FROM public.batches b
    JOIN public.product_skus sku ON sku.id = b.product_sku_id
    JOIN public.products p ON p.id = sku.product_id
    LEFT JOIN public.batch_stock bs ON bs.batch_id = b.id
    LEFT JOIN public.locations loc ON loc.id = bs.location_id
    WHERE b.status NOT IN ('exhausted')
  ) LOOP

    -- 1. If stock is exhausted (remaining_qty <= 0), resolve any active staff alert
    IF r.remaining_qty <= 0 THEN
      UPDATE public.expiry_alerts
      SET status = 'resolved',
          resolved_at = now(),
          remaining_quantity = 0,
          updated_at = now()
      WHERE batch_id = r.batch_id
        AND alert_type = 'staff'
        AND status IN ('active', 'acknowledged');

      IF FOUND THEN
        v_staff_alerts_resolved := v_staff_alerts_resolved + 1;
      END IF;

      CONTINUE;
    END IF;

    -- 2. If expired (days_remaining < 0)
    IF r.days_remaining < 0 THEN
      UPDATE public.batches 
      SET status = 'expired', updated_at = now() 
      WHERE id = r.batch_id AND status != 'expired';

      -- Check if -1 threshold alert already exists
      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE organization_id = r.organization_id
        AND batch_id = r.batch_id
        AND alert_type = 'staff'
        AND threshold_days = -1
        AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ ' || r.product_name || ' batch ' || r.batch_number || ' has EXPIRED';
        v_msg := 'Remaining stock: ' || r.remaining_qty || ' units. Location: ' || COALESCE(r.location_name, 'Finished Goods Storage') || '. Expiry: ' || to_char(r.expiry_date, 'DD Mon YYYY') || '.';

        -- Create in-app notification
        IF v_admin_profile_id IS NOT NULL THEN
          INSERT INTO public.notifications (
            organization_id,
            recipient_user_id,
            title,
            message,
            type,
            channel,
            reference_type,
            reference_id,
            created_at
          ) VALUES (
            r.organization_id,
            v_admin_profile_id,
            v_title,
            v_msg,
            'expiry',
            'in_app',
            'batches',
            r.batch_id,
            now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id,
          batch_id,
          product_id,
          location_id,
          quantity,
          remaining_quantity,
          threshold_days,
          expiry_date,
          severity,
          status,
          alert_type,
          notification_id,
          generated_at,
          updated_at
        ) VALUES (
          r.organization_id,
          r.batch_id,
          r.product_id,
          r.location_id,
          r.remaining_qty,
          r.remaining_qty,
          -1,
          r.expiry_date,
          'expired',
          'active',
          'staff',
          v_notif_id,
          now(),
          now()
        ) ON CONFLICT DO NOTHING;

        v_staff_alerts_created := v_staff_alerts_created + 1;
      END IF;

      CONTINUE;
    END IF;

    -- 3. Load product-specific configured alert rule (fallback to 10 / 5 / 3)
    SELECT 
      COALESCE(er.alert_1_days, 10) AS alert_1,
      COALESCE(er.alert_2_days, 5) AS alert_2,
      COALESCE(er.alert_3_days, 3) AS alert_3,
      COALESCE(er.enabled, true) AS is_enabled
    INTO v_rule
    FROM (SELECT 1) _
    LEFT JOIN public.expiry_rules er ON er.product_id = r.product_id AND er.organization_id = r.organization_id
    LIMIT 1;

    IF v_rule.is_enabled = false THEN
      CONTINUE;
    END IF;

    -- Match configured threshold
    IF r.days_remaining = 0 THEN
      v_threshold := 0;
      v_severity := 'urgent';
    ELSIF r.days_remaining <= v_rule.alert_3 THEN
      v_threshold := v_rule.alert_3;
      v_severity := 'urgent';
    ELSIF r.days_remaining <= v_rule.alert_2 THEN
      v_threshold := v_rule.alert_2;
      v_severity := 'soon';
    ELSIF r.days_remaining <= v_rule.alert_1 THEN
      v_threshold := v_rule.alert_1;
      v_severity := 'upcoming';
    ELSE
      -- Days remaining is greater than highest threshold: no alert triggered
      CONTINUE;
    END IF;

    -- Check deduplication: Was an active alert already recorded for this threshold?
    SELECT id INTO v_existing_alert_id
    FROM public.expiry_alerts
    WHERE organization_id = r.organization_id
      AND batch_id = r.batch_id
      AND alert_type = 'staff'
      AND threshold_days = v_threshold
      AND status IN ('active', 'acknowledged')
    LIMIT 1;

    IF v_existing_alert_id IS NULL THEN
      IF v_threshold = 0 THEN
        v_title := '⚠ ' || r.product_name || ' batch ' || r.batch_number || ' is expiring TODAY';
      ELSE
        v_title := '⚠ ' || r.product_name || ' batch ' || r.batch_number || ' is expiring in ' || r.days_remaining || ' days';
      END IF;

      v_msg := 'Remaining stock: ' || r.remaining_qty || ' units. Location: ' || COALESCE(r.location_name, 'Finished Goods Storage') || '. Expiry: ' || to_char(r.expiry_date, 'DD Mon YYYY') || '.';

      IF v_admin_profile_id IS NOT NULL THEN
        INSERT INTO public.notifications (
          organization_id,
          recipient_user_id,
          title,
          message,
          type,
          channel,
          reference_type,
          reference_id,
          created_at
        ) VALUES (
          r.organization_id,
          v_admin_profile_id,
          v_title,
          v_msg,
          'expiry',
          'in_app',
          'batches',
          r.batch_id,
          now()
        ) RETURNING id INTO v_notif_id;
      END IF;

      INSERT INTO public.expiry_alerts (
        organization_id,
        batch_id,
        product_id,
        location_id,
        quantity,
        remaining_quantity,
        threshold_days,
        expiry_date,
        severity,
        status,
        alert_type,
        notification_id,
        generated_at,
        updated_at
      ) VALUES (
        r.organization_id,
        r.batch_id,
        r.product_id,
        r.location_id,
        r.remaining_qty,
        r.remaining_qty,
        v_threshold,
        r.expiry_date,
        v_severity,
        'active',
        'staff',
        v_notif_id,
        now(),
        now()
      ) ON CONFLICT DO NOTHING;

      v_staff_alerts_created := v_staff_alerts_created + 1;
    END IF;

  END LOOP;


  -- ===========================================================================
  -- PHASE 2: CUSTOMER DELIVERED BATCH EXPIRY EVALUATION
  -- Source of Truth: customer_product_batches (is_current = true) + Product Rules
  -- ===========================================================================
  FOR c_rec IN (
    SELECT 
      cpb.id AS cpb_id,
      cpb.organization_id,
      cpb.customer_id,
      cpb.product_id,
      cpb.batch_id,
      cpb.quantity_purchased,
      cpb.quantity_remaining,
      cpb.delivered_at,
      cpb.expiry_date,
      p.name AS product_name,
      b.batch_number,
      (cpb.expiry_date - CURRENT_DATE) AS days_remaining
    FROM public.customer_product_batches cpb
    JOIN public.products p ON p.id = cpb.product_id
    JOIN public.batches b ON b.id = cpb.batch_id
    WHERE cpb.is_current = true
      AND cpb.tracking_status = 'active'
  ) LOOP

    -- 1. If customer stock consumed / zero remaining
    IF c_rec.quantity_remaining <= 0 THEN
      UPDATE public.customer_product_batches
      SET tracking_status = 'completed', updated_at = now()
      WHERE id = c_rec.cpb_id;

      UPDATE public.expiry_alerts
      SET status = 'resolved', resolved_at = now(), updated_at = now()
      WHERE customer_product_batch_id = c_rec.cpb_id
        AND status IN ('active', 'acknowledged');

      v_customer_alerts_resolved := v_customer_alerts_resolved + 1;
      CONTINUE;
    END IF;

    -- Resolve primary auth user for customer notification
    SELECT auth_user_id INTO v_customer_user_id
    FROM public.customer_users
    WHERE customer_id = c_rec.customer_id AND is_active = true
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1;

    -- 2. If expired (days_remaining < 0)
    IF c_rec.days_remaining < 0 THEN
      UPDATE public.customer_product_batches
      SET tracking_status = 'expired', updated_at = now()
      WHERE id = c_rec.cpb_id;

      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE customer_id = c_rec.customer_id
        AND product_id = c_rec.product_id
        AND batch_id = c_rec.batch_id
        AND alert_type = 'customer'
        AND threshold_days = -1
        AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ Your ' || c_rec.product_name || ' has EXPIRED';
        v_msg := 'Delivered batch ' || c_rec.batch_number || ' expired on ' || to_char(c_rec.expiry_date, 'DD Mon YYYY') || '. Please discard or pull from shelf.';

        IF v_customer_user_id IS NOT NULL THEN
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
          ) VALUES (
            c_rec.organization_id,
            v_customer_user_id,
            c_rec.customer_id,
            v_title,
            v_msg,
            'expiry',
            'in_app',
            'customer_product_batches',
            c_rec.cpb_id,
            now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id,
          customer_id,
          product_id,
          batch_id,
          customer_product_batch_id,
          quantity,
          remaining_quantity,
          threshold_days,
          expiry_date,
          severity,
          status,
          alert_type,
          notification_id,
          generated_at,
          updated_at
        ) VALUES (
          c_rec.organization_id,
          c_rec.customer_id,
          c_rec.product_id,
          c_rec.batch_id,
          c_rec.cpb_id,
          c_rec.quantity_remaining,
          c_rec.quantity_remaining,
          -1,
          c_rec.expiry_date,
          'expired',
          'expired',
          'customer',
          v_notif_id,
          now(),
          now()
        ) ON CONFLICT DO NOTHING;

        v_customer_alerts_created := v_customer_alerts_created + 1;
      END IF;

      CONTINUE;
    END IF;

    -- 3. Load product expiry rule
    SELECT 
      COALESCE(er.alert_1_days, 10) AS alert_1,
      COALESCE(er.alert_2_days, 5) AS alert_2,
      COALESCE(er.alert_3_days, 3) AS alert_3,
      COALESCE(er.enabled, true) AS is_enabled
    INTO v_rule
    FROM (SELECT 1) _
    LEFT JOIN public.expiry_rules er ON er.product_id = c_rec.product_id AND er.organization_id = c_rec.organization_id
    LIMIT 1;

    IF v_rule.is_enabled = false THEN
      CONTINUE;
    END IF;

    -- Match threshold
    IF c_rec.days_remaining = 0 THEN
      v_threshold := 0;
      v_severity := 'urgent';
    ELSIF c_rec.days_remaining <= v_rule.alert_3 THEN
      v_threshold := v_rule.alert_3;
      v_severity := 'urgent';
    ELSIF c_rec.days_remaining <= v_rule.alert_2 THEN
      v_threshold := v_rule.alert_2;
      v_severity := 'soon';
    ELSIF c_rec.days_remaining <= v_rule.alert_1 THEN
      v_threshold := v_rule.alert_1;
      v_severity := 'upcoming';
    ELSE
      CONTINUE;
    END IF;

    -- Deduplication check
    SELECT id INTO v_existing_alert_id
    FROM public.expiry_alerts
    WHERE customer_id = c_rec.customer_id
      AND product_id = c_rec.product_id
      AND batch_id = c_rec.batch_id
      AND alert_type = 'customer'
      AND threshold_days = v_threshold
      AND status IN ('active', 'acknowledged')
    LIMIT 1;

    IF v_existing_alert_id IS NULL THEN
      IF v_threshold = 0 THEN
        v_title := '⚠ Your ' || c_rec.product_name || ' is expiring TODAY';
      ELSE
        v_title := '⚠ Your ' || c_rec.product_name || ' is expiring in ' || c_rec.days_remaining || ' days';
      END IF;

      v_msg := 'Expiry date: ' || to_char(c_rec.expiry_date, 'DD Mon YYYY') || '. Batch: ' || c_rec.batch_number || '.';

      IF v_customer_user_id IS NOT NULL THEN
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
        ) VALUES (
          c_rec.organization_id,
          v_customer_user_id,
          c_rec.customer_id,
          v_title,
          v_msg,
          'expiry',
          'in_app',
          'products',
          c_rec.product_id,
          now()
        ) RETURNING id INTO v_notif_id;
      END IF;

      INSERT INTO public.expiry_alerts (
        organization_id,
        customer_id,
        product_id,
        batch_id,
        customer_product_batch_id,
        quantity,
        remaining_quantity,
        threshold_days,
        expiry_date,
        severity,
        status,
        alert_type,
        notification_id,
        generated_at,
        updated_at
      ) VALUES (
        c_rec.organization_id,
        c_rec.customer_id,
        c_rec.product_id,
        c_rec.batch_id,
        c_rec.cpb_id,
        c_rec.quantity_remaining,
        c_rec.quantity_remaining,
        v_threshold,
        c_rec.expiry_date,
        v_severity,
        'active',
        'customer',
        v_notif_id,
        now(),
        now()
      ) ON CONFLICT DO NOTHING;

      v_customer_alerts_created := v_customer_alerts_created + 1;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'staff_alerts_created', v_staff_alerts_created,
    'staff_alerts_resolved', v_staff_alerts_resolved,
    'customer_alerts_created', v_customer_alerts_created,
    'customer_alerts_resolved', v_customer_alerts_resolved,
    'timestamp', now()
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 9. CRON SCHEDULE: DAILY EXPIRY RADAR EXECUTION
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- Schedule daily job if pg_cron is active
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('daily-expiry-radar');
    EXCEPTION WHEN OTHERS THEN
      -- ignore if not already scheduled
    END;

    PERFORM cron.schedule(
      'daily-expiry-radar',
      '0 1 * * *', -- Runs every morning at 01:00 UTC (06:30 IST)
      'SELECT public.evaluate_expiry_alerts();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if cron permission restricted
  NULL;
END $$;


-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.customer_product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiry_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiry_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- customer_product_batches RLS
DROP POLICY IF EXISTS "cpb_select" ON public.customer_product_batches;
CREATE POLICY "cpb_select" ON public.customer_product_batches
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
    OR
    (customer_id = (SELECT public.current_customer_id()))
  );

DROP POLICY IF EXISTS "cpb_internal_manage" ON public.customer_product_batches;
CREATE POLICY "cpb_internal_manage" ON public.customer_product_batches
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id())
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id())
  );

-- expiry_rules RLS
DROP POLICY IF EXISTS "expiry_rules_select" ON public.expiry_rules;
CREATE POLICY "expiry_rules_select" ON public.expiry_rules
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "expiry_rules_manage" ON public.expiry_rules;
CREATE POLICY "expiry_rules_manage" ON public.expiry_rules
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal' AND (
      organization_id = (SELECT public.current_user_org_id()) OR
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' AND (
      organization_id = (SELECT public.current_user_org_id()) OR
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- expiry_alerts RLS
DROP POLICY IF EXISTS "expiry_alerts_select" ON public.expiry_alerts;
CREATE POLICY "expiry_alerts_select" ON public.expiry_alerts
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
    OR
    (alert_type = 'customer' AND customer_id = (SELECT public.current_customer_id()))
  );

DROP POLICY IF EXISTS "expiry_alerts_manage_internal" ON public.expiry_alerts;
CREATE POLICY "expiry_alerts_manage_internal" ON public.expiry_alerts
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

-- notifications RLS
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
    OR
    (recipient_user_id = (SELECT auth.uid()))
    OR
    (customer_id IS NOT NULL AND customer_id = (SELECT public.current_customer_id()))
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
    OR
    (recipient_user_id = (SELECT auth.uid()))
    OR
    (customer_id IS NOT NULL AND customer_id = (SELECT public.current_customer_id()))
  )
  WITH CHECK (
    ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
    OR
    (recipient_user_id = (SELECT auth.uid()))
    OR
    (customer_id IS NOT NULL AND customer_id = (SELECT public.current_customer_id()))
  );

DROP POLICY IF EXISTS "notifications_insert_internal" ON public.notifications;
CREATE POLICY "notifications_insert_internal" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal'
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_product_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expiry_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expiry_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
