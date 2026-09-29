-- =============================================================================
-- Migration 009: Production Runs and Recipe Yields
-- Module: Manufacturing & Processing Operations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  production_number text NOT NULL,
  production_date date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_production_runs_org_num UNIQUE (organization_id, production_number)
);

CREATE TRIGGER trg_production_runs_updated_at
  BEFORE UPDATE ON public.production_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Production output line items (SKUs produced)
CREATE TABLE IF NOT EXISTS public.production_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_run_id uuid NOT NULL REFERENCES public.production_runs(id) ON DELETE CASCADE,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  planned_quantity numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (planned_quantity >= 0),
  produced_quantity numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (produced_quantity >= 0),
  rejected_quantity numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (rejected_quantity >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_production_run_items_updated_at
  BEFORE UPDATE ON public.production_run_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Production raw materials consumed (Silos & ingredients)
CREATE TABLE IF NOT EXISTS public.production_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_run_id uuid NOT NULL REFERENCES public.production_runs(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  planned_quantity numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (planned_quantity >= 0),
  consumed_quantity numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (consumed_quantity >= 0),
  unit text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_production_materials_updated_at
  BEFORE UPDATE ON public.production_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_production_runs_org_id ON public.production_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_production_runs_location_id ON public.production_runs(location_id);
CREATE INDEX IF NOT EXISTS idx_production_runs_status ON public.production_runs(status);
CREATE INDEX IF NOT EXISTS idx_production_runs_date ON public.production_runs(production_date);

CREATE INDEX IF NOT EXISTS idx_production_run_items_run_id ON public.production_run_items(production_run_id);
CREATE INDEX IF NOT EXISTS idx_production_run_items_sku_id ON public.production_run_items(product_sku_id);

CREATE INDEX IF NOT EXISTS idx_production_materials_run_id ON public.production_materials(production_run_id);
CREATE INDEX IF NOT EXISTS idx_production_materials_raw_mat_id ON public.production_materials(raw_material_id);
