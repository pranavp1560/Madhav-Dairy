-- =============================================================================
-- Migration 010: Batches, Finished Goods Stock, and Inventory Ledger
-- Module: Cold-Chain Batch Tracking & Double-Entry Inventory
-- =============================================================================

-- Finished goods batch definition
CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  production_run_id uuid REFERENCES public.production_runs(id) ON DELETE SET NULL,
  batch_number text NOT NULL,
  production_date date NOT NULL,
  expiry_date date NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'near_expiry', 'expired', 'exhausted')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_batches_org_num UNIQUE (organization_id, batch_number),
  CONSTRAINT chk_batch_expiry CHECK (expiry_date >= production_date)
);

CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Location-specific stock levels per batch
CREATE TABLE IF NOT EXISTS public.batch_stock (
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  quantity_on_hand numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (quantity_on_hand >= 0),
  quantity_reserved numeric(12,2) DEFAULT 0.00 NOT NULL CHECK (quantity_reserved >= 0),
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (batch_id, location_id)
);

CREATE TRIGGER trg_batch_stock_updated_at
  BEFORE UPDATE ON public.batch_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Immutable Finished Goods Inventory Transaction Ledger
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.batches(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'opening', 'purchase', 'production', 'sale', 'sale_return', 
    'purchase_return', 'reservation', 'reservation_release', 
    'damage', 'adjustment', 'transfer_in', 'transfer_out'
  )),
  quantity numeric(12,2) NOT NULL, -- Positive for additions, negative for reductions
  reference_type text,             -- e.g. 'order', 'invoice', 'production_run', 'stock_transfer', 'manual'
  reference_id uuid,
  unit_cost numeric(10,2),
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  transaction_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Immutable Raw Material Transaction Ledger
CREATE TABLE IF NOT EXISTS public.raw_material_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE RESTRICT,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'opening', 'purchase', 'production_consumption', 'damage', 'adjustment', 'transfer', 'return'
  )),
  quantity numeric(12,2) NOT NULL, -- Positive for purchases/inward, negative for usage/damage
  reference_type text,             -- e.g. 'purchase_order', 'production_run', 'gate_entry'
  reference_id text,
  unit_cost numeric(10,2),
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  transaction_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Stock Transfers between warehouses / cold rooms
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transfer_number text NOT NULL,
  from_location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  CONSTRAINT uq_stock_transfers_org_num UNIQUE (organization_id, transfer_number),
  CONSTRAINT chk_transfer_diff_locations CHECK (from_location_id <> to_location_id)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_sku_id uuid NOT NULL REFERENCES public.product_skus(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.batches(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0)
);

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_batches_org_id ON public.batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_sku_id ON public.batches(product_sku_id);
CREATE INDEX IF NOT EXISTS idx_batches_production_run_id ON public.batches(production_run_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON public.batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);

CREATE INDEX IF NOT EXISTS idx_batch_stock_location_id ON public.batch_stock(location_id);

CREATE INDEX IF NOT EXISTS idx_inv_tx_org_id ON public.inventory_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_location_id ON public.inventory_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_sku_id ON public.inventory_transactions(product_sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_batch_id ON public.inventory_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON public.inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_at ON public.inventory_transactions(transaction_at);

CREATE INDEX IF NOT EXISTS idx_rm_tx_org_id ON public.raw_material_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_rm_tx_raw_mat_id ON public.raw_material_transactions(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_rm_tx_type ON public.raw_material_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_rm_tx_at ON public.raw_material_transactions(transaction_at);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_org_id ON public.stock_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON public.stock_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON public.stock_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_sku ON public.stock_transfer_items(product_sku_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_batch ON public.stock_transfer_items(batch_id);
