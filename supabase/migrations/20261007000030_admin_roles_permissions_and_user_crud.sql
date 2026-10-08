-- -----------------------------------------------------------------------------
-- 1. HARDEN HAS_ROLE HELPER FOR ADMINS AND SERVICE ROLES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN current_user IN ('postgres', 'service_role', 'supabase_admin') THEN true
      WHEN auth.uid() IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = (SELECT auth.uid())
          AND r.name = p_role_name
      )
    END;
$$;

-- -----------------------------------------------------------------------------
-- 2. ENSURE FULL CRUD PERMISSIONS EXIST FOR ALL MODULES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_modules text[] := ARRAY[
    'production', 'batches', 'inventory', 'raw_materials',
    'orders', 'invoices', 'customers', 'payments', 'ledger',
    'expenses', 'expiry', 'reports', 'users', 'settings',
    'products', 'categories', 'channels', 'dashboard'
  ];
  v_actions text[] := ARRAY['view', 'create', 'edit', 'delete'];
  m text;
  a text;
BEGIN
  FOREACH m IN ARRAY v_modules LOOP
    FOREACH a IN ARRAY v_actions LOOP
      INSERT INTO public.permissions (module, action, description)
      VALUES (m, a, upper(a) || ' access for ' || m)
      ON CONFLICT (module, action) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. POPULATE INITIAL DEFAULT ROLE PERMISSIONS IF MISSING
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_role_id uuid;
  v_prod_role_id uuid;
  v_wh_role_id uuid;
  v_acc_role_id uuid;
  v_perm RECORD;
BEGIN
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO v_prod_role_id FROM public.roles WHERE name = 'production_manager' LIMIT 1;
  SELECT id INTO v_wh_role_id FROM public.roles WHERE name = 'warehouse_manager' LIMIT 1;
  SELECT id INTO v_acc_role_id FROM public.roles WHERE name = 'accountant' LIMIT 1;

  -- Admin gets all permissions by default
  IF v_admin_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM public.permissions LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_admin_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Production Manager defaults
  IF v_prod_role_id IS NOT NULL THEN
    FOR v_perm IN 
      SELECT id FROM public.permissions 
      WHERE module IN ('production', 'batches') AND action IN ('view', 'create', 'edit')
         OR module IN ('inventory', 'raw_materials', 'expiry', 'products') AND action IN ('view', 'edit')
         OR module IN ('dashboard', 'reports') AND action = 'view'
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_prod_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Warehouse Manager defaults
  IF v_wh_role_id IS NOT NULL THEN
    FOR v_perm IN 
      SELECT id FROM public.permissions 
      WHERE module IN ('inventory', 'raw_materials') AND action IN ('view', 'create', 'edit')
         OR module IN ('batches', 'expiry', 'orders') AND action IN ('view', 'edit')
         OR module IN ('production', 'dashboard', 'reports') AND action = 'view'
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_wh_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Accountant defaults
  IF v_acc_role_id IS NOT NULL THEN
    FOR v_perm IN 
      SELECT id FROM public.permissions 
      WHERE module IN ('invoices', 'payments', 'expenses', 'orders') AND action IN ('view', 'create', 'edit')
         OR module IN ('customers', 'ledger', 'dashboard', 'reports') AND action = 'view'
    LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_acc_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. FUNCTION: ADMIN_GET_ROLE_PERMISSIONS_MATRIX
-- Returns structured JSON matrix of all roles and their module-level permissions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_role_permissions_matrix()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_role_row RECORD;
  v_role_matrix jsonb;
  v_mod RECORD;
  v_actions_json jsonb;
