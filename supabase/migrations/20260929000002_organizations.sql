-- =============================================================================
-- Migration 002: Organizations
-- Module: Multi-tenant Corporate Foundation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  legal_name text,
  gstin text,
  fssai_number text,
  address text,
  phone text,
  email citext,
  logo_url text,
  timezone text DEFAULT 'Asia/Kolkata' NOT NULL,
  currency text DEFAULT 'INR' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_org_code_format CHECK (code ~ '^[A-Z0-9_-]+$')
);

-- Trigger for updated_at
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(code);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON public.organizations(is_active);
