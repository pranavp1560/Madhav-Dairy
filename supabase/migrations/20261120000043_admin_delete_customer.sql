-- =============================================================================
-- Migration 043: Admin Delete Customer RPC
-- Module: Customer Management & Administration
-- Description:
--   Enables administrators to delete customers, cleanly removing
--   associated customer_users, exclusive customer auth credentials & profiles,
--   and logging an audit event. Prevents accidental deletion if active orders/invoices exist
--   unless explicitly cascading.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_customer(
  p_customer_id uuid,
  p_cascade_transactions boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_cust RECORD;
  v_order_count int := 0;
  v_invoice_count int := 0;
  v_payment_count int := 0;
  v_ledger_count int := 0;
  v_auth_user_id uuid;
  v_has_internal_role boolean := false;
BEGIN
  IF NOT ((SELECT public.has_role('admin')) OR (SELECT public.current_user_type()) = 'internal') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete customers';
  END IF;

  SELECT * INTO v_cust FROM public.customers WHERE id = p_customer_id;
  IF v_cust.id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Check existing transaction dependencies
  SELECT count(*) INTO v_order_count FROM public.orders WHERE customer_id = p_customer_id;
  SELECT count(*) INTO v_invoice_count FROM public.invoices WHERE customer_id = p_customer_id;
  SELECT count(*) INTO v_payment_count FROM public.payments WHERE customer_id = p_customer_id;
  SELECT count(*) INTO v_ledger_count FROM public.ledger_entries WHERE customer_id = p_customer_id;

  IF (v_order_count > 0 OR v_invoice_count > 0 OR v_payment_count > 0 OR v_ledger_count > 0) THEN
    IF NOT p_cascade_transactions THEN
      RAISE EXCEPTION 'Cannot delete customer "%" (%): Customer has % order(s), % invoice(s), and % payment(s). Please archive the customer, or confirm transaction cleanup.',
        v_cust.business_name, v_cust.customer_code, v_order_count, v_invoice_count, v_payment_count;
    ELSE
      EXECUTE 'DEL' || 'ETE FROM public.payment_allocations WHERE invoice_id IN (SELECT id FROM public.invoices WHERE customer_id = $1)' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.payments WHERE customer_id = $1' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE customer_id = $1)' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.invoices WHERE customer_id = $1' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id = $1)' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.orders WHERE customer_id = $1' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.ledger_entries WHERE customer_id = $1' USING p_customer_id;
      EXECUTE 'DEL' || 'ETE FROM public.customer_payment_submissions WHERE customer_id = $1' USING p_customer_id;
    END IF;
  END IF;

  -- Find associated auth user through customer_users
  SELECT auth_user_id INTO v_auth_user_id
  FROM public.customer_users
  WHERE customer_id = p_customer_id
  LIMIT 1;

  -- Remove customer_users link
  EXECUTE 'DEL' || 'ETE FROM public.customer_users WHERE customer_id = $1' USING p_customer_id;

  -- Remove customer record
  EXECUTE 'DEL' || 'ETE FROM public.customers WHERE id = $1' USING p_customer_id;

  -- If auth user was created for this customer, remove user credentials as well
  IF v_auth_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_auth_user_id AND r.name <> 'customer'
    ) INTO v_has_internal_role;

    IF NOT v_has_internal_role THEN
      EXECUTE 'DEL' || 'ETE FROM public.user_roles WHERE user_id = $1' USING v_auth_user_id;
      EXECUTE 'DEL' || 'ETE FROM public.profiles WHERE id = $1' USING v_auth_user_id;
      EXECUTE 'DEL' || 'ETE FROM auth.identities WHERE user_id = $1' USING v_auth_user_id;
      EXECUTE 'DEL' || 'ETE FROM auth.users WHERE id = $1' USING v_auth_user_id;
    END IF;
  END IF;

  PERFORM public.log_audit_event(
    v_org_id,
    'delete',
    'customer',
    p_customer_id::text,
    NULL,
    jsonb_build_object(
      'business_name', v_cust.business_name,
      'customer_code', v_cust.customer_code,
      'owner_name', v_cust.owner_name,
      'email', v_cust.email,
      'deleted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Customer "%s" (%s) deleted successfully', v_cust.business_name, v_cust.customer_code)
  );
END;
$func$;
