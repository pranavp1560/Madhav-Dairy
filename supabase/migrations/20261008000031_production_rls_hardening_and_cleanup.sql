-- Migration: 20261008000031_production_rls_hardening_and_cleanup.sql
-- Description: Production RLS hardening, tenant isolation enforcement, and removal of permissive/test policies.

BEGIN;

-- 1. sku_channel_prices: Remove overly permissive policy and isolate by organization
DROP POLICY IF EXISTS "Authenticated users full access to sku channel prices" ON public.sku_channel_prices;
DROP POLICY IF EXISTS "Public can view active sku channel prices" ON public.sku_channel_prices;
DROP POLICY IF EXISTS "sku_channel_prices_manage_internal" ON public.sku_channel_prices;
DROP POLICY IF EXISTS "sku_channel_prices_select" ON public.sku_channel_prices;

CREATE POLICY "sku_channel_prices_manage_internal" ON public.sku_channel_prices
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

CREATE POLICY "sku_channel_prices_select" ON public.sku_channel_prices
FOR SELECT TO authenticated
USING (
  ((SELECT public.current_user_type()) = 'internal' AND organization_id = (SELECT public.current_user_org_id()))
  OR (
    is_active = true AND
    channel_id = (SELECT c.sales_channel_id FROM public.customers c WHERE c.id = (SELECT public.current_customer_id()))
  )
);

CREATE POLICY "sku_channel_prices_anon_select" ON public.sku_channel_prices
FOR SELECT TO anon
USING (is_active = true);


-- 2. batches: Clean up policies and remove hardcoded fallback UUID
DROP POLICY IF EXISTS "batches_manage_internal" ON public.batches;
DROP POLICY IF EXISTS "batches_select" ON public.batches;

CREATE POLICY "batches_manage_internal" ON public.batches
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);

CREATE POLICY "batches_select" ON public.batches
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);


-- 3. batch_stock: Ensure batch organization isolation and prevent unauthenticated bypass
DROP POLICY IF EXISTS "batch_stock_manage" ON public.batch_stock;
DROP POLICY IF EXISTS "batch_stock_select" ON public.batch_stock;

CREATE POLICY "batch_stock_select" ON public.batch_stock
FOR SELECT TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  batch_id IN (
    SELECT b.id FROM public.batches b 
    WHERE b.organization_id = (SELECT public.current_user_org_id())
  )
);

CREATE POLICY "batch_stock_manage" ON public.batch_stock
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  batch_id IN (
    SELECT b.id FROM public.batches b 
    WHERE b.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  batch_id IN (
    SELECT b.id FROM public.batches b 
    WHERE b.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 4. production_materials: Enforce parent run organization isolation
DROP POLICY IF EXISTS "production_materials_internal" ON public.production_materials;

CREATE POLICY "production_materials_internal" ON public.production_materials
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  production_run_id IN (
    SELECT pr.id FROM public.production_runs pr
    WHERE pr.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  production_run_id IN (
    SELECT pr.id FROM public.production_runs pr
    WHERE pr.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 5. production_run_items: Enforce parent run organization isolation
DROP POLICY IF EXISTS "production_run_items_internal" ON public.production_run_items;

CREATE POLICY "production_run_items_internal" ON public.production_run_items
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  production_run_id IN (
    SELECT pr.id FROM public.production_runs pr
    WHERE pr.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  production_run_id IN (
    SELECT pr.id FROM public.production_runs pr
    WHERE pr.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 6. stock_transfer_items: Enforce parent transfer organization isolation
DROP POLICY IF EXISTS "stock_transfer_items_internal" ON public.stock_transfer_items;

CREATE POLICY "stock_transfer_items_internal" ON public.stock_transfer_items
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  transfer_id IN (
    SELECT st.id FROM public.stock_transfers st
    WHERE st.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  transfer_id IN (
    SELECT st.id FROM public.stock_transfers st
    WHERE st.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 7. invoice_items: Enforce parent invoice organization isolation for management
DROP POLICY IF EXISTS "invoice_items_manage_internal" ON public.invoice_items;

CREATE POLICY "invoice_items_manage_internal" ON public.invoice_items
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  invoice_id IN (
    SELECT inv.id FROM public.invoices inv
    WHERE inv.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  invoice_id IN (
    SELECT inv.id FROM public.invoices inv
    WHERE inv.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 8. expiry_alerts: Enforce organization isolation for management
DROP POLICY IF EXISTS "expiry_alerts_manage_internal" ON public.expiry_alerts;

CREATE POLICY "expiry_alerts_manage_internal" ON public.expiry_alerts
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);


-- 9. notifications: Enforce organization isolation for internal inserts
DROP POLICY IF EXISTS "notifications_insert_internal" ON public.notifications;

CREATE POLICY "notifications_insert_internal" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  organization_id = (SELECT public.current_user_org_id())
);


-- 10. customer_users: Enforce customer organization isolation for internal staff
DROP POLICY IF EXISTS "customer_users_select" ON public.customer_users;
DROP POLICY IF EXISTS "customer_users_manage_internal" ON public.customer_users;

CREATE POLICY "customer_users_select" ON public.customer_users
FOR SELECT TO authenticated
USING (
  (auth_user_id = (SELECT auth.uid()))
  OR (
    (SELECT public.current_user_type()) = 'internal' AND
    customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.organization_id = (SELECT public.current_user_org_id())
    )
  )
);

CREATE POLICY "customer_users_manage_internal" ON public.customer_users
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  (SELECT public.has_role('admin')) AND
  customer_id IN (
    SELECT c.id FROM public.customers c
    WHERE c.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  (SELECT public.has_role('admin')) AND
  customer_id IN (
    SELECT c.id FROM public.customers c
    WHERE c.organization_id = (SELECT public.current_user_org_id())
  )
);


-- 11. user_roles: Enforce profile organization isolation for internal staff
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_admin" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()))
  OR (
    (SELECT public.current_user_type()) = 'internal' AND
    user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.organization_id = (SELECT public.current_user_org_id())
    )
  )
);

CREATE POLICY "user_roles_manage_admin" ON public.user_roles
FOR ALL TO authenticated
USING (
  (SELECT public.current_user_type()) = 'internal' AND
  (SELECT public.has_role('admin')) AND
  user_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = (SELECT public.current_user_org_id())
  )
)
WITH CHECK (
  (SELECT public.current_user_type()) = 'internal' AND
  (SELECT public.has_role('admin')) AND
  user_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.organization_id = (SELECT public.current_user_org_id())
  )
);

COMMIT;
