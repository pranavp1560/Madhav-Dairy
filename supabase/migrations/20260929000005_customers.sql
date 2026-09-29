-- =============================================================================
-- Migration 005: Customers and Customer Portal Users
-- Module: Retailers & B2B Distribution
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_code text NOT NULL,
  business_name text NOT NULL,
  owner_name text NOT NULL,
  mobile text NOT NULL,
  email citext,
  address text NOT NULL,
  area text,
  city text DEFAULT 'Pune' NOT NULL,
  state text DEFAULT 'Maharashtra' NOT NULL,
  pincode text,
  gstin text,
  credit_limit numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (credit_limit >= 0),
  payment_terms_days integer DEFAULT 15 NOT NULL CHECK (payment_terms_days >= 0),
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'blocked')),
  last_order_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_customers_org_code UNIQUE (organization_id, customer_code)
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Mapping table linking Supabase Auth users to retailer accounts
CREATE TABLE IF NOT EXISTS public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT true NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_customer_users UNIQUE (customer_id, auth_user_id)
);

CREATE TRIGGER trg_customer_users_updated_at
  BEFORE UPDATE ON public.customer_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance, search, and FK integrity
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON public.customers(business_name);

CREATE INDEX IF NOT EXISTS idx_customer_users_customer_id ON public.customer_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_auth_user_id ON public.customer_users(auth_user_id);

-- Security Definer helper for RLS and customer queries
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id 
  FROM public.customer_users 
  WHERE auth_user_id = (SELECT auth.uid()) 
    AND is_active = true 
  LIMIT 1;
$$;
