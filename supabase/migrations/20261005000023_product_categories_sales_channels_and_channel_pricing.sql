-- =============================================================================
-- Migration 023: Product Categories, Sales Channels & Channel-wise Pricing
-- Module: Multi-Channel Pricing Strategy & Category Management
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENHANCE PRODUCT CATEGORIES TABLE
-- -----------------------------------------------------------------------------

-- Add description column to product_categories if missing
ALTER TABLE public.product_categories 
  ADD COLUMN IF NOT EXISTS description text;

-- Index for active categories lookup
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active 
  ON public.product_categories(is_active);

-- -----------------------------------------------------------------------------
-- 2. SALES CHANNELS TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_sales_channels_org_code UNIQUE (organization_id, code),
  CONSTRAINT uq_sales_channels_org_name UNIQUE (organization_id, name)
);

CREATE TRIGGER trg_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sales_channels_org 
  ON public.sales_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_code 
  ON public.sales_channels(code);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_active 
  ON public.sales_channels(is_active);

-- -----------------------------------------------------------------------------
-- 3. SEED DEFAULT SALES CHANNELS
-- -----------------------------------------------------------------------------

INSERT INTO public.sales_channels (id, organization_id, name, code, description, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Retail', 'RETAIL', 'Grocery stores, supermarkets, and dairy booths with standard trade margins', true),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Wholesale', 'WHOLESALE', 'Bulk stockists, tier-2 distributors, and large confectionery institutional buyers', true),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Customer', 'CUSTOMER', 'Direct retail consumers, apartment societies, and residential doorstep delivery', true)
ON CONFLICT (organization_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- 4. LINK CUSTOMERS TO SALES CHANNELS
-- -----------------------------------------------------------------------------

ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid REFERENCES public.sales_channels(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_customers_sales_channel_id 
  ON public.customers(sales_channel_id);

-- Backfill existing customers to Wholesale / Retail default
UPDATE public.customers
SET sales_channel_id = 'c1000000-0000-0000-0000-000000000002'
WHERE sales_channel_id IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 5. PRODUCT CHANNEL PRICES TABLE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_channel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.sales_channels(id) ON DELETE RESTRICT,
  standard_price numeric(10,2) NOT NULL CHECK (standard_price >= 0),
  minimum_price numeric(10,2) NOT NULL CHECK (minimum_price >= 0),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_price_range CHECK (minimum_price <= standard_price),
  CONSTRAINT uq_product_channel_pricing UNIQUE (organization_id, product_id, channel_id)
);

CREATE TRIGGER trg_product_channel_prices_updated_at
  BEFORE UPDATE ON public.product_channel_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pcp_org 
  ON public.product_channel_prices(organization_id);
CREATE INDEX IF NOT EXISTS idx_pcp_product_id 
  ON public.product_channel_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_pcp_channel_id 
  ON public.product_channel_prices(channel_id);
CREATE INDEX IF NOT EXISTS idx_pcp_is_active 
  ON public.product_channel_prices(is_active);

-- -----------------------------------------------------------------------------
-- 6. SEED PRODUCT CHANNEL PRICES FOR EXISTING PRODUCTS
-- -----------------------------------------------------------------------------

-- Retail: Standard = default_price, Minimum = round(default_price * 0.93, 2)
INSERT INTO public.product_channel_prices (organization_id, product_id, channel_id, standard_price, minimum_price, is_active)
SELECT 
  p.organization_id,
  p.id,
  'c1000000-0000-0000-0000-000000000001'::uuid,
  p.default_price,
  ROUND(p.default_price * 0.93, 2),
  true
FROM public.products p
ON CONFLICT (organization_id, product_id, channel_id) DO NOTHING;

-- Wholesale: Standard = round(default_price * 0.90, 2), Minimum = round(default_price * 0.85, 2)
INSERT INTO public.product_channel_prices (organization_id, product_id, channel_id, standard_price, minimum_price, is_active)
SELECT 
  p.organization_id,
  p.id,
  'c1000000-0000-0000-0000-000000000002'::uuid,
  ROUND(p.default_price * 0.90, 2),
  ROUND(p.default_price * 0.85, 2),
  true
FROM public.products p
ON CONFLICT (organization_id, product_id, channel_id) DO NOTHING;

-- Customer: Standard = default_price, Minimum = round(default_price * 0.96, 2)
INSERT INTO public.product_channel_prices (organization_id, product_id, channel_id, standard_price, minimum_price, is_active)
SELECT 
  p.organization_id,
  p.id,
  'c1000000-0000-0000-0000-000000000003'::uuid,
  p.default_price,
  ROUND(p.default_price * 0.96, 2),
  true
FROM public.products p
ON CONFLICT (organization_id, product_id, channel_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. SYSTEM PERMISSIONS & RBAC MATRIX FOR NEW MODULES
-- -----------------------------------------------------------------------------

INSERT INTO public.permissions (module, action, description) VALUES
  ('categories', 'view', 'View product categories list'),
  ('categories', 'create', 'Add new product category'),
  ('categories', 'edit', 'Modify product category details and status'),
  ('categories', 'delete', 'Delete unused product category'),
  ('channels', 'view', 'View sales channels list'),
  ('channels', 'create', 'Add new sales channel'),
  ('channels', 'edit', 'Modify sales channel details and status'),
  ('channels', 'delete', 'Delete unused sales channel'),
  ('pricing', 'view', 'View channel pricing rules and standard rates'),
  ('pricing', 'manage', 'Define and edit standard and minimum channel prices')
ON CONFLICT (module, action) DO NOTHING;

-- Grant all to admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
WHERE module IN ('categories', 'channels', 'pricing')
ON CONFLICT DO NOTHING;

-- Grant view pricing to accountant
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM public.permissions
WHERE module IN ('categories', 'channels', 'pricing') AND action = 'view'
ON CONFLICT DO NOTHING;

-- Grant view categories to production manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE module = 'categories' AND action = 'view'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. DATABASE TRIGGER: MINIMUM SELLING PRICE ENFORCEMENT
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_order_item_minimum_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_channel_id uuid;
  v_product_id uuid;
  v_min_price numeric(10,2);
  v_channel_name text;
BEGIN
  -- Get order customer
  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer's sales channel
  SELECT c.sales_channel_id INTO v_channel_id
  FROM public.customers c
  WHERE c.id = v_customer_id;

  IF v_channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get product_id from SKU
  SELECT sku.product_id INTO v_product_id
  FROM public.product_skus sku
  WHERE sku.id = NEW.product_sku_id;

  IF v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup active minimum price for this product + channel
  SELECT pcp.minimum_price, sc.name INTO v_min_price, v_channel_name
  FROM public.product_channel_prices pcp
  JOIN public.sales_channels sc ON sc.id = pcp.channel_id
  WHERE pcp.product_id = v_product_id
    AND pcp.channel_id = v_channel_id
    AND pcp.is_active = true
  LIMIT 1;

  IF v_min_price IS NOT NULL AND NEW.unit_price < v_min_price THEN
    RAISE EXCEPTION 'Selling price ₹% is lower than the minimum allowed price of ₹% for the % channel',
      NEW.unit_price, v_min_price, COALESCE(v_channel_name, 'selected');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_order_item_minimum_price ON public.order_items;
CREATE TRIGGER trg_check_order_item_minimum_price
  BEFORE INSERT OR UPDATE OF unit_price ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_order_item_minimum_price();

-- -----------------------------------------------------------------------------
-- 9. UPDATE CUSTOMER SELF-REGISTRATION FUNCTION TO ASSIGN SALES CHANNEL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_customer_account(
  p_business_name text,
  p_owner_name text,
  p_mobile text,
  p_email text,
  p_address text,
  p_city text DEFAULT 'Pune',
  p_state text DEFAULT 'Maharashtra',
  p_pincode text DEFAULT NULL,
  p_gstin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_customer_id uuid;
  v_code text;
  v_default_channel_id uuid;
  v_cust_record public.customers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register customer account';
  END IF;

  -- Check if customer_users already exists for this auth user
  SELECT customer_id INTO v_customer_id
  FROM public.customer_users
  WHERE auth_user_id = v_user_id;

  IF v_customer_id IS NOT NULL THEN
    SELECT * INTO v_cust_record FROM public.customers WHERE id = v_customer_id;
    RETURN to_jsonb(v_cust_record);
  END IF;

  -- Look up default Customer sales channel
  SELECT id INTO v_default_channel_id
  FROM public.sales_channels
  WHERE organization_id = v_org_id AND code = 'CUSTOMER'
  LIMIT 1;

  IF v_default_channel_id IS NULL THEN
    SELECT id INTO v_default_channel_id
    FROM public.sales_channels
    WHERE organization_id = v_org_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Generate atomic linear customer code
  v_code := public.next_document_number(v_org_id, 'customer', 'RET', 4);

  -- Insert customer with assigned sales channel
  INSERT INTO public.customers (
    organization_id, customer_code, business_name, owner_name,
    mobile, email, address, city, state, pincode, gstin,
    credit_limit, payment_terms_days, status, sales_channel_id
  )
  VALUES (
    v_org_id, v_code, trim(p_business_name), trim(p_owner_name),
    trim(p_mobile), lower(trim(p_email)), trim(p_address),
    COALESCE(p_city, 'Pune'), COALESCE(p_state, 'Maharashtra'), p_pincode, p_gstin,
    50000.00, 15, 'active', v_default_channel_id
  )
  RETURNING * INTO v_cust_record;

  -- Upsert profile
  INSERT INTO public.profiles (
    id, organization_id, full_name, email, mobile, user_type, status
  )
  VALUES (
    v_user_id, v_org_id, trim(p_owner_name), lower(trim(p_email)), trim(p_mobile), 'customer', 'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    user_type = 'customer',
    status = 'active',
    updated_at = now();

  -- Insert customer_users relationship
  INSERT INTO public.customer_users (
    customer_id, auth_user_id, is_primary, is_active
  )
  VALUES (
    v_cust_record.id, v_user_id, true, true
  )
  ON CONFLICT (customer_id, auth_user_id) DO NOTHING;

  -- Ensure user role is 'customer'
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT v_user_id, r.id
  FROM public.roles r
  WHERE r.organization_id = v_org_id AND r.name = 'customer'
  ON CONFLICT DO NOTHING;

  RETURN to_jsonb(v_cust_record);
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. ROW-LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_channel_prices ENABLE ROW LEVEL SECURITY;

-- Product Categories RLS:
-- Refresh policy to allow public/customer viewing of active categories, internal staff full manage
DROP POLICY IF EXISTS "categories_select_all" ON public.product_categories;
DROP POLICY IF EXISTS "categories_manage_internal" ON public.product_categories;

CREATE POLICY "categories_select_all" ON public.product_categories
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    (is_active = true)
  );

CREATE POLICY "categories_manage_internal" ON public.product_categories
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

-- Sales Channels RLS:
DROP POLICY IF EXISTS "sales_channels_select" ON public.sales_channels;
DROP POLICY IF EXISTS "sales_channels_manage_internal" ON public.sales_channels;

CREATE POLICY "sales_channels_select" ON public.sales_channels
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) OR
    (is_active = true)
  );

CREATE POLICY "sales_channels_manage_internal" ON public.sales_channels
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

-- Product Channel Prices RLS:
-- Internal staff can see and manage all prices
-- Customers can only SELECT standard prices for their own assigned channel
DROP POLICY IF EXISTS "product_channel_prices_select" ON public.product_channel_prices;
DROP POLICY IF EXISTS "product_channel_prices_manage_internal" ON public.product_channel_prices;

CREATE POLICY "product_channel_prices_select" ON public.product_channel_prices
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (
      is_active = true AND
      channel_id = (
        SELECT sales_channel_id FROM public.customers 
        WHERE id = (SELECT public.current_customer_id())
      )
    )
  );

CREATE POLICY "product_channel_prices_manage_internal" ON public.product_channel_prices
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

-- Function permissions
GRANT EXECUTE ON FUNCTION public.check_order_item_minimum_price() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_account(text, text, text, text, text, text, text, text, text) TO authenticated;
