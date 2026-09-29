-- =============================================================================
-- Migration 015: Audit Trail and Production Atomic Document Numbering
-- Module: Compliance Audit & Concurrency-Safe Sequence Counters
-- =============================================================================

-- Comprehensive Audit Trail Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,        -- 'login', 'create', 'update', 'delete', 'stock_adjust', 'status_change'
  entity_type text NOT NULL,   -- 'orders', 'invoices', 'batches', 'customers', 'profiles', etc.
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Atomic Document Sequence Counters (Never use MAX + 1)
CREATE TABLE IF NOT EXISTS public.document_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'order', 'invoice', 'payment', 'batch', 'expense', 'production', 'transfer'
  prefix text NOT NULL,        -- 'MD-ORD', 'MD-INV', 'MD-PAY', 'MD-BAT', 'MD-EXP', etc.
  current_year integer NOT NULL,
  last_number bigint DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (organization_id, document_type, current_year)
);

CREATE TRIGGER trg_doc_seq_updated_at
  BEFORE UPDATE ON public.document_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic Next Document Number Generator (Strictly linear, race-condition safe)
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_org_id uuid,
  p_doc_type text,
  p_prefix text,
  p_padding integer DEFAULT 6
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_next_num bigint;
  v_result text;
BEGIN
  -- Atomic upsert with row-level lock guaranteeing zero duplication across concurrent workers
  INSERT INTO public.document_sequences (
    organization_id, document_type, prefix, current_year, last_number
  )
  VALUES (
    p_org_id, p_doc_type, p_prefix, v_year, 1
  )
  ON CONFLICT (organization_id, document_type, current_year)
  DO UPDATE SET
    last_number = public.document_sequences.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_num;

  v_result := p_prefix || '-' || v_year::text || '-' || LPAD(v_next_num::text, p_padding, '0');
  RETURN v_result;
END;
$$;

-- Generic Audit Logger Function
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    p_org_id, (SELECT auth.uid()), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Indexes for audit query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
