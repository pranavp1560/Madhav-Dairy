-- =============================================================================
-- Migration 036: Vendor & Farmer Advance Tracking and Adjustments Workflow
-- Module: Vendor/Farmer Advances, Bills, Adjustments, Balance Calculation,
--         and Over-Adjustment Prevention RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VENDOR ADVANCES TABLE
-- Tracks advance payments disbursed to suppliers, farmers, and milk societies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  advance_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  advance_date date DEFAULT CURRENT_DATE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  adjusted_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (adjusted_amount >= 0),
  balance_amount numeric(12,2) NOT NULL CHECK (balance_amount >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  reference_number text,
  notes text,
  status text DEFAULT 'available' NOT NULL CHECK (status IN ('available', 'partially_adjusted', 'fully_adjusted')),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_vendor_advances_org_num UNIQUE (organization_id, advance_number),
  CONSTRAINT chk_vendor_adv_adjusted CHECK (adjusted_amount <= amount),
  CONSTRAINT chk_vendor_adv_balance CHECK (balance_amount = amount - adjusted_amount)
);

CREATE TRIGGER trg_vendor_advances_updated_at
  BEFORE UPDATE ON public.vendor_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and query filtering
CREATE INDEX IF NOT EXISTS idx_v_adv_org_id ON public.vendor_advances(organization_id);
CREATE INDEX IF NOT EXISTS idx_v_adv_supplier_id ON public.vendor_advances(supplier_id);
CREATE INDEX IF NOT EXISTS idx_v_adv_date ON public.vendor_advances(advance_date DESC);
CREATE INDEX IF NOT EXISTS idx_v_adv_status ON public.vendor_advances(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v_adv_method ON public.vendor_advances(payment_method);
CREATE INDEX IF NOT EXISTS idx_v_adv_vendor_name ON public.vendor_advances(lower(trim(vendor_name)));


-- -----------------------------------------------------------------------------
-- 2. VENDOR BILLS TABLE
-- Tracks procurement bills, raw material invoices, and farmer society milk bills
-- against which advances can be adjusted
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bill_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  bill_date date DEFAULT CURRENT_DATE NOT NULL,
  due_date date,
  category text NOT NULL DEFAULT 'Raw Milk Procurement',
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  adjusted_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (adjusted_amount >= 0),
  paid_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (paid_amount >= 0),
  balance_amount numeric(12,2) NOT NULL CHECK (balance_amount >= 0),
  status text DEFAULT 'unpaid' NOT NULL CHECK (status IN ('unpaid', 'partially_adjusted', 'settled', 'cancelled')),
  notes text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_vendor_bills_org_num UNIQUE (organization_id, bill_number),
  CONSTRAINT chk_vendor_bills_deductions CHECK (adjusted_amount + paid_amount <= total_amount),
  CONSTRAINT chk_vendor_bills_balance CHECK (balance_amount = total_amount - (adjusted_amount + paid_amount))
);

CREATE TRIGGER trg_vendor_bills_updated_at
  BEFORE UPDATE ON public.vendor_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for vendor bills
