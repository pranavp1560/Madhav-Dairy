-- =============================================================================
-- Migration 007: Suppliers
-- Module: Procurement & Farmer Societies
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  name text NOT NULL,
  contact_person text,
  mobile text NOT NULL,
  email citext,
  address text,
  gstin text,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'blacklisted')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_suppliers_org_code UNIQUE (organization_id, supplier_code)
);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_mobile ON public.suppliers(mobile);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
