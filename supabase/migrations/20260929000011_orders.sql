-- =============================================================================
-- Migration 011: Orders, Order Items, and Status Audit History
-- Module: Retailer B2B Ordering & Sales Processing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  order_date date DEFAULT CURRENT_DATE NOT NULL,
  requested_delivery_date date,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'dispatched', 'delivered', 'cancelled'
  )),
  subtotal numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
  tax_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
  total_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (total_amount >= 0),
  payment_status text DEFAULT 'unpaid' NOT NULL CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_orders_org_number UNIQUE (organization_id, order_number)
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Order line items with locked historical pricing
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(10,2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
  tax_percent numeric(5,2) DEFAULT 0.00 NOT NULL CHECK (tax_percent >= 0),
  tax_amount numeric(10,2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Complete status transition audit history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  notes text
);

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_id ON public.order_items(product_sku_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);