CREATE INDEX IF NOT EXISTS idx_v_bill_org_id ON public.vendor_bills(organization_id);
CREATE INDEX IF NOT EXISTS idx_v_bill_supplier_id ON public.vendor_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_v_bill_date ON public.vendor_bills(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_v_bill_status ON public.vendor_bills(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v_bill_vendor_name ON public.vendor_bills(lower(trim(vendor_name)));


-- -----------------------------------------------------------------------------
-- 3. VENDOR ADVANCE ADJUSTMENTS TABLE
-- Authoritative audit trail recording which advance was adjusted against which bill
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_advance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  adjustment_number text NOT NULL,
  advance_id uuid NOT NULL REFERENCES public.vendor_advances(id) ON DELETE RESTRICT,
  bill_id uuid NOT NULL REFERENCES public.vendor_bills(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  bill_number text NOT NULL,
  advance_number text NOT NULL,
  adjustment_date date DEFAULT CURRENT_DATE NOT NULL,
  adjusted_amount numeric(12,2) NOT NULL CHECK (adjusted_amount > 0),
  notes text,
  adjusted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_vendor_adj_org_num UNIQUE (organization_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_v_adj_org_id ON public.vendor_advance_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_v_adj_advance_id ON public.vendor_advance_adjustments(advance_id);
CREATE INDEX IF NOT EXISTS idx_v_adj_bill_id ON public.vendor_advance_adjustments(bill_id);
CREATE INDEX IF NOT EXISTS idx_v_adj_supplier_id ON public.vendor_advance_adjustments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_v_adj_date ON public.vendor_advance_adjustments(adjustment_date DESC);


-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation restricted to authenticated internal users
-- -----------------------------------------------------------------------------
ALTER TABLE public.vendor_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_advance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_advances_internal" ON public.vendor_advances;
CREATE POLICY "vendor_advances_internal" ON public.vendor_advances
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

DROP POLICY IF EXISTS "vendor_bills_internal" ON public.vendor_bills;
CREATE POLICY "vendor_bills_internal" ON public.vendor_bills
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

DROP POLICY IF EXISTS "vendor_adjustments_internal" ON public.vendor_advance_adjustments;
CREATE POLICY "vendor_adjustments_internal" ON public.vendor_advance_adjustments
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

-- Explicit grants for PostgREST Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_advances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_advance_adjustments TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. ATOMIC RPC: RECORD VENDOR ADVANCE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_vendor_advance(
  p_supplier_id uuid,
  p_vendor_name text,
  p_amount numeric,
  p_payment_method text,
  p_advance_date date DEFAULT CURRENT_DATE,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_adv_num text;
  v_supplier record;
  v_vendor_name text;
  v_advance_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  -- Resolve organization ID
  v_org_id := public.current_user_org_id();

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Advance amount must be strictly greater than zero';
  END IF;

  -- Resolve vendor name from supplier if UUID provided
  v_vendor_name := trim(p_vendor_name);
  IF p_supplier_id IS NOT NULL THEN
    SELECT id, name INTO v_supplier FROM public.suppliers WHERE id = p_supplier_id;
    IF FOUND THEN
      v_vendor_name := v_supplier.name;
    END IF;
  END IF;

  IF v_vendor_name IS NULL OR v_vendor_name = '' THEN
    RAISE EXCEPTION 'Vendor/Farmer name cannot be blank';
  END IF;

  -- Generate atomic advance number
  v_adv_num := public.next_document_number(v_org_id, 'vendor_advance', 'ADV', 4);

  INSERT INTO public.vendor_advances (
    organization_id,
    advance_number,
    supplier_id,
    vendor_name,
    advance_date,
    amount,
    adjusted_amount,
    balance_amount,
    payment_method,
    reference_number,
    notes,
    status,
    recorded_by
  ) VALUES (
    v_org_id,
    v_adv_num,
    p_supplier_id,
    v_vendor_name,
    COALESCE(p_advance_date, CURRENT_DATE),
    p_amount,
    0.00,
    p_amount,
    COALESCE(p_payment_method, 'bank_transfer'),
    p_reference_number,
    p_notes,
    'available',
    v_user_id
  )
  RETURNING id INTO v_advance_id;

  RETURN jsonb_build_object(
    'success', true,
    'advance_id', v_advance_id,
    'advance_number', v_adv_num,
    'amount', p_amount,
    'balance_amount', p_amount,
    'vendor_name', v_vendor_name
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. ATOMIC RPC: CREATE VENDOR BILL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_vendor_bill(
  p_supplier_id uuid,
  p_vendor_name text,
  p_bill_number text DEFAULT NULL,
  p_bill_date date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL,
  p_category text DEFAULT 'Raw Milk Procurement',
  p_total_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_bill_num text;
  v_supplier record;
  v_vendor_name text;
  v_bill_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  v_org_id := public.current_user_org_id();

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Bill amount must be strictly greater than zero';
  END IF;

  v_vendor_name := trim(p_vendor_name);
  IF p_supplier_id IS NOT NULL THEN
    SELECT id, name INTO v_supplier FROM public.suppliers WHERE id = p_supplier_id;
    IF FOUND THEN
      v_vendor_name := v_supplier.name;
    END IF;
  END IF;

  IF v_vendor_name IS NULL OR v_vendor_name = '' THEN
    RAISE EXCEPTION 'Vendor/Farmer name cannot be blank';
  END IF;

  -- Generate bill number if not provided
  IF p_bill_number IS NOT NULL AND trim(p_bill_number) != '' THEN
    v_bill_num := trim(p_bill_number);
  ELSE
    v_bill_num := public.next_document_number(v_org_id, 'vendor_bill', 'BILL', 4);
  END IF;

  INSERT INTO public.vendor_bills (
    organization_id,
    bill_number,
    supplier_id,
    vendor_name,
    bill_date,
    due_date,
    category,
    total_amount,
    adjusted_amount,
    paid_amount,
    balance_amount,
    status,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    v_bill_num,
    p_supplier_id,
    v_vendor_name,
    COALESCE(p_bill_date, CURRENT_DATE),
    p_due_date,
    COALESCE(p_category, 'Raw Milk Procurement'),
    p_total_amount,
    0.00,
    0.00,
    p_total_amount,
    'unpaid',
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_bill_id;

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'bill_number', v_bill_num,
    'total_amount', p_total_amount,
    'balance_amount', p_total_amount,
    'vendor_name', v_vendor_name
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. ATOMIC RPC: ADJUST ADVANCE AGAINST BILL WITH OVER-ADJUSTMENT GUARD
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_vendor_advance_against_bill(
  p_advance_id uuid,
  p_bill_id uuid,
  p_adjustment_amount numeric,
  p_adjustment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adv record;
  v_bill record;
  v_new_adv_adjusted numeric(12,2);
  v_new_adv_balance numeric(12,2);
  v_new_adv_status text;
  v_new_bill_adjusted numeric(12,2);
  v_new_bill_balance numeric(12,2);
  v_new_bill_status text;
  v_adj_number text;
  v_adj_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF p_adjustment_amount IS NULL OR p_adjustment_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be strictly greater than zero';
  END IF;

  -- 1. Lock advance row with row-level locking to prevent concurrency race conditions
  SELECT * INTO v_adv 
  FROM public.vendor_advances 
  WHERE id = p_advance_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance record not found (ID: %)', p_advance_id;
  END IF;

  -- 2. Lock bill row with row-level locking
  SELECT * INTO v_bill 
  FROM public.vendor_bills 
  WHERE id = p_bill_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill record not found (ID: %)', p_bill_id;
  END IF;

  -- 3. Validate organization consistency
  IF v_adv.organization_id != v_bill.organization_id THEN
    RAISE EXCEPTION 'Tenant organization mismatch between advance and bill';
  END IF;

  -- 4. Over-adjustment validation: Advance available balance check
  IF p_adjustment_amount > v_adv.balance_amount THEN
    RAISE EXCEPTION 'Adjustment amount (₹%) exceeds available advance balance (₹%) for advance %', 
      p_adjustment_amount, v_adv.balance_amount, v_adv.advance_number;
  END IF;

  -- 5. Over-adjustment validation: Bill remaining payable balance check
  IF p_adjustment_amount > v_bill.balance_amount THEN
    RAISE EXCEPTION 'Adjustment amount (₹%) exceeds remaining payable balance (₹%) for bill %', 
      p_adjustment_amount, v_bill.balance_amount, v_bill.bill_number;
  END IF;

  -- 6. Calculate new advance state
  v_new_adv_adjusted := v_adv.adjusted_amount + p_adjustment_amount;
  v_new_adv_balance := v_adv.amount - v_new_adv_adjusted;
  v_new_adv_status := CASE 
    WHEN v_new_adv_balance = 0 THEN 'fully_adjusted' 
    ELSE 'partially_adjusted' 
  END;

  UPDATE public.vendor_advances
  SET adjusted_amount = v_new_adv_adjusted,
      balance_amount = v_new_adv_balance,
      status = v_new_adv_status,
      updated_at = now()
  WHERE id = v_adv.id;

  -- 7. Calculate new bill state
  v_new_bill_adjusted := v_bill.adjusted_amount + p_adjustment_amount;
  v_new_bill_balance := v_bill.total_amount - (v_new_bill_adjusted + v_bill.paid_amount);
  v_new_bill_status := CASE 
    WHEN v_new_bill_balance = 0 THEN 'settled' 
    ELSE 'partially_adjusted' 
  END;

  UPDATE public.vendor_bills
  SET adjusted_amount = v_new_bill_adjusted,
      balance_amount = v_new_bill_balance,
      status = v_new_bill_status,
      updated_at = now()
  WHERE id = v_bill.id;

  -- 8. Generate sequence number & log adjustment record
  v_adj_number := public.next_document_number(v_adv.organization_id, 'vendor_advance_adjustment', 'ADJ', 4);

  INSERT INTO public.vendor_advance_adjustments (
    organization_id,
    adjustment_number,
    advance_id,
    bill_id,
    supplier_id,
    vendor_name,
    bill_number,
    advance_number,
    adjustment_date,
    adjusted_amount,
    notes,
    adjusted_by
  ) VALUES (
    v_adv.organization_id,
    v_adj_number,
    v_adv.id,
    v_bill.id,
    COALESCE(v_bill.supplier_id, v_adv.supplier_id),
    COALESCE(v_bill.vendor_name, v_adv.vendor_name),
    v_bill.bill_number,
    v_adv.advance_number,
    COALESCE(p_adjustment_date, CURRENT_DATE),
    p_adjustment_amount,
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_adj_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adj_id,
    'adjustment_number', v_adj_number,
    'advance_id', v_adv.id,
    'advance_number', v_adv.advance_number,
    'bill_id', v_bill.id,
    'bill_number', v_bill.bill_number,
    'adjusted_amount', p_adjustment_amount,
    'new_advance_balance', v_new_adv_balance,
    'new_bill_balance', v_new_bill_balance,
    'advance_status', v_new_adv_status,
    'bill_status', v_new_bill_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_vendor_advance TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendor_bill TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_vendor_advance_against_bill TO authenticated;


-- -----------------------------------------------------------------------------
-- 8. SEED INITIAL REALISTIC ADVANCE & BILL DATA
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_sup1 uuid := '50000000-0000-0000-0000-000000000001'; -- Sangamner Farmer Society
  v_sup2 uuid := '50000000-0000-0000-0000-000000000002'; -- Shirwal Milk Union
  v_sup5 uuid := '50000000-0000-0000-0000-000000000005'; -- Polyflex Packaging Pune
  v_adv1_id uuid;
  v_adv2_id uuid;
  v_adv3_id uuid;
  v_bill1_id uuid;
  v_bill2_id uuid;
  v_bill3_id uuid;
BEGIN
  -- Insert Bills
  INSERT INTO public.vendor_bills (
    organization_id, bill_number, supplier_id, vendor_name, bill_date, due_date,
    category, total_amount, adjusted_amount, paid_amount, balance_amount, status, notes
  ) VALUES (
    v_org_id, 'BILL-2026-001', v_sup1, 'Sangamner Farmer Society', '2026-09-10', '2026-09-25',
    'Raw Milk Procurement', 45000.00, 15000.00, 0.00, 30000.00, 'partially_adjusted', 'Milk collection batch procurement week 36'
  ) ON CONFLICT (organization_id, bill_number) DO NOTHING
  RETURNING id INTO v_bill1_id;

  INSERT INTO public.vendor_bills (
    organization_id, bill_number, supplier_id, vendor_name, bill_date, due_date,
    category, total_amount, adjusted_amount, paid_amount, balance_amount, status, notes
  ) VALUES (
    v_org_id, 'BILL-2026-002', v_sup2, 'Shirwal Milk Union', '2026-09-12', '2026-09-27',
    'Raw Milk Procurement', 38000.00, 0.00, 0.00, 38000.00, 'unpaid', 'Buffalo milk procurement tanker 4421'
  ) ON CONFLICT (organization_id, bill_number) DO NOTHING
  RETURNING id INTO v_bill2_id;

  INSERT INTO public.vendor_bills (
    organization_id, bill_number, supplier_id, vendor_name, bill_date, due_date,
    category, total_amount, adjusted_amount, paid_amount, balance_amount, status, notes
  ) VALUES (
    v_org_id, 'BILL-2026-003', v_sup5, 'Polyflex Packaging Pune', '2026-09-14', '2026-09-29',
    'Packaging Material', 18500.00, 0.00, 0.00, 18500.00, 'unpaid', 'Printed 500ml milk pouches (10,000 units)'
  ) ON CONFLICT (organization_id, bill_number) DO NOTHING
  RETURNING id INTO v_bill3_id;

  -- Insert Advances
  INSERT INTO public.vendor_advances (
    organization_id, advance_number, supplier_id, vendor_name, advance_date,
    amount, adjusted_amount, balance_amount, payment_method, reference_number, notes, status
  ) VALUES (
    v_org_id, 'ADV-2026-0001', v_sup1, 'Sangamner Farmer Society', '2026-09-02',
    25000.00, 15000.00, 10000.00, 'bank_transfer', 'NEFT-FARMER-991', 'Pre-procurement farmer advance payment', 'partially_adjusted'
  ) ON CONFLICT (organization_id, advance_number) DO NOTHING
  RETURNING id INTO v_adv1_id;

  INSERT INTO public.vendor_advances (
    organization_id, advance_number, supplier_id, vendor_name, advance_date,
    amount, adjusted_amount, balance_amount, payment_method, reference_number, notes, status
  ) VALUES (
    v_org_id, 'ADV-2026-0002', v_sup2, 'Shirwal Milk Union', '2026-09-08',
    20000.00, 0.00, 20000.00, 'upi', 'UPI/22984102941', 'Morning collection advance payment', 'available'
  ) ON CONFLICT (organization_id, advance_number) DO NOTHING
  RETURNING id INTO v_adv2_id;

  INSERT INTO public.vendor_advances (
    organization_id, advance_number, supplier_id, vendor_name, advance_date,
    amount, adjusted_amount, balance_amount, payment_method, reference_number, notes, status
  ) VALUES (
    v_org_id, 'ADV-2026-0003', v_sup5, 'Polyflex Packaging Pune', '2026-09-05',
    12000.00, 0.00, 12000.00, 'cheque', 'CHQ-778102', 'Packaging raw material advance deposit', 'available'
  ) ON CONFLICT (organization_id, advance_number) DO NOTHING
  RETURNING id INTO v_adv3_id;

  -- If adv1 and bill1 IDs were just created, log adjustment
  IF v_adv1_id IS NOT NULL AND v_bill1_id IS NOT NULL THEN
    INSERT INTO public.vendor_advance_adjustments (
      organization_id, adjustment_number, advance_id, bill_id,
      supplier_id, vendor_name, bill_number, advance_number,
      adjustment_date, adjusted_amount, notes
    ) VALUES (
      v_org_id, 'ADJ-2026-0001', v_adv1_id, v_bill1_id,
      v_sup1, 'Sangamner Farmer Society', 'BILL-2026-001', 'ADV-2026-0001',
      '2026-09-11', 15000.00, 'Adjusted against milk collection bill BILL-2026-001'
    ) ON CONFLICT (organization_id, adjustment_number) DO NOTHING;
  END IF;

END $$;