BEGIN
  -- For each internal role
  FOR v_role_row IN 
    SELECT name, id FROM public.roles 
    WHERE name IN ('admin', 'production_manager', 'warehouse_manager', 'accountant')
    ORDER BY CASE name 
      WHEN 'admin' THEN 1 
      WHEN 'production_manager' THEN 2 
      WHEN 'warehouse_manager' THEN 3 
      WHEN 'accountant' THEN 4 
      ELSE 5 
    END
  LOOP
    v_role_matrix := '{}'::jsonb;

    -- For each distinct module
    FOR v_mod IN SELECT DISTINCT module FROM public.permissions ORDER BY module LOOP
      -- Check which actions are enabled for this role & module
      SELECT jsonb_build_object(
        'view', COALESCE(bool_or(p.action = 'view'), false),
        'create', COALESCE(bool_or(p.action = 'create'), false),
        'edit', COALESCE(bool_or(p.action = 'edit'), false),
        'delete', COALESCE(bool_or(p.action = 'delete'), false)
      ) INTO v_actions_json
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = v_role_row.id AND p.module = v_mod.module;

      v_role_matrix := jsonb_set(
        v_role_matrix,
        ARRAY[v_mod.module],
        COALESCE(v_actions_json, '{"view": false, "create": false, "edit": false, "delete": false}'::jsonb)
      );
    END LOOP;

    v_result := jsonb_set(v_result, ARRAY[v_role_row.name], v_role_matrix);
  END LOOP;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. FUNCTION: ADMIN_SAVE_ROLE_PERMISSIONS
