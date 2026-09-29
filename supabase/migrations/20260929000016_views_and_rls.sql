-- =============================================================================
-- Migration 016: Derived Balance Views and Row-Level Security (RLS)
-- Module: Single Sources of Truth & Multi-Tenant Authorization
-- =============================================================================

-- =============================================================================
-- 1. DERIVED BALANCE VIEWS (WITH security_invoker = true)
-- =============================================================================

-- Authoritative Customer Financial Balance (Computed from double-entry ledger)
CREATE OR REPLACE VIEW public.view_customer_outstanding
WITH (security_invoker = true)
AS
SELECT 
  c.id AS customer_id,
  c.organization_id,
  c.customer_code,
  c.business_name,
  c.owner_name,
  c.credit_limit,
  c.payment_terms_days,
  c.status AS customer_status,
  COALESCE(SUM(l.debit), 0.00) AS total_billed,
  COALESCE(SUM(l.credit), 0.00) AS total_paid,
  COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00) AS outstanding_amount,
  c.credit_limit - (COALESCE(SUM(l.debit), 0.00) - COALESCE(SUM(l.credit), 0.00)) AS available_credit,
  MAX(l.entry_date) AS last_transaction_date
FROM public.customers c
LEFT JOIN public.ledger_entries l ON l.customer_id = c.id
GROUP BY c.id, c.organization_id, c.customer_code, c.business_name, c.owner_name, c.credit_limit, c.payment_terms_days, c.status;

-- Authoritative Live Raw Material Inventory (Computed from transaction ledger)
CREATE OR REPLACE VIEW public.view_raw_material_stock
WITH (security_invoker = true)
AS
SELECT 
  rm.id AS raw_material_id,
  rm.organization_id,
  rm.material_code,
  rm.name AS material_name,
  rm.name_mr,
  rm.name_hi,
  rm.category_id,
  cat.name AS category_name,
  rm.unit,
  rm.min_stock_threshold,
  rm.cost_per_unit,
  COALESCE(SUM(rmt.quantity), 0.00) AS current_stock,
  CASE 
    WHEN COALESCE(SUM(rmt.quantity), 0.00) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(rmt.quantity), 0.00) <= rm.min_stock_threshold THEN 'low_stock'
    ELSE 'healthy'
  END AS stock_status,
  MAX(rmt.transaction_at) AS last_movement_at
FROM public.raw_materials rm
LEFT JOIN public.raw_material_categories cat ON cat.id = rm.category_id
LEFT JOIN public.raw_material_transactions rmt ON rmt.raw_material_id = rm.id
GROUP BY rm.id, rm.organization_id, rm.material_code, rm.name, rm.name_mr, rm.name_hi, rm.category_id, cat.name, rm.unit, rm.min_stock_threshold, rm.cost_per_unit;

-- Authoritative Batch Stock Availability
CREATE OR REPLACE VIEW public.view_batch_stock_summary
WITH (security_invoker = true)
AS
SELECT 
  b.id AS batch_id,
  b.organization_id,
  b.batch_number,
  b.product_sku_id,
  p.name AS product_name,
  sku.pack_size,
  sku.sku_code,
  b.production_date,
  b.expiry_date,
  b.status AS batch_status,
  (b.expiry_date - CURRENT_DATE) AS days_until_expiry,
  COALESCE(SUM(bs.quantity_on_hand), 0.00) AS total_on_hand,
  COALESCE(SUM(bs.quantity_reserved), 0.00) AS total_reserved,
  COALESCE(SUM(bs.quantity_on_hand), 0.00) - COALESCE(SUM(bs.quantity_reserved), 0.00) AS available_for_sale
FROM public.batches b
JOIN public.product_skus sku ON sku.id = b.product_sku_id
JOIN public.products p ON p.id = sku.product_id
LEFT JOIN public.batch_stock bs ON bs.batch_id = b.id
GROUP BY b.id, b.organization_id, b.batch_number, b.product_sku_id, p.name, sku.pack_size, sku.sku_code, b.production_date, b.expiry_date, b.status;

-- =============================================================================
-- 2. ENABLE ROW-LEVEL SECURITY (RLS) ON ALL TABLES
-- =============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiry_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiry_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. RLS POLICIES (Optimized with subqueries & TO authenticated)
-- =============================================================================

-- Organizations
CREATE POLICY "org_select_internal" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT public.current_user_org_id()));

CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin')))
  WITH CHECK (id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin')));

-- Profiles
CREATE POLICY "profiles_select_own_or_internal" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid()) OR 
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal')
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin'))
  );

-- Roles and Permissions (Internal staff read, admin manage)
CREATE POLICY "roles_select_internal" ON public.roles
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "roles_manage_admin" ON public.roles
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin')));

CREATE POLICY "permissions_select" ON public.permissions
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

CREATE POLICY "role_perms_select" ON public.role_permissions
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR 
    ((SELECT public.current_user_type()) = 'internal' AND (SELECT public.has_role('admin')))
  );

-- Locations
CREATE POLICY "locations_select_internal" ON public.locations
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "locations_manage_internal" ON public.locations
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

-- Customers & Customer Users
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "customers_manage_internal" ON public.customers
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "customer_users_own" ON public.customer_users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid()) OR 
    ((SELECT public.current_user_type()) = 'internal')
  );

-- Product Categories & Products & SKUs
CREATE POLICY "categories_select_all" ON public.product_categories
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND is_active = true);

CREATE POLICY "categories_manage_internal" ON public.product_categories
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND
    (
      (SELECT public.current_user_type()) = 'internal' OR
      (is_available = true AND is_active = true)
    )
  );

CREATE POLICY "products_manage_internal" ON public.products
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "skus_select" ON public.product_skus
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id())
    )
  );

CREATE POLICY "skus_manage_internal" ON public.product_skus
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id())
    ) AND (SELECT public.current_user_type()) = 'internal'
  );

-- Suppliers & Raw Materials (Internal Only)
CREATE POLICY "suppliers_internal_all" ON public.suppliers
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "raw_mat_cat_internal" ON public.raw_material_categories
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "raw_mat_internal" ON public.raw_materials
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

-- Production Runs (Internal Only)
CREATE POLICY "production_runs_internal" ON public.production_runs
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "production_run_items_internal" ON public.production_run_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

CREATE POLICY "production_materials_internal" ON public.production_materials
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

-- Batches and Inventory
CREATE POLICY "batches_select" ON public.batches
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()));

CREATE POLICY "batches_manage_internal" ON public.batches
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "batch_stock_select" ON public.batch_stock
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

CREATE POLICY "batch_stock_manage" ON public.batch_stock
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

CREATE POLICY "inv_transactions_internal" ON public.inventory_transactions
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "rm_transactions_internal" ON public.raw_material_transactions
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "stock_transfers_internal" ON public.stock_transfers
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "stock_transfer_items_internal" ON public.stock_transfer_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

-- Orders & Order Items (Customer sees own, Internal sees all in org)
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "orders_update_internal" ON public.orders
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal')
  WITH CHECK (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') 
         OR (customer_id = (SELECT public.current_customer_id()))
    )
  );

CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') 
         OR (customer_id = (SELECT public.current_customer_id()))
    )
  );

CREATE POLICY "order_history_select" ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') 
         OR (customer_id = (SELECT public.current_customer_id()))
    )
  );

-- Invoices & Invoice Items
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "invoices_manage_internal" ON public.invoices
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') 
         OR (customer_id = (SELECT public.current_customer_id()))
    )
  );

CREATE POLICY "invoice_items_manage_internal" ON public.invoice_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

-- Payments, Ledger, and Expenses
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "payments_manage_internal" ON public.payments
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM public.payments 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') 
         OR (customer_id = (SELECT public.current_customer_id()))
    )
  );

CREATE POLICY "ledger_select" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "ledger_manage_internal" ON public.ledger_entries
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "expense_categories_internal" ON public.expense_categories
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "expenses_internal" ON public.expenses
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

-- Expiry Rules and Alerts
CREATE POLICY "expiry_rules_internal" ON public.expiry_rules
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');

CREATE POLICY "expiry_alerts_select" ON public.expiry_alerts
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.current_user_type()) = 'internal') OR
    (customer_id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "expiry_alerts_manage_internal" ON public.expiry_alerts
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_type()) = 'internal');

-- Notifications
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = (SELECT auth.uid()))
  WITH CHECK (recipient_user_id = (SELECT auth.uid()));

-- Audit Logs & Document Sequences
CREATE POLICY "audit_logs_internal" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin')));

CREATE POLICY "doc_sequences_internal" ON public.document_sequences
  FOR ALL TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal');
