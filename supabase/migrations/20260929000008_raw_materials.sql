-- =============================================================================
-- Migration 008: Raw Materials
-- Module: Raw Materials Master & Procurement Definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.raw_material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_raw_mat_cat_org_name UNIQUE (organization_id, name)
);

CREATE TRIGGER trg_raw_material_categories_updated_at
  BEFORE UPDATE ON public.raw_material_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.raw_material_categories(id) ON DELETE RESTRICT,
  material_code text NOT NULL,
  name text NOT NULL,
  name_mr text,
  name_hi text,
  unit text NOT NULL, -- e.g. "Litres", "kg", "Grams", "Units"
  min_stock_threshold numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (min_stock_threshold >= 0),
  cost_per_unit numeric(10,2) DEFAULT 0.00 NOT NULL CHECK (cost_per_unit >= 0),
  default_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_raw_materials_org_code UNIQUE (organization_id, material_code)
);

CREATE TRIGGER trg_raw_materials_updated_at
  BEFORE UPDATE ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_raw_materials_organization_id ON public.raw_materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_category_id ON public.raw_materials(category_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier_id ON public.raw_materials(default_supplier_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_is_active ON public.raw_materials(is_active);
