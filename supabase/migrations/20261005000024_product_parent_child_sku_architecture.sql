-- Migration: 20261005000024_product_parent_child_sku_architecture.sql
-- Production Product, Child SKU, and SKU-level Channel Pricing System

-- 1. Extend products table with brand if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'brand'
  ) THEN
    ALTER TABLE public.products ADD COLUMN brand text DEFAULT 'Madhav Dairy';
  END IF;
END $$;

-- 2. Extend product_skus table with variant_name, quantity, and barcode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_skus' AND column_name = 'variant_name'
  ) THEN
    ALTER TABLE public.product_skus ADD COLUMN variant_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_skus' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.product_skus ADD COLUMN quantity numeric(10,2) DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'product_skus' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE public.product_skus ADD COLUMN barcode text;
  END IF;
END $$;

-- Populate variant_name from pack_size for existing records if null
UPDATE public.product_skus
SET variant_name = pack_size
WHERE variant_name IS NULL OR variant_name = '';

-- 3. Create sku_channel_prices table for SKU-level channel pricing
CREATE TABLE IF NOT EXISTS public.sku_channel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.sales_channels(id) ON DELETE RESTRICT,
  standard_price numeric(10,2) NOT NULL,
  minimum_price numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sku_price_range CHECK (minimum_price <= standard_price AND minimum_price >= 0),
  CONSTRAINT uq_sku_channel UNIQUE (organization_id, sku_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_sku_channel_prices_sku ON public.sku_channel_prices(sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_channel_prices_channel ON public.sku_channel_prices(channel_id);

-- 4. Migrate existing product_channel_prices into sku_channel_prices using each product's default SKU
INSERT INTO public.sku_channel_prices (
  organization_id,
  sku_id,
  channel_id,
  standard_price,
  minimum_price,
  is_active,
  created_at,
  updated_at
)
SELECT 
  pcp.organization_id,
  s.id as sku_id,
  pcp.channel_id,
  pcp.standard_price,
  pcp.minimum_price,
  pcp.is_active,
  pcp.created_at,
  pcp.updated_at
FROM public.product_channel_prices pcp
JOIN (
  SELECT DISTINCT ON (product_id) id, product_id
  FROM public.product_skus
  ORDER BY product_id, is_default DESC, created_at ASC
) s ON s.product_id = pcp.product_id
ON CONFLICT (organization_id, sku_id, channel_id) DO UPDATE SET
  standard_price = EXCLUDED.standard_price,
  minimum_price = EXCLUDED.minimum_price,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 5. Update trigger function to check SKU-level minimum price with fallback to product-level
CREATE OR REPLACE FUNCTION public.check_order_item_minimum_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- 1. Try SKU-level minimum price first
  SELECT scp.minimum_price, sc.name INTO v_min_price, v_channel_name
  FROM public.sku_channel_prices scp
  JOIN public.sales_channels sc ON sc.id = scp.channel_id
  WHERE scp.sku_id = NEW.product_sku_id
    AND scp.channel_id = v_channel_id
    AND scp.is_active = true
  LIMIT 1;

  -- 2. Fallback to product-level minimum price if not configured at SKU level
  IF v_min_price IS NULL THEN
    SELECT sku.product_id INTO v_product_id
    FROM public.product_skus sku
    WHERE sku.id = NEW.product_sku_id;

    IF v_product_id IS NOT NULL THEN
      SELECT pcp.minimum_price, sc.name INTO v_min_price, v_channel_name
      FROM public.product_channel_prices pcp
      JOIN public.sales_channels sc ON sc.id = pcp.channel_id
      WHERE pcp.product_id = v_product_id
        AND pcp.channel_id = v_channel_id
        AND pcp.is_active = true
      LIMIT 1;
    END IF;
  END IF;

  -- Enforce minimum floor price
  IF v_min_price IS NOT NULL AND NEW.unit_price < v_min_price THEN
    RAISE EXCEPTION 'Selling price ₹% is lower than the minimum allowed price of ₹% for the % channel',
      NEW.unit_price, v_min_price, COALESCE(v_channel_name, 'selected');
  END IF;

  RETURN NEW;
END;
$function$;

-- 6. Enable RLS on sku_channel_prices
ALTER TABLE public.sku_channel_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active sku channel prices" ON public.sku_channel_prices;
CREATE POLICY "Public can view active sku channel prices" 
  ON public.sku_channel_prices 
  FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users full access to sku channel prices" ON public.sku_channel_prices;
CREATE POLICY "Authenticated users full access to sku channel prices" 
  ON public.sku_channel_prices 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 7. Ensure active sales channels and SKUs are readable publicly
DROP POLICY IF EXISTS "Public can view active sales channels" ON public.sales_channels;
CREATE POLICY "Public can view active sales channels" 
  ON public.sales_channels 
  FOR SELECT 
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active product skus" ON public.product_skus;
CREATE POLICY "Public can view active product skus" 
  ON public.product_skus 
  FOR SELECT 
  USING (is_active = true);