-- Allows admin to update all module permissions for a specified role atomically
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_role_permissions(
  p_role text,
  p_permissions jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_role_id uuid;
  v_module_key text;
  v_perm_obj jsonb;
  v_action text;
  v_perm_id uuid;
BEGIN
  -- Security check: only admin can alter permissions
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can modify role permissions';
  END IF;

  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found', p_role;
  END IF;

  -- Remove existing permissions for this role
  DELETE FROM public.role_permissions WHERE role_id = v_role_id;

  -- Iterate over modules in the provided payload
  FOR v_module_key IN SELECT jsonb_object_keys(p_permissions) LOOP
    v_perm_obj := p_permissions -> v_module_key;

    -- Check view, create, edit, delete
    FOREACH v_action IN ARRAY ARRAY['view', 'create', 'edit', 'delete'] LOOP
      IF (v_perm_obj ->> v_action)::boolean IS TRUE THEN
        SELECT id INTO v_perm_id
        FROM public.permissions
        WHERE module = v_module_key AND action = v_action;

        IF v_perm_id IS NOT NULL THEN
          INSERT INTO public.role_permissions (role_id, permission_id)
          VALUES (v_role_id, v_perm_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  PERFORM public.log_audit_event(
    v_org_id,
    'update',
    'role_permissions',
    p_role,
    NULL,
    jsonb_build_object('role', p_role, 'saved_at', now())
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. FUNCTION: ADMIN_UPDATE_EMPLOYEE
-- Full update for employee: full_name, mobile, department, role, status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_employee(
  p_user_id uuid,
  p_full_name text,
  p_mobile text,
  p_department text,
  p_role text,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_role_id uuid;
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'suspended', 'invited') THEN p_status ELSE 'active' END;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update employee profiles';
  END IF;

  IF trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Employee name cannot be blank';
  END IF;

  -- Lookup role
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found', p_role;
  END IF;

  -- Update profiles
  UPDATE public.profiles
  SET full_name = trim(p_full_name),
      mobile = trim(p_mobile),
      department_id = trim(p_department),
      status = v_clean_status,
      updated_at = now()
  WHERE id = p_user_id;

  -- Update user role
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (p_user_id, v_role_id);

  -- Ban/unban auth user according to status
  UPDATE auth.users
  SET banned_until = CASE WHEN v_clean_status IN ('inactive', 'suspended') THEN '2999-01-01'::timestamptz ELSE NULL END,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', trim(p_full_name),
        'mobile', trim(p_mobile),
        'department', trim(p_department)
      ),
      updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.log_audit_event(
    v_org_id,
    'update',
    'employee',
    p_user_id::text,
    NULL,
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'mobile', trim(p_mobile),
      'department', trim(p_department),
      'role', p_role,
      'status', v_clean_status
    )
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. FUNCTION: ADMIN_DELETE_EMPLOYEE
-- Safely deletes employee: checks caller is admin, prevents self-delete and last admin delete
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_employee(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_caller_id uuid := (SELECT auth.uid());
  v_emp_name text;
  v_active_admins int;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete employees';
  END IF;

  -- Safety check: caller cannot delete their own active session
  IF v_caller_id IS NOT NULL AND p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Safety check: You cannot delete your own logged-in administrator account.';
  END IF;

  -- Safety check: cannot delete the only active admin
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.name = 'admin'
  ) THEN
    SELECT count(DISTINCT ur.user_id) INTO v_active_admins
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE r.name = 'admin' AND p.status = 'active' AND ur.user_id <> p_user_id;

    IF v_active_admins = 0 THEN
      RAISE EXCEPTION 'Operation blocked: You cannot delete the only remaining active administrator.';
    END IF;
  END IF;

  -- Get employee name for audit
  SELECT full_name INTO v_emp_name FROM public.profiles WHERE id = p_user_id;

  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = p_user_id;

  PERFORM public.log_audit_event(
    v_org_id,
    'delete',
    'employee',
    p_user_id::text,
    NULL,
    jsonb_build_object('name', v_emp_name, 'deleted_at', now())
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. FUNCTION: ADMIN_CREATE_EMPLOYEE_DIRECT
-- Direct provisioning function enabling instant account creation without external SMTP
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_employee_direct(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_department text,
  p_role text,
  p_status text DEFAULT 'active',
  p_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_new_id uuid := gen_random_uuid();
  v_role_id uuid;
  v_clean_email text := lower(trim(p_email));
  v_clean_mobile text := trim(p_mobile);
  v_clean_status text := CASE WHEN p_status IN ('active', 'inactive', 'invited') THEN p_status ELSE 'active' END;
  v_password_hash text;
  v_plain_pwd text := COALESCE(NULLIF(trim(p_password), ''), 'Madhav@' || right(v_clean_mobile, 4));
  v_profile RECORD;
BEGIN
  IF NOT (SELECT public.has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create employees';
  END IF;

  IF trim(p_full_name) = '' OR v_clean_email = '' THEN
    RAISE EXCEPTION 'Employee name and email are required';
  END IF;

  -- Check duplicate email in profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = v_clean_email) THEN
    RAISE EXCEPTION 'An employee account with email "%" already exists', v_clean_email;
  END IF;

  -- Lookup role
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = p_role;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found', p_role;
  END IF;

  -- Create auth user
  v_password_hash := extensions.crypt(v_plain_pwd, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_new_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_password_hash,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'mobile', v_clean_mobile,
      'department', trim(p_department),
      'user_type', 'internal',
      'organization_id', v_org_id
    ),
    now(),
    now()
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
    invited_at,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    v_org_id,
    trim(p_full_name),
    v_clean_email,
    v_clean_mobile,
    'internal',
    v_clean_status,
    trim(p_department),
    CASE WHEN v_clean_status = 'invited' THEN now() ELSE NULL END,
    now(),
    now()
  )
  RETURNING * INTO v_profile;

  -- Assign role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_new_id, v_role_id);

  PERFORM public.log_audit_event(
    v_org_id,
    'create',
    'employee',
    v_new_id::text,
    NULL,
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'email', v_clean_email,
      'role', p_role,
      'department', trim(p_department),
      'status', v_clean_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_id,
    'full_name', trim(p_full_name),
    'email', v_clean_email,
    'role', p_role,
    'department', trim(p_department),
    'status', v_clean_status
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. PERMISSIONS & GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_get_role_permissions_matrix TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_role_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_employee_direct TO authenticated;
