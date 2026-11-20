-- =============================================================================
-- Migration 042: Customer Auth Trigger, Self-Healing Profile, and Customer Backfill
-- Module: Authentication & Retailer Self-Service
-- Description:
--   1. Automatically provisions public.profiles, public.customers, public.customer_users,
--      and public.user_roles on ANY auth.users insertion (trigger-based).
--   2. Provides ensure_user_profile() RPC for self-healing missing profiles.
--   3. Initializes document_sequences to avoid duplicate key conflicts.
--   4. Backfills auth accounts for all existing database customers with initial password Madhav@1234.
--   5. Fixes dummy@gmail.com profile and customer links.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Initialize Document Sequences
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
BEGIN
  INSERT INTO public.document_sequences (organization_id, document_type, prefix, current_year, last_number)
  VALUES
    (v_org_id, 'customer', 'RET', v_year, 4),
    (v_org_id, 'advance', 'ADV', v_year, 3),
    (v_org_id, 'bill', 'BILL', v_year, 3),
    (v_org_id, 'delivery_unit', 'CHLN', v_year, 1),
    (v_org_id, 'order', 'MD-ORD', v_year, 0),
    (v_org_id, 'invoice', 'INV', v_year, 0),
    (v_org_id, 'payment', 'REC', v_year, 0),
    (v_org_id, 'production', 'PROD', v_year, 0),
    (v_org_id, 'batch', 'BAT', v_year, 0),
    (v_org_id, 'expense', 'EXP', v_year, 0),
    (v_org_id, 'transfer', 'TRF', v_year, 0)
  ON CONFLICT (organization_id, document_type, current_year) DO UPDATE
  SET last_number = GREATEST(public.document_sequences.last_number, EXCLUDED.last_number);
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Trigger Function: handle_new_auth_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_user_type text;
  v_full_name text;
  v_mobile text;
  v_clean_mobile text;
  v_business_name text;
  v_address text;
  v_city text;
  v_state text;
  v_pincode text;
  v_gstin text;
  v_customer_id uuid;
  v_code text;
  v_default_channel_id uuid;
