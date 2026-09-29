-- =============================================================================
-- Migration 004: Locations and Facilities
-- Module: Facilities & Cold-Chain Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('warehouse', 'production', 'retail_store', 'other')),
  address text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_locations_org_code UNIQUE (organization_id, code)
);

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON public.locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_location_type ON public.locations(location_type);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON public.locations(is_active);
