-- =============================================================================
-- Migration 021: Production Authentication, Strict RLS Hardening & Employee RBAC
-- Module: Security, RBAC, Customer Isolation & Admin Provisioning
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HARDEN RLS: CUSTOMERS & CUSTOMER USERS
-- -----------------------------------------------------------------------------

-- Drop open demo bypass policies from migration 019 & 020
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_manage_internal" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customer_users_manage" ON public.customer_users;
DROP POLICY IF EXISTS "customer_users_own" ON public.customer_users;

-- Customer table: Customer A sees ONLY Customer A; Internal staff see all in their organization
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  );

CREATE POLICY "customers_manage_internal" ON public.customers
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (id = (SELECT public.current_customer_id()))
  );

-- Customer Users table: authenticated users see their own mapping; internal staff see all
CREATE POLICY "customer_users_select" ON public.customer_users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid()) OR
    ((SELECT public.current_user_type()) = 'internal')
  );

CREATE POLICY "customer_users_manage_internal" ON public.customer_users
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal' AND (SELECT public.has_role('admin'))
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' AND (SELECT public.has_role('admin'))
  );

-- -----------------------------------------------------------------------------
-- 2. HARDEN RLS: PROFILES & USER ROLES
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_own_or_internal" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_select_own_or_internal" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid()) OR 
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal')
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin'))
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.has_role('admin'))
  );

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_admin" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR 
    ((SELECT public.current_user_type()) = 'internal')
  );

CREATE POLICY "user_roles_manage_admin" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    (SELECT public.current_user_type()) = 'internal' AND (SELECT public.has_role('admin'))
  )
  WITH CHECK (
    (SELECT public.current_user_type()) = 'internal' AND (SELECT public.has_role('admin'))
  );

-- -----------------------------------------------------------------------------
-- 3. HARDEN RLS: RAW MATERIALS & INVENTORY
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "raw_mat_internal" ON public.raw_materials;
DROP POLICY IF EXISTS "rm_transactions_internal" ON public.raw_material_transactions;

CREATE POLICY "raw_mat_internal" ON public.raw_materials
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

CREATE POLICY "rm_transactions_internal" ON public.raw_material_transactions
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

-- -----------------------------------------------------------------------------
-- 4. HARDEN RLS: PRODUCTS & PRODUCT SKUS
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_manage_internal" ON public.products;
DROP POLICY IF EXISTS "skus_select" ON public.product_skus;
DROP POLICY IF EXISTS "skus_manage_internal" ON public.product_skus;

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO public
  USING (
    (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal') OR
    (is_available = true AND is_active = true)
  );

CREATE POLICY "products_manage_internal" ON public.products
  FOR ALL TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id()) AND 
    (SELECT public.current_user_type()) = 'internal'
  );

CREATE POLICY "skus_select" ON public.product_skus
  FOR SELECT TO public
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE (organization_id = (SELECT public.current_user_org_id()) AND (SELECT public.current_user_type()) = 'internal')
         OR (is_available = true AND is_active = true)
    )
  );

CREATE POLICY "skus_manage_internal" ON public.product_skus
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id())
    ) AND (SELECT public.current_user_type()) = 'internal'
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products 
      WHERE organization_id = (SELECT public.current_user_org_id())
    ) AND (SELECT public.current_user_type()) = 'internal'
  );

