-- =============================================================================
-- Migration 019: Open Demo Organization RLS for Clean Slate Data Entry
-- Module: Products, SKUs, Customers, Raw Materials, and Transactions
-- =============================================================================

-- Products
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO public
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "products_manage_internal" ON public.products;
CREATE POLICY "products_manage_internal" ON public.products
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Product SKUs
DROP POLICY IF EXISTS "skus_select" ON public.product_skus;
CREATE POLICY "skus_select" ON public.product_skus
  FOR SELECT TO public
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id()) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

DROP POLICY IF EXISTS "skus_manage_internal" ON public.product_skus;
CREATE POLICY "skus_manage_internal" ON public.product_skus
  FOR ALL TO public
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id()) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id()) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- Customers
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO public
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "customers_manage_internal" ON public.customers;
CREATE POLICY "customers_manage_internal" ON public.customers
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Raw Materials & Transactions
DROP POLICY IF EXISTS "raw_mat_internal" ON public.raw_materials;
CREATE POLICY "raw_mat_internal" ON public.raw_materials
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "rm_transactions_internal" ON public.raw_material_transactions;
CREATE POLICY "rm_transactions_internal" ON public.raw_material_transactions
  FOR ALL TO public
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) IS NOT NULL AND 
      organization_id = (SELECT public.current_user_org_id()) AND 
      (SELECT public.current_user_type()) = 'internal'
    )
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
