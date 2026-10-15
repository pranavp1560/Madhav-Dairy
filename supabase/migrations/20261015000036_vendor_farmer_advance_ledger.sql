-- Vendor/farmer advances and immutable bill-adjustment history.
-- Advances are liabilities/prepayments, not operating expenses. Applying an advance
-- never changes the original expense amount or creates a second expense/payment.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  advance_number text NOT NULL,
  vendor_name text NOT NULL CHECK (length(trim(vendor_name)) > 0),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  reference_number text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vendor_advances_org_number UNIQUE (organization_id, advance_number)
);

CREATE TABLE IF NOT EXISTS public.vendor_advance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  advance_id uuid NOT NULL REFERENCES public.vendor_advances(id) ON DELETE RESTRICT,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_advances_org_date
  ON public.vendor_advances (organization_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_advances_org_vendor
  ON public.vendor_advances (organization_id, lower(trim(vendor_name)));
CREATE INDEX IF NOT EXISTS idx_vendor_advance_adjustments_advance
  ON public.vendor_advance_adjustments (advance_id);
CREATE INDEX IF NOT EXISTS idx_vendor_advance_adjustments_expense
  ON public.vendor_advance_adjustments (expense_id);

ALTER TABLE public.vendor_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_advance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_advances_select_internal ON public.vendor_advances;
CREATE POLICY vendor_advances_select_internal ON public.vendor_advances
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal'
  AND organization_id = (SELECT public.current_user_org_id())
);

DROP POLICY IF EXISTS vendor_advance_adjustments_select_internal ON public.vendor_advance_adjustments;
CREATE POLICY vendor_advance_adjustments_select_internal ON public.vendor_advance_adjustments
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal'
  AND organization_id = (SELECT public.current_user_org_id())
);

GRANT SELECT ON public.vendor_advances, public.vendor_advance_adjustments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.vendor_advances, public.vendor_advance_adjustments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_vendor_advance(
  p_vendor_name text,
  p_amount numeric,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_payment_method text DEFAULT 'bank_transfer',
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_user_id uuid := auth.uid();
  v_advance_id uuid;
  v_advance_number text;
  v_vendor_name text := trim(COALESCE(p_vendor_name, ''));
BEGIN
  IF auth.uid() IS NULL OR public.current_user_type() <> 'internal' THEN
    RAISE EXCEPTION 'Only authenticated internal staff can record vendor advances';
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not associated with an organization';
  END IF;
  IF v_vendor_name = '' THEN
    RAISE EXCEPTION 'Vendor or farmer name is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Advance amount must be greater than zero';
  END IF;
  IF p_payment_method NOT IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_advance_number := public.next_document_number(v_org_id, 'vendor_advance', 'ADV', 5);

  INSERT INTO public.vendor_advances (
    organization_id, advance_number, vendor_name, amount, payment_date,
    payment_method, reference_number, notes, created_by
  ) VALUES (
    v_org_id, v_advance_number, v_vendor_name, round(p_amount, 2),
    COALESCE(p_payment_date, CURRENT_DATE), p_payment_method,
    NULLIF(trim(COALESCE(p_reference_number, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''), v_user_id
  )
  RETURNING id INTO v_advance_id;

  PERFORM public.log_audit_event(
    v_org_id, 'create', 'vendor_advance', v_advance_id::text, NULL,
    jsonb_build_object(
      'advance_number', v_advance_number,
      'vendor_name', v_vendor_name,
      'amount', round(p_amount, 2),
      'payment_date', COALESCE(p_payment_date, CURRENT_DATE),
      'payment_method', p_payment_method,
      'reference_number', p_reference_number
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'id', v_advance_id,
    'advance_number', v_advance_number, 'amount', round(p_amount, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_vendor_advance_to_expense(
  p_advance_id uuid,
  p_expense_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_user_id uuid := auth.uid();
  v_advance public.vendor_advances%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_advance_applied numeric(12,2);
  v_expense_applied numeric(12,2);
  v_advance_balance numeric(12,2);
  v_expense_due numeric(12,2);
  v_adjustment_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_type() <> 'internal' THEN
    RAISE EXCEPTION 'Only authenticated internal staff can adjust vendor advances';
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not associated with an organization';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be greater than zero';
  END IF;

  SELECT * INTO v_advance
  FROM public.vendor_advances
  WHERE id = p_advance_id AND organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance not found in your organization';
  END IF;

  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id AND organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense bill not found in your organization';
  END IF;

  IF lower(trim(v_advance.vendor_name)) <> lower(trim(v_expense.paid_to)) THEN
    RAISE EXCEPTION 'This bill belongs to a different vendor/farmer';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_advance_applied
  FROM public.vendor_advance_adjustments WHERE advance_id = v_advance.id;
  SELECT COALESCE(SUM(amount), 0) INTO v_expense_applied
  FROM public.vendor_advance_adjustments WHERE expense_id = v_expense.id;

  v_advance_balance := v_advance.amount - v_advance_applied;
  v_expense_due := v_expense.amount - v_expense_applied;

  IF p_amount > v_advance_balance THEN
    RAISE EXCEPTION 'Adjustment exceeds available advance balance of %', v_advance_balance;
  END IF;
  IF p_amount > v_expense_due THEN
    RAISE EXCEPTION 'Adjustment exceeds remaining bill amount of %', v_expense_due;
  END IF;

  INSERT INTO public.vendor_advance_adjustments (
    organization_id, advance_id, expense_id, amount, notes, created_by
  ) VALUES (
    v_org_id, v_advance.id, v_expense.id, round(p_amount, 2),
    NULLIF(trim(COALESCE(p_notes, '')), ''), v_user_id
  )
  RETURNING id INTO v_adjustment_id;

  PERFORM public.log_audit_event(
    v_org_id, 'create', 'vendor_advance_adjustment', v_adjustment_id::text, NULL,
    jsonb_build_object(
      'advance_id', v_advance.id,
      'advance_number', v_advance.advance_number,
      'expense_id', v_expense.id,
      'expense_number', v_expense.expense_number,
      'vendor_name', v_advance.vendor_name,
      'amount', round(p_amount, 2),
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'advance_id', v_advance.id,
    'expense_id', v_expense.id,
    'adjusted_amount', round(p_amount, 2),
    'advance_balance', v_advance_balance - round(p_amount, 2),
    'expense_due', v_expense_due - round(p_amount, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_vendor_advance(text, numeric, date, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_vendor_advance_to_expense(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_vendor_advance(text, numeric, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_vendor_advance_to_expense(uuid, uuid, numeric, text) TO authenticated;

COMMIT;
