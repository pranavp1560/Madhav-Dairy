-- =============================================================================
-- Migration 013: Finance, Customer Ledger, and Operating Expenses
-- Module: Cash Flow, Double-Entry Collections & Expenses
-- =============================================================================

-- Payments received from customers / retailers
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  payment_number text NOT NULL,
  payment_date date DEFAULT CURRENT_DATE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  reference_number text,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_payments_org_number UNIQUE (organization_id, payment_number)
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Split payment allocation to multiple invoices
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Authoritative Customer Financial Ledger (Double-Entry Debit/Credit)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  entry_date date DEFAULT CURRENT_DATE NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('invoice', 'payment', 'credit_note', 'debit_note', 'opening_balance')),
  reference_type text NOT NULL, -- e.g. 'invoices', 'payments', 'credit_notes', 'manual'
  reference_id uuid,
  debit numeric(12,2) CHECK (debit >= 0),
  credit numeric(12,2) CHECK (credit >= 0),
  description text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_ledger_amounts CHECK (
    (debit IS NOT NULL AND debit > 0 AND (credit IS NULL OR credit = 0)) OR
    (credit IS NOT NULL AND credit > 0 AND (debit IS NULL OR debit = 0))
  )
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_expense_cat_org_name UNIQUE (organization_id, name)
);

CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Dairy Operating Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expense_number text NOT NULL,
  expense_date date DEFAULT CURRENT_DATE NOT NULL,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  paid_to text NOT NULL,
  reference_number text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_expenses_org_number UNIQUE (organization_id, expense_number)
);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice_id ON public.payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_ledger_org_id ON public.ledger_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_customer_id ON public.ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON public.ledger_entries(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
