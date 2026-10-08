-- =============================================================================
-- Migration 028: Fix get_customer_outstanding_invoices Return Columns
-- Provides id, invoice_id, already_paid, allocated_amount for complete compatibility
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_customer_outstanding_invoices(uuid);

CREATE OR REPLACE FUNCTION public.get_customer_outstanding_invoices(
  p_customer_id uuid
)
RETURNS TABLE (
  id uuid,
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  due_date date,
  total_amount numeric,
  allocated_amount numeric,
  already_paid numeric,
  outstanding_amount numeric,
  status text,
  order_id uuid,
  order_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    i.id AS id,
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    COALESCE(pa.total_allocated, 0::numeric) AS allocated_amount,
    COALESCE(pa.total_allocated, 0::numeric) AS already_paid,
    ROUND((i.total_amount - COALESCE(pa.total_allocated, 0::numeric)), 2) AS outstanding_amount,
    i.status,
    i.order_id,
    o.order_number
  FROM public.invoices i
  LEFT JOIN public.orders o ON i.order_id = o.id
  LEFT JOIN (
    SELECT 
      invoice_id, 
      SUM(allocated_amount) AS total_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  WHERE i.customer_id = p_customer_id
    AND i.status != 'cancelled'
    AND (i.total_amount - COALESCE(pa.total_allocated, 0::numeric)) > 0
  ORDER BY i.invoice_date ASC, i.created_at ASC;
$$;
