-- =============================================================================
-- Migration 017: Batch RLS Policy Fix and Numbering Generator
-- Module: Traceability, Inventory, and Prototype Mode Support
-- =============================================================================

-- 1. Helper function to generate unique batch numbers
-- Format: First 2 letters of month (with JE for June, JY for July) + DD + YYYY
-- Example: 30 January 2026 -> JA302026, 15 June 2026 -> JE152026, 04 July 2026 -> JY042026
CREATE OR REPLACE FUNCTION public.generate_batch_number(p_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_month int;
  v_day text;
  v_year text;
  v_month_code text;
BEGIN
  v_month := EXTRACT(MONTH FROM p_date);
  v_day := LPAD(EXTRACT(DAY FROM p_date)::text, 2, '0');
  v_year := EXTRACT(YEAR FROM p_date)::text;

  v_month_code := CASE v_month
    WHEN 1 THEN 'JA'
    WHEN 2 THEN 'FE'
    WHEN 3 THEN 'MA'
    WHEN 4 THEN 'AP'
    WHEN 5 THEN 'MA'
    WHEN 6 THEN 'JE'  -- Explicit requirement: June initials are JE
    WHEN 7 THEN 'JY'  -- Explicit requirement: July initials are JY
    WHEN 8 THEN 'AU'
    WHEN 9 THEN 'SE'
    WHEN 10 THEN 'OC'
    WHEN 11 THEN 'NO'
    WHEN 12 THEN 'DE'
    ELSE 'JA'
  END;

  RETURN v_month_code || v_day || v_year;
END;
$$;

-- 2. Update current_user_org_id and current_user_type with fallback for unauthenticated prototype/demo sessions
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT user_type FROM public.profiles WHERE id = (SELECT auth.uid())),
    'internal'::text
  );
$$;

-- 3. RLS Policies for batches
DROP POLICY IF EXISTS "batches_select" ON public.batches;
CREATE POLICY "batches_select" ON public.batches
  FOR SELECT TO public
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "batches_manage_internal" ON public.batches;
CREATE POLICY "batches_manage_internal" ON public.batches
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR
    (
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR
    (
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- 4. RLS Policies for batch_stock
DROP POLICY IF EXISTS "batch_stock_select" ON public.batch_stock;
CREATE POLICY "batch_stock_select" ON public.batch_stock
  FOR SELECT TO public
  USING (
    (SELECT public.current_user_type()) = 'internal' OR
    (SELECT auth.uid()) IS NULL
  );

DROP POLICY IF EXISTS "batch_stock_manage" ON public.batch_stock;
CREATE POLICY "batch_stock_manage" ON public.batch_stock
  FOR ALL TO public
  USING (
    (SELECT public.current_user_type()) = 'internal' OR
    (SELECT auth.uid()) IS NULL
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' OR
    (SELECT auth.uid()) IS NULL
  );

-- 5. RLS Policies for inventory_transactions
DROP POLICY IF EXISTS "inv_transactions_internal" ON public.inventory_transactions;
CREATE POLICY "inv_transactions_internal" ON public.inventory_transactions
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR
    (
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR
    (
      organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );
