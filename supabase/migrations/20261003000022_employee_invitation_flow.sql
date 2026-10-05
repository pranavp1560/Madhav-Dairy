-- =============================================================================
-- Migration 022: Production Employee Invitation & Password Setup Flow
-- Module: Secure Auth Invitation, Zero-Knowledge Admin, Onboarding Status
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UPDATE PROFILES STATUS CONSTRAINT & ADD INVITED_AT
-- -----------------------------------------------------------------------------

-- Allow 'invited' in status check
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
  CHECK (status IN ('invited', 'active', 'inactive', 'suspended'));

-- Track when the invitation was sent
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- -----------------------------------------------------------------------------
-- 2. UPDATE ADMIN_UPDATE_EMPLOYEE_STATUS
-- -----------------------------------------------------------------------------
-- Ensure 'invited' status is supported and does NOT trigger auth ban

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
  v_org_id uuid := (SELECT public.current_user_org_id());
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended', 'invited') THEN p_status ELSE 'inactive' END;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can change employee status';
  END IF;

  IF v_org_id IS NULL THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  UPDATE public.profiles
  SET status = v_clean_status, updated_at = now()
  WHERE id = p_user_id;

  -- Block in auth.users ONLY if inactive or suspended.
  -- 'invited' and 'active' must NOT be banned so they can accept invite and log in.
  UPDATE auth.users
  SET banned_until = CASE WHEN v_clean_status IN ('inactive', 'suspended') THEN '2999-01-01'::timestamptz ELSE NULL END,
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
-- 3. FUNCTION: PROVISION INVITED EMPLOYEE (ATOMIC DB TRANSACTION)
-- -----------------------------------------------------------------------------
-- Called by the secure Edge Function after Auth Admin invitation is created.
-- Sets up profile, assigns role, and logs audit event atomically.

CREATE OR REPLACE FUNCTION public.admin_provision_invited_employee(
  p_user_id uuid,
  p_organization_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_department text,
  p_role text,
  p_status text DEFAULT 'invited'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended', 'invited') THEN p_status ELSE 'invited' END;
  v_profile_record public.profiles%ROWTYPE;
BEGIN
  -- Validate role exists in org
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = p_organization_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found for organization', p_role;
  END IF;

  -- Insert or update profile for invited employee
  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    mobile,
    user_type,
    status,
    department_id,
    invited_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_organization_id,
    trim(p_full_name),
    lower(trim(p_email)),
    trim(p_mobile),
    'internal',
    v_clean_status,
    trim(p_department),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    user_type = 'internal',
    status = EXCLUDED.status,
    department_id = EXCLUDED.department_id,
    invited_at = COALESCE(public.profiles.invited_at, now()),
    updated_at = now()
  RETURNING * INTO v_profile_record;

  -- Assign user role
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (p_user_id, v_role_id);

  -- Log audit event
  PERFORM public.log_audit_event(
    p_organization_id,
    'invite',
    'employee',
    p_user_id::text,
    NULL,
    jsonb_build_object(
      'name', p_full_name,
      'email', p_email,
      'role', p_role,
      'department', p_department,
      'status', v_clean_status
    )
  );

  RETURN to_jsonb(v_profile_record);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. FUNCTION: COMPLETE EMPLOYEE ONBOARDING (TRANSITION INVITED -> ACTIVE)
-- -----------------------------------------------------------------------------
-- Called when employee finishes password setup via secure invitation link.

CREATE OR REPLACE FUNCTION public.complete_employee_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to complete onboarding';
  END IF;

  UPDATE public.profiles
  SET status = 'active', updated_at = now()
  WHERE id = v_uid AND (status = 'invited' OR status = 'active')
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  END IF;

  -- Ensure auth user has no ban
  UPDATE auth.users
  SET banned_until = NULL, updated_at = now()
  WHERE id = v_uid;

  RETURN to_jsonb(v_profile);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. REMOVE OBSOLETE ADMIN_CREATE_EMPLOYEE PASSWORD RPC
-- -----------------------------------------------------------------------------
-- Administrators must NEVER create or submit employee passwords.
DROP FUNCTION IF EXISTS public.admin_create_employee(text, text, text, text, text, text, text);

-- -----------------------------------------------------------------------------
-- 6. PERMISSIONS & GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_update_employee_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_provision_invited_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_provision_invited_employee TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_employee_invitation TO authenticated;
