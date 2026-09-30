-- =============================================================================
-- Migration 020: Auto-Confirm User Trigger and Customer Auth Permissions
-- Module: Authentication & Retailer Self-Service
-- =============================================================================

-- 1. Auto-confirm any new auth users immediately (bypasses email rate limit / SMTP requirements)
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_confirm_user();

-- 2. Customer Users RLS Policy (Allow authenticated users and anon self-service registration)
DROP POLICY IF EXISTS "customer_users_own" ON public.customer_users;
DROP POLICY IF EXISTS "customer_users_manage" ON public.customer_users;

CREATE POLICY "customer_users_manage" ON public.customer_users
  FOR ALL TO public
  USING (
    auth_user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_type()) = 'internal' OR
    (SELECT auth.uid()) IS NULL
  )
  WITH CHECK (
    auth_user_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_type()) = 'internal' OR
    (SELECT auth.uid()) IS NULL
  );

-- 3. Profiles RLS: Ensure customers can read/insert their own profile record
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (
    id = (SELECT auth.uid()) OR
    (SELECT auth.uid()) IS NULL
  );
