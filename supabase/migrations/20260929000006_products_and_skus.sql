-- =============================================================================
-- Migration 006: Products, Categories, and SKUs
-- Module: Product Catalog & Unit Variations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_mr text,
  name_hi text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_product_categories UNIQUE (organization_id, name)
);

CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_mr text,
  name_hi text,
  description text,
  base_unit text NOT NULL, -- e.g. "pouch", "box", "tub", "block", "tin"
  default_price numeric(10,2) NOT NULL CHECK (default_price >= 0),
  shelf_life_days integer NOT NULL CHECK (shelf_life_days > 0),
  min_stock_threshold integer DEFAULT 50 NOT NULL CHECK (min_stock_threshold >= 0),
  image_url text,
  is_available boolean DEFAULT true NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_products_org_name UNIQUE (organization_id, name)
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Product SKUs (the authoritative inventory & selling unit)
CREATE TABLE IF NOT EXISTS public.product_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  pack_size text NOT NULL, -- e.g. "500 ml", "1 Litre", "250 g", "1 kg"
  unit text NOT NULL,
  mrp numeric(10,2) NOT NULL CHECK (mrp >= 0),
  selling_price numeric(10,2) NOT NULL CHECK (selling_price >= 0),
  is_default boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_product_skus UNIQUE (product_id, sku_code)
);

CREATE TRIGGER trg_product_skus_updated_at
  BEFORE UPDATE ON public.product_skus
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_product_categories_org ON public.product_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_product_skus_product_id ON public.product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_product_skus_sku_code ON public.product_skus(sku_code);
