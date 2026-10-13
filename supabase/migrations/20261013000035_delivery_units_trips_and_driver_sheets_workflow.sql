-- =============================================================================
-- Migration 035: Delivery Unit Management, Driver Sheets & Invoice Workflow
-- Module: Delivery Units, Delivery Trips, Trip-Invoice Association,
--         Atomic Order-to-Invoice Generation and Trip Completion
-- =============================================================================

-- 1. DELIVERY UNITS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chalan_number text NOT NULL,
  name text NOT NULL,
  vehicle_number text NOT NULL,
  driver_name text NOT NULL,
  driver_phone text,
  out_time text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_delivery_units_org_chalan UNIQUE (organization_id, chalan_number)
);

CREATE TRIGGER trg_delivery_units_updated_at
  BEFORE UPDATE ON public.delivery_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Automatic Chalan Number Generation & Preservation Trigger for Delivery Units
CREATE OR REPLACE FUNCTION public.trg_delivery_unit_chalan_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.chalan_number IS NULL OR trim(NEW.chalan_number) = '' THEN
      NEW.chalan_number := public.next_document_number(NEW.organization_id, 'chalan', 'CHLN', 4);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Strictly preserve original generated chalan number against manual overwrite
    NEW.chalan_number := OLD.chalan_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_unit_chalan ON public.delivery_units;
CREATE TRIGGER trg_delivery_unit_chalan
  BEFORE INSERT OR UPDATE ON public.delivery_units
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_delivery_unit_chalan_sequence();


-- 2. DELIVERY TRIPS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trip_number text NOT NULL,
  delivery_unit_id uuid NOT NULL REFERENCES public.delivery_units(id) ON DELETE RESTRICT,
  vehicle_number text NOT NULL,
  driver_name text NOT NULL,
  driver_phone text,
  status text NOT NULL DEFAULT 'dispatched' CHECK (status IN ('assigned', 'dispatched', 'completed', 'cancelled')),
  out_time timestamptz DEFAULT now(),
  assigned_at timestamptz DEFAULT now() NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_delivery_trips_org_number UNIQUE (organization_id, trip_number)
);

CREATE TRIGGER trg_delivery_trips_updated_at
  BEFORE UPDATE ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Automatic Trip/Chalan Number Trigger for Delivery Trips
CREATE OR REPLACE FUNCTION public.trg_delivery_trip_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.trip_number IS NULL OR trim(NEW.trip_number) = '' THEN
      NEW.trip_number := public.next_document_number(NEW.organization_id, 'delivery_trip', 'TRIP', 4);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Strictly preserve original trip number
    NEW.trip_number := OLD.trip_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_trip_number ON public.delivery_trips;
CREATE TRIGGER trg_delivery_trip_number
  BEFORE INSERT OR UPDATE ON public.delivery_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_delivery_trip_sequence();


-- 3. TRIP-TO-INVOICE ASSOCIATION & INVOICES SCHEMA EXTENSION
-- Add delivery_trip_id directly on invoices for fast indexing and direct lookup
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_trip_id uuid REFERENCES public.delivery_trips(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.delivery_trip_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.delivery_trips(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  assigned_at timestamptz DEFAULT now() NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_trip_invoices_invoice UNIQUE (invoice_id),
  CONSTRAINT uq_trip_invoices_pair UNIQUE (trip_id, invoice_id)
);

-- 4. UPDATE INVOICE STATUS CONSTRAINT TO INCLUDE 'dispatched'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('ready', 'dispatched', 'delivered', 'open_payment', 'settled', 'cancelled'));