BEGIN
  -- Extract user metadata
  v_user_type := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'user_type'), ''), 'customer');
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'owner_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_mobile := COALESCE(trim(NEW.raw_user_meta_data->>'mobile'), '');
  v_clean_mobile := regexp_replace(v_mobile, '\D', '', 'g');
  v_business_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'business_name'), ''),
    v_full_name,
    'Retail Store'
  );
  v_address := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'address'), ''), 'Pune');
  v_city := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'city'), ''), 'Pune');
  v_state := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'state'), ''), 'Maharashtra');
  v_pincode := NULLIF(trim(NEW.raw_user_meta_data->>'pincode'), '');
  v_gstin := NULLIF(trim(NEW.raw_user_meta_data->>'gstin'), '');

  -- 1. Upsert public.profiles
  INSERT INTO public.profiles (
    id,
    organization_id,
    full_name,
    email,
    mobile,
    user_type,
    status,
    department_id
  ) VALUES (
    NEW.id,
    v_org_id,
    v_full_name,
    lower(trim(NEW.email)),
    v_mobile,
    v_user_type,
    'active',
    NEW.raw_user_meta_data->>'department'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    mobile = COALESCE(NULLIF(EXCLUDED.mobile, ''), public.profiles.mobile),
    user_type = EXCLUDED.user_type,
    status = 'active',
    updated_at = now();

  -- 2. Customer specific provisioning
  IF v_user_type = 'customer' THEN
    -- Check if an existing customer matches email or clean mobile
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE organization_id = v_org_id
      AND (
        (email IS NOT NULL AND lower(trim(email)) = lower(trim(NEW.email)))
        OR (v_clean_mobile <> '' AND regexp_replace(mobile, '\D', '', 'g') = v_clean_mobile)
      )
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no existing customer found, create a new customer record
    IF v_customer_id IS NULL THEN
      -- Get default Customer sales channel
      SELECT id INTO v_default_channel_id
      FROM public.sales_channels
      WHERE organization_id = v_org_id AND code = 'CUSTOMER'
      LIMIT 1;

      IF v_default_channel_id IS NULL THEN
        SELECT id INTO v_default_channel_id
        FROM public.sales_channels
        WHERE organization_id = v_org_id
        ORDER BY created_at ASC
        LIMIT 1;
      END IF;

      -- Generate atomic linear customer code (e.g. RET-2026-0005)
      v_code := public.next_document_number(v_org_id, 'customer', 'RET', 4);

      INSERT INTO public.customers (
        organization_id, customer_code, business_name, owner_name,
        mobile, email, address, city, state, pincode, gstin,
        credit_limit, payment_terms_days, status, sales_channel_id
      ) VALUES (
        v_org_id, v_code, v_business_name, v_full_name,
        v_mobile, lower(trim(NEW.email)), v_address, v_city, v_state, v_pincode, v_gstin,
        50000.00, 15, 'active', v_default_channel_id
      )
      RETURNING id INTO v_customer_id;
    ELSE
      -- Update existing customer email/mobile if blank
      UPDATE public.customers
      SET email = COALESCE(NULLIF(email, ''), lower(trim(NEW.email))),
          mobile = COALESCE(NULLIF(mobile, ''), v_mobile),
          status = 'active',
          updated_at = now()
      WHERE id = v_customer_id;
    END IF;

    -- Link customer to auth user in customer_users
    INSERT INTO public.customer_users (customer_id, auth_user_id, is_primary, is_active)
    VALUES (v_customer_id, NEW.id, true, true)
    ON CONFLICT (customer_id, auth_user_id) DO UPDATE SET is_active = true;

    -- Assign customer role
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, r.id
    FROM public.roles r
    WHERE r.organization_id = v_org_id AND r.name = 'customer'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 3. Self-Healing Function: ensure_user_profile
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid := COALESCE(p_user_id, (SELECT auth.uid()));
  v_user_record auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_user_type text;
  v_full_name text;
  v_mobile text;
  v_clean_mobile text;
  v_business_name text;
  v_customer_id uuid;
  v_code text;
  v_default_channel_id uuid;
BEGIN
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Target user ID is required';
  END IF;

  -- Fetch auth user record
  SELECT * INTO v_user_record
  FROM auth.users
  WHERE id = v_target_id;

  IF v_user_record.id IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  -- Extract metadata
  v_user_type := COALESCE(NULLIF(trim(v_user_record.raw_user_meta_data->>'user_type'), ''), 'customer');
  v_full_name := COALESCE(
    NULLIF(trim(v_user_record.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(v_user_record.raw_user_meta_data->>'owner_name'), ''),
    split_part(v_user_record.email, '@', 1)
  );
  v_mobile := COALESCE(trim(v_user_record.raw_user_meta_data->>'mobile'), '');
  v_clean_mobile := regexp_replace(v_mobile, '\D', '', 'g');
  v_business_name := COALESCE(
    NULLIF(trim(v_user_record.raw_user_meta_data->>'business_name'), ''),
    v_full_name,
    'Retail Store'
  );

  -- Upsert profile
  INSERT INTO public.profiles (
    id, organization_id, full_name, email, mobile, user_type, status, department_id
  ) VALUES (
    v_target_id,
    v_org_id,
    v_full_name,
    lower(trim(v_user_record.email)),
    v_mobile,
    v_user_type,
    'active',
    v_user_record.raw_user_meta_data->>'department'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    mobile = COALESCE(NULLIF(EXCLUDED.mobile, ''), public.profiles.mobile),
    user_type = EXCLUDED.user_type,
    status = 'active',
    updated_at = now()
  RETURNING * INTO v_profile;

  -- If customer, ensure linking
  IF v_user_type = 'customer' THEN
    -- Check if linked in customer_users
    SELECT customer_id INTO v_customer_id
    FROM public.customer_users
    WHERE auth_user_id = v_target_id
    LIMIT 1;

    -- If not linked, check customers table by email or mobile
    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE organization_id = v_org_id
        AND (
          (email IS NOT NULL AND lower(trim(email)) = lower(trim(v_user_record.email)))
          OR (v_clean_mobile <> '' AND regexp_replace(mobile, '\D', '', 'g') = v_clean_mobile)
        )
      ORDER BY created_at ASC
      LIMIT 1;

      -- If still not found, create new customer
      IF v_customer_id IS NULL THEN
        SELECT id INTO v_default_channel_id
        FROM public.sales_channels
        WHERE organization_id = v_org_id AND code = 'CUSTOMER'
        LIMIT 1;

        IF v_default_channel_id IS NULL THEN
          SELECT id INTO v_default_channel_id
          FROM public.sales_channels
          WHERE organization_id = v_org_id
          ORDER BY created_at ASC
          LIMIT 1;
        END IF;

        v_code := public.next_document_number(v_org_id, 'customer', 'RET', 4);

        INSERT INTO public.customers (
          organization_id, customer_code, business_name, owner_name,
          mobile, email, address, city, state, pincode, gstin,
          credit_limit, payment_terms_days, status, sales_channel_id
        ) VALUES (
          v_org_id, v_code, v_business_name, v_full_name,
          v_mobile, lower(trim(v_user_record.email)), 'Pune', 'Pune', 'Maharashtra', NULL, NULL,
          50000.00, 15, 'active', v_default_channel_id
        )
        RETURNING id INTO v_customer_id;
      END IF;

      INSERT INTO public.customer_users (customer_id, auth_user_id, is_primary, is_active)
      VALUES (v_customer_id, v_target_id, true, true)
      ON CONFLICT (customer_id, auth_user_id) DO UPDATE SET is_active = true;
    END IF;

    -- Ensure customer role assigned
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT v_target_id, r.id
    FROM public.roles r
    WHERE r.organization_id = v_org_id AND r.name = 'customer'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target_id,
    'profile', to_jsonb(v_profile),
    'customer_id', v_customer_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Backfill: Repair dummy@gmail.com and Existing Database Customers
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_customer_role_id uuid;
  v_channel_id uuid;
  v_pwd_hash text;
  v_cust RECORD;
  v_new_user_id uuid;
  v_dummy_id uuid := 'cfc3d023-d5ac-4be2-8c40-72d294723f1c'::uuid;
  v_dummy_cust_id uuid;
BEGIN
  -- Get customer role id
  SELECT id INTO v_customer_role_id
  FROM public.roles
  WHERE organization_id = v_org_id AND name = 'customer';

  -- Get default sales channel
  SELECT id INTO v_channel_id
  FROM public.sales_channels
  WHERE organization_id = v_org_id AND code = 'CUSTOMER';

  IF v_channel_id IS NULL THEN
    SELECT id INTO v_channel_id
    FROM public.sales_channels
    WHERE organization_id = v_org_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Default password hash for existing customers: Madhav@1234
  v_pwd_hash := extensions.crypt('Madhav@1234', extensions.gen_salt('bf'));

  -- A. Repair dummy@gmail.com if it exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_dummy_id) THEN
    PERFORM public.ensure_user_profile(v_dummy_id);
  END IF;

  -- B. Ensure customer with missing email gets valid email
  UPDATE public.customers
  SET email = 'retailer.9965412352@madhavdairy.com'
  WHERE customer_code = 'RET-2026-0004' AND (email IS NULL OR email = '');

  -- C. Backfill auth accounts for all customers in public.customers
  FOR v_cust IN
    SELECT c.*
    FROM public.customers c
    WHERE c.email IS NOT NULL AND trim(c.email) <> ''
  LOOP
    -- Check if auth user already exists for this email
    SELECT id INTO v_new_user_id
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(v_cust.email))
    LIMIT 1;

    IF v_new_user_id IS NULL THEN
      v_new_user_id := gen_random_uuid();

      -- 1. Insert into auth.users
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
        v_new_user_id,
        'authenticated',
        'authenticated',
        lower(trim(v_cust.email)),
        v_pwd_hash,
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object(
          'sub', v_new_user_id::text,
          'email', lower(trim(v_cust.email)),
          'full_name', v_cust.owner_name,
          'mobile', v_cust.mobile,
          'business_name', v_cust.business_name,
          'user_type', 'customer'
        ),
        now(),
        now()
      );

      -- 2. Insert into auth.identities
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_new_user_id,
        jsonb_build_object('sub', v_new_user_id::text, 'email', lower(trim(v_cust.email))),
        'email',
        v_new_user_id::text,
        now(),
        now(),
        now()
      ) ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

    -- 3. Upsert profile
    INSERT INTO public.profiles (
      id, organization_id, full_name, email, mobile, user_type, status
    ) VALUES (
      v_new_user_id,
      v_org_id,
      v_cust.owner_name,
      lower(trim(v_cust.email)),
      v_cust.mobile,
      'customer',
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      mobile = EXCLUDED.mobile,
      user_type = 'customer',
      status = 'active',
      updated_at = now();

    -- 4. Link in customer_users
    INSERT INTO public.customer_users (customer_id, auth_user_id, is_primary, is_active)
    VALUES (v_cust.id, v_new_user_id, true, true)
    ON CONFLICT (customer_id, auth_user_id) DO UPDATE SET is_active = true;

    -- 5. Assign customer role
    IF v_customer_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (v_new_user_id, v_customer_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