-- -----------------------------------------------------------------------------
-- 5. FUNCTION: CUSTOMER SELF-REGISTRATION (ATOMIC TRANSACTION)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_customer_account(
  p_business_name text,
  p_owner_name text,
  p_mobile text,
  p_email text,
  p_address text,
  p_city text DEFAULT 'Pune',
  p_state text DEFAULT 'Maharashtra',
  p_pincode text DEFAULT NULL,
  p_gstin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_customer_id uuid;
  v_code text;
  v_cust_record public.customers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register customer account';
  END IF;

  -- Check if customer_users already exists for this auth user
  SELECT customer_id INTO v_customer_id
  FROM public.customer_users
  WHERE auth_user_id = v_user_id;

  IF v_customer_id IS NOT NULL THEN
    SELECT * INTO v_cust_record FROM public.customers WHERE id = v_customer_id;
    RETURN to_jsonb(v_cust_record);
  END IF;

  -- Generate atomic linear customer code (never Math.random)
  v_code := public.next_document_number(v_org_id, 'customer', 'RET', 4);

  -- Insert customer
  INSERT INTO public.customers (
    organization_id, customer_code, business_name, owner_name,
    mobile, email, address, city, state, pincode, gstin,
    credit_limit, payment_terms_days, status
  )
  VALUES (
    v_org_id, v_code, trim(p_business_name), trim(p_owner_name),
    trim(p_mobile), lower(trim(p_email)), trim(p_address),
    COALESCE(p_city, 'Pune'), COALESCE(p_state, 'Maharashtra'), p_pincode, p_gstin,
    50000.00, 15, 'active'
  )
  RETURNING * INTO v_cust_record;

  -- Upsert profile
  INSERT INTO public.profiles (
    id, organization_id, full_name, email, mobile, user_type, status
  )
  VALUES (
    v_user_id, v_org_id, trim(p_owner_name), lower(trim(p_email)), trim(p_mobile), 'customer', 'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    user_type = 'customer',
    status = 'active',
    updated_at = now();

  -- Insert customer_users relationship
  INSERT INTO public.customer_users (
    customer_id, auth_user_id, is_primary, is_active
  )
  VALUES (
    v_cust_record.id, v_user_id, true, true
  )
  ON CONFLICT (customer_id, auth_user_id) DO NOTHING;

  -- Ensure user role is 'customer'
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT v_user_id, r.id
  FROM public.roles r
  WHERE r.organization_id = v_org_id AND r.name = 'customer'
  ON CONFLICT DO NOTHING;

  RETURN to_jsonb(v_cust_record);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. FUNCTION: ADMIN CREATE EMPLOYEE (AUTH + PROFILE + ROLE)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_department text,
  p_role text,
  p_password text,
  p_status text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid uuid := (SELECT auth.uid());
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_role_id uuid;
  v_new_user_id uuid := gen_random_uuid();
  v_encrypted_pw text;
  v_clean_email text := lower(trim(p_email));
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended') THEN p_status ELSE 'active' END;
BEGIN
  -- Verify admin authorization
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can provision employees';
  END IF;

  -- Validate role exists in org
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found for organization', p_role;
  END IF;

  -- Validate email is not duplicate
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_clean_email) THEN
    RAISE EXCEPTION 'Email "%" is already registered', v_clean_email;
  END IF;

  -- Require minimum 6 characters for password
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- Hash password using standard bcrypt pgcrypto
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    banned_until
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pw,
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'mobile', trim(p_mobile),
      'user_type', 'internal',
      'email_verified', true
    ),
    false,
    now(),
    now(),
    CASE WHEN v_clean_status != 'active' THEN '2999-01-01'::timestamptz ELSE NULL END
  );

  -- Insert identity into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
  )
  VALUES (
    gen_random_uuid(),
    v_new_user_id,
    v_new_user_id::text,
    jsonb_build_object('sub', v_new_user_id::text, 'email', v_clean_email),
    'email',
    NULL,
    now(),
    now(),
    v_clean_email
  );

  -- Insert profile
  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    mobile,
    user_type,
    status,
    department_id,
    created_at,
    updated_at
  )
  VALUES (
    v_new_user_id,
    v_org_id,
    trim(p_full_name),
    v_clean_email,
    trim(p_mobile),
    'internal',
    v_clean_status,
    trim(p_department),
    now(),
    now()
  );

  -- Assign user role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_new_user_id, v_role_id);

  -- Log audit event
  PERFORM public.log_audit_event(
    v_org_id,
    'create',
    'employee',
    v_new_user_id::text,
    NULL,
    jsonb_build_object('name', p_full_name, 'email', v_clean_email, 'role', p_role, 'department', p_department)
  );

  RETURN jsonb_build_object(
    'id', v_new_user_id,
    'email', v_clean_email,
    'full_name', p_full_name,
    'role', p_role,
    'department', p_department,
    'status', v_clean_status
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. FUNCTION: ADMIN UPDATE EMPLOYEE ROLE
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_employee_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_role_id uuid;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update employee roles';
  END IF;

  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = p_new_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found', p_new_role;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role_id) VALUES (p_user_id, v_role_id);

  PERFORM public.log_audit_event(
    v_org_id,
    'update',
    'employee_role',
    p_user_id::text,
    NULL,
    jsonb_build_object('new_role', p_new_role)
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. FUNCTION: ADMIN UPDATE EMPLOYEE STATUS (ENFORCES AUTH LOCKOUT)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_employee_status(
  p_user_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended') THEN p_status ELSE 'inactive' END;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can change employee status';
  END IF;

  UPDATE public.profiles
  SET status = v_clean_status, updated_at = now()
  WHERE id = p_user_id;

  -- Block/Unblock in auth.users so Supabase Auth directly prevents login/session access
  UPDATE auth.users
  SET banned_until = CASE WHEN v_clean_status != 'active' THEN '2999-01-01'::timestamptz ELSE NULL END,
      updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.log_audit_event(
    v_org_id,
    'update',
    'employee_status',
    p_user_id::text,
    NULL,
    jsonb_build_object('status', v_clean_status)
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. FUNCTION: ADMIN RESET EMPLOYEE PASSWORD
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_reset_employee_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_hash text;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reset employee passwords';
  END IF;

  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_hash,
      updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.log_audit_event(
    v_org_id,
    'update',
    'employee_password_reset',
    p_user_id::text,
    NULL,
    jsonb_build_object('reset_by_admin', true)
  );

  RETURN true;
END;
$$;

-- Grant EXECUTE privileges to authenticated users on secure functions
GRANT EXECUTE ON FUNCTION public.register_customer_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_employee_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_employee_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_employee_password TO authenticated;