-- Indexes for Delivery Units, Trips, and Invoices
CREATE INDEX IF NOT EXISTS idx_delivery_units_org ON public.delivery_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_units_active ON public.delivery_units(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_units_vehicle ON public.delivery_units(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_delivery_units_driver ON public.delivery_units(driver_name);

CREATE INDEX IF NOT EXISTS idx_delivery_trips_org ON public.delivery_trips(organization_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_unit ON public.delivery_trips(delivery_unit_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_status ON public.delivery_trips(status);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_created_at ON public.delivery_trips(created_at);

CREATE INDEX IF NOT EXISTS idx_trip_invoices_trip ON public.delivery_trip_invoices(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invoices_invoice ON public.delivery_trip_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_trip_id ON public.invoices(delivery_trip_id);


-- 5. ATOMIC RPC: GENERATE INVOICE FOR CONFIRMED ORDER
-- Workflow Step 2.1: Order Confirmed -> Generate Invoice (Creates Invoice in 'ready' status)
CREATE OR REPLACE FUNCTION public.generate_invoice_for_order(
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
  v_existing_inv record;
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

  -- 2. Validate order status: Must be 'confirmed'
  IF v_order.status = 'pending' THEN
    RAISE EXCEPTION 'Order % must be confirmed by staff before generating an invoice.', v_order.order_number;
  ELSIF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot generate invoice for cancelled order %.', v_order.order_number;
  END IF;

  -- 3. Idempotency safeguard: If an invoice already exists for this order, return existing invoice
  SELECT id, invoice_number, status INTO v_existing_inv
  FROM public.invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'invoice_id', v_existing_inv.id,
      'invoice_number', v_existing_inv.invoice_number,
      'status', v_existing_inv.status,
      'already_generated', true,
      'message', 'Invoice already exists for this order'
    );
  END IF;

  v_org_id := v_order.organization_id;

  -- Validate user id against profiles
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
      v_effective_user_id := p_user_id;
    END IF;
  END IF;

  -- 4. Generate sequential atomic invoice number
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

  -- 5. Create invoice header with status 'ready'
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

  -- 7. Post double-entry customer ledger debit
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

  -- 8. Note: Order status remains 'confirmed' (does NOT transition to dispatched merely because invoice was generated)
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


-- Bulk Generate Invoices RPC
CREATE OR REPLACE FUNCTION public.bulk_generate_invoices(
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
  v_generated_count int := 0;
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
        v_res := public.generate_invoice_for_order(v_id, p_user_id);
        IF (v_res->>'success')::boolean THEN
          v_generated_count := v_generated_count + 1;
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
    'generated_count', v_generated_count,
    'skipped_count', v_skipped_count,
    'failed_count', v_failed_count,
    'invoices', v_invoices
  );
END;
$function$;


-- 6. ATOMIC RPC: ASSIGN DELIVERY TRIP (Module 3.4)
-- Associates selected 'ready' invoices to a delivery trip, sets invoices & orders to 'dispatched'
CREATE OR REPLACE FUNCTION public.assign_delivery_trip(
  p_delivery_unit_id uuid,
  p_invoice_ids uuid[],
  p_out_time timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit record;
  v_trip_id uuid;
  v_trip_number text;
  v_org_id uuid;
  v_inv record;
  v_inv_id uuid;
  v_effective_user_id uuid := NULL;
  v_assigned_count int := 0;
BEGIN
  IF p_invoice_ids IS NULL OR array_length(p_invoice_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one invoice must be selected for trip assignment.';
  END IF;

  -- 1. Validate delivery unit
  SELECT * INTO v_unit
  FROM public.delivery_units
  WHERE id = p_delivery_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery unit not found';
  END IF;

  IF NOT v_unit.is_active THEN
    RAISE EXCEPTION 'Delivery unit % is deactivated and cannot accept new trip assignments.', v_unit.name;
  END IF;

  v_org_id := v_unit.organization_id;

  -- Validate user id
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
      v_effective_user_id := p_user_id;
    END IF;
  END IF;

  -- 2. Validate all selected invoices: must be 'ready' and not in an active trip
  FOREACH v_inv_id IN ARRAY p_invoice_ids
  LOOP
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE id = v_inv_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice % not found', v_inv_id;
    END IF;

    IF v_inv.status != 'ready' THEN
      RAISE EXCEPTION 'Invoice % cannot be assigned because its status is % (only Ready invoices are eligible).',
        v_inv.invoice_number, v_inv.status;
    END IF;

    -- Check if already assigned to a trip
    IF EXISTS (
      SELECT 1 FROM public.delivery_trip_invoices ti
      JOIN public.delivery_trips dt ON dt.id = ti.trip_id
      WHERE ti.invoice_id = v_inv_id AND dt.status != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Invoice % is already assigned to an active delivery trip.', v_inv.invoice_number;
    END IF;
  END LOOP;

  -- 3. Generate unique trip number
  BEGIN
    v_trip_number := public.next_document_number(
      v_org_id,
      'delivery_trip',
      'TRIP',
      4
    );
  EXCEPTION WHEN OTHERS THEN
    v_trip_number := NULL;
  END;

  IF v_trip_number IS NULL OR v_trip_number = '' THEN
    v_trip_number := 'TRIP-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');
  END IF;

  -- 4. Create persistent delivery trip (snapshotting vehicle & driver details)
  INSERT INTO public.delivery_trips (
    organization_id,
    trip_number,
    delivery_unit_id,
    vehicle_number,
    driver_name,
    driver_phone,
    status,
    out_time,
    assigned_at,
    assigned_by,
    notes
  ) VALUES (
    v_org_id,
    v_trip_number,
    v_unit.id,
    v_unit.vehicle_number,
    v_unit.driver_name,
    v_unit.driver_phone,
    'dispatched',
    COALESCE(p_out_time, now()),
    now(),
    v_effective_user_id,
    p_notes
  )
  RETURNING id INTO v_trip_id;

  -- 5. Associate each invoice with trip & set invoice status to 'dispatched'
  FOREACH v_inv_id IN ARRAY p_invoice_ids
  LOOP
    INSERT INTO public.delivery_trip_invoices (
      trip_id,
      invoice_id,
      assigned_at,
      assigned_by
    ) VALUES (
      v_trip_id,
      v_inv_id,
      now(),
      v_effective_user_id
    );

    UPDATE public.invoices
    SET status = 'dispatched',
        delivery_trip_id = v_trip_id,
        updated_at = now()
    WHERE id = v_inv_id;

    -- Update linked order if present
    UPDATE public.orders o
    SET status = 'dispatched',
        dispatched_at = COALESCE(o.dispatched_at, now()),
        dispatched_by = COALESCE(o.dispatched_by, v_effective_user_id),
        updated_at = now()
    FROM public.invoices inv
    WHERE inv.id = v_inv_id
      AND o.id = inv.order_id
      AND o.status != 'dispatched';

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', v_trip_id,
    'trip_number', v_trip_number,
    'delivery_unit_id', v_unit.id,
    'delivery_unit_name', v_unit.name,
    'vehicle_number', v_unit.vehicle_number,
    'driver_name', v_unit.driver_name,
    'assigned_count', v_assigned_count,
    'status', 'dispatched'
  );
END;
$function$;


-- 7. ATOMIC RPC: COMPLETE DELIVERY TRIP (Module 4.3)
-- Marks trip completed, transitions assigned invoices to 'delivered'
CREATE OR REPLACE FUNCTION public.complete_delivery_trip(
  p_trip_id uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trip record;
  v_effective_user_id uuid := NULL;
  v_inv_rec record;
  v_delivered_count int := 0;
BEGIN
  -- 1. Validate and lock trip
  SELECT * INTO v_trip
  FROM public.delivery_trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery trip not found';
  END IF;

  -- Idempotency safeguard
  IF v_trip.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'trip_id', p_trip_id,
      'trip_number', v_trip.trip_number,
      'status', 'completed',
      'already_completed', true,
      'message', 'Trip is already marked completed'
    );
  END IF;

  IF v_trip.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot complete a cancelled trip %.', v_trip.trip_number;
  END IF;

  -- Validate user id
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
      v_effective_user_id := p_user_id;
    END IF;
  END IF;

  -- 2. Mark trip completed
  UPDATE public.delivery_trips
  SET status = 'completed',
      completed_at = now(),
      completed_by = v_effective_user_id,
      updated_at = now()
  WHERE id = p_trip_id;

  -- 3. Mark all assigned invoices from 'dispatched' to 'delivered'
  FOR v_inv_rec IN (
    SELECT inv.id, inv.order_id, inv.status
    FROM public.delivery_trip_invoices ti
    JOIN public.invoices inv ON inv.id = ti.invoice_id
    WHERE ti.trip_id = p_trip_id
  ) LOOP
    IF v_inv_rec.status = 'dispatched' THEN
      UPDATE public.invoices
      SET status = 'delivered',
          delivered_at = now(),
          delivered_by = v_effective_user_id,
          updated_at = now()
      WHERE id = v_inv_rec.id;

      v_delivered_count := v_delivered_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', p_trip_id,
    'trip_number', v_trip.trip_number,
    'status', 'completed',
    'delivered_invoices_count', v_delivered_count
  );
END;
$function$;


-- 8. PERMISSIONS SEED FOR DELIVERY MODULE
DO $$
DECLARE
  v_actions text[] := ARRAY['view', 'create', 'edit', 'delete'];
  a text;
  v_admin_role_id uuid;
  v_prod_role_id uuid;
  v_wh_role_id uuid;
  v_acc_role_id uuid;
  v_perm RECORD;
BEGIN
  -- Insert delivery module permissions
  FOREACH a IN ARRAY v_actions LOOP
    INSERT INTO public.permissions (module, action, description)
    VALUES ('delivery', a, upper(a) || ' access for delivery units and driver management')
    ON CONFLICT (module, action) DO NOTHING;
  END LOOP;

  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO v_prod_role_id FROM public.roles WHERE name = 'production_manager' LIMIT 1;
  SELECT id INTO v_wh_role_id FROM public.roles WHERE name = 'warehouse_manager' LIMIT 1;
  SELECT id INTO v_acc_role_id FROM public.roles WHERE name = 'accountant' LIMIT 1;

  -- Admin gets all delivery permissions
  IF v_admin_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM public.permissions WHERE module = 'delivery' LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_admin_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Warehouse Manager gets view, create, edit
  IF v_wh_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM public.permissions WHERE module = 'delivery' AND action IN ('view', 'create', 'edit') LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_wh_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Accountant gets view, create
  IF v_acc_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM public.permissions WHERE module = 'delivery' AND action IN ('view', 'create') LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_acc_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;


-- 9. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.delivery_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trip_invoices ENABLE ROW LEVEL SECURITY;

-- delivery_units RLS
CREATE POLICY "delivery_units_select" ON public.delivery_units
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

CREATE POLICY "delivery_units_manage" ON public.delivery_units
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

-- delivery_trips RLS
CREATE POLICY "delivery_trips_select" ON public.delivery_trips
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

CREATE POLICY "delivery_trips_manage" ON public.delivery_trips
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

-- delivery_trip_invoices RLS
CREATE POLICY "delivery_trip_invoices_select" ON public.delivery_trip_invoices
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  trip_id IN (
    SELECT dt.id FROM public.delivery_trips dt
    WHERE dt.organization_id = (SELECT public.current_user_org_id())
  )
);

CREATE POLICY "delivery_trip_invoices_manage" ON public.delivery_trip_invoices
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  trip_id IN (
    SELECT dt.id FROM public.delivery_trips dt
    WHERE dt.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  trip_id IN (
    SELECT dt.id FROM public.delivery_trips dt
    WHERE dt.organization_id = (SELECT public.current_user_org_id())
  )
);

-- Grants
GRANT EXECUTE ON FUNCTION public.generate_invoice_for_order(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_generate_invoices(uuid[], uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.assign_delivery_trip(uuid, uuid[], timestamptz, text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.complete_delivery_trip(uuid, uuid) TO authenticated, anon;
