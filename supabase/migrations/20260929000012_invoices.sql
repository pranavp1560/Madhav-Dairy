-- =============================================================================
-- Migration 012: Invoices and Batch-Allocated Invoice Line Items
-- Module: Tax Invoicing & Food Safety Batch Tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date DEFAULT CURRENT_DATE NOT NULL,
  due_date date NOT NULL,
  subtotal numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
  tax_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
  total_amount numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (total_amount >= 0),
  status text DEFAULT 'unpaid' NOT NULL CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_invoices_org_number UNIQUE (organization_id, invoice_number),
  CONSTRAINT chk_invoice_due_date CHECK (due_date >= invoice_date)
);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice line items explicitly tracking batch numbers for FSSAI compliance
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.batches(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  rate numeric(10,2) NOT NULL CHECK (rate >= 0),
  discount_amount numeric(10,2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
  tax_percent numeric(5,2) DEFAULT 0.00 NOT NULL CHECK (tax_percent >= 0),
  tax_amount numeric(10,2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0)
);

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_sku_id ON public.invoice_items(product_sku_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_batch_id ON public.invoice_items(batch_id);
