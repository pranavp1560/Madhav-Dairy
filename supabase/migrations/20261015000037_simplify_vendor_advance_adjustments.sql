-- =============================================================================
-- Migration 037: Simplified Vendor Advance Adjustments
-- Allows adjusting vendor advances directly against goods / raw materials / expenses
-- without requiring formal bill entities.
-- =============================================================================

-- 1. Make bill_id and bill_number optional in vendor_advance_adjustments
ALTER TABLE public.vendor_advance_adjustments
  ALTER COLUMN bill_id DROP NOT NULL;

ALTER TABLE public.vendor_advance_adjustments
  ALTER COLUMN bill_number DROP NOT NULL;

-- 2. Add description column to vendor_advance_adjustments if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_advance_adjustments'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.vendor_advance_adjustments ADD COLUMN description text;
  END IF;
END $$;

-- 3. Stored Procedure: Adjust Vendor Advance Directly (against goods/expenses)
CREATE OR REPLACE FUNCTION public.adjust_vendor_advance(
  p_advance_id uuid,
  p_adjustment_amount numeric,
  p_description text DEFAULT NULL,
  p_adjustment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance public.vendor_advances%ROWTYPE;
  v_new_adjusted numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
  v_adj_seq integer;
  v_adj_number text;
  v_adj_id uuid;
  v_current_year text := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  IF p_adjustment_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be greater than zero.';
  END IF;

  -- 1. Acquire row lock on advance record to guarantee consistency
  SELECT * INTO v_advance
  FROM public.vendor_advances
  WHERE id = p_advance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance record with ID % was not found.', p_advance_id;
  END IF;

  -- 2. Validate adjustment does not exceed available balance
  IF p_adjustment_amount > v_advance.balance_amount THEN
    RAISE EXCEPTION 'Adjustment amount (₹%) exceeds available advance balance (₹%) for advance %.',
      p_adjustment_amount, v_advance.balance_amount, v_advance.advance_number;
  END IF;

  -- 3. Calculate new values
  v_new_adjusted := v_advance.adjusted_amount + p_adjustment_amount;
  v_new_balance := v_advance.amount - v_new_adjusted;
  v_new_status := CASE WHEN v_new_balance = 0 THEN 'fully_adjusted' ELSE 'partially_adjusted' END;

  -- 4. Update the advance
  UPDATE public.vendor_advances
  SET
    adjusted_amount = v_new_adjusted,
    balance_amount = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_advance_id;

  -- 5. Generate adjustment sequence number
  SELECT COALESCE(MAX(SUBSTRING(adjustment_number FROM 'ADJ-[0-9]+-([0-9]+)')::integer), 0) + 1
  INTO v_adj_seq
  FROM public.vendor_advance_adjustments
  WHERE organization_id = v_advance.organization_id;

  v_adj_number := 'ADJ-' || v_current_year || '-' || LPAD(v_adj_seq::text, 4, '0');

  -- 6. Insert audit trail entry
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
    description,
    notes,
    adjusted_by
  ) VALUES (
    v_advance.organization_id,
    v_adj_number,
    v_advance.id,
    NULL,
    v_advance.supplier_id,
    v_advance.vendor_name,
    COALESCE(p_description, 'Direct Expense Offset'),
    v_advance.advance_number,
    COALESCE(p_adjustment_date, CURRENT_DATE),
    p_adjustment_amount,
    p_description,
    COALESCE(p_notes, p_description, 'Adjusted with vendor goods/raw material'),
    p_user_id
  )
  RETURNING id INTO v_adj_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adj_id,
    'adjustment_number', v_adj_number,
    'new_advance_balance', v_new_balance,
    'new_adjusted_amount', v_new_adjusted,
    'advance_status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_vendor_advance(uuid, numeric, text, date, text, uuid) TO authenticated, anon;
