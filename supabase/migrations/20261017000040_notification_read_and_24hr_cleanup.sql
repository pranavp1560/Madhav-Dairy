-- =============================================================================
-- Migration 040: Notification Read Synchronization & 24-Hour DB Cleanup
-- Description:
--   1. Automatically synchronizes "mark as read" between notifications and expiry_alerts.
--   2. Deletes read notifications and acknowledged expiry alerts after 24 hours.
--   3. Adds RPCs:
--      - public.mark_notification_as_read(uuid, uuid)
--      - public.mark_all_notifications_as_read(text, uuid)
--      - public.mark_expiry_alert_as_read(uuid, uuid)
--      - public.mark_all_expiry_alerts_as_read(uuid)
--      - public.cleanup_read_notifications_and_alerts()
--   4. Schedules hourly pg_cron cleanup job.
--   5. Adds DELETE RLS policies for authenticated internal users.
-- =============================================================================

-- 1. Ensure DELETE policies exist for notifications and expiry_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'notifications_delete_internal'
  ) THEN
    CREATE POLICY notifications_delete_internal ON public.notifications 
      FOR DELETE TO authenticated 
      USING (
        ((SELECT current_user_type()) = 'internal') AND 
        (organization_id = (SELECT current_user_org_id()))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expiry_alerts' AND policyname = 'expiry_alerts_delete_internal'
  ) THEN
    CREATE POLICY expiry_alerts_delete_internal ON public.expiry_alerts 
      FOR DELETE TO authenticated 
      USING (
        ((SELECT current_user_type()) = 'internal') AND 
        (organization_id = (SELECT current_user_org_id()))
      );
  END IF;
END $$;

-- 2. Function to mark single notification as read & sync linked expiry alert
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(
  p_notification_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif record;
  v_effective_user_id uuid;
  v_linked_alerts_count int := 0;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  SELECT * INTO v_notif
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
  END IF;

  -- Update notification read_at
  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id;

  -- Synchronize linked expiry alert(s)
  UPDATE public.expiry_alerts
  SET status = 'acknowledged',
      acknowledged_at = COALESCE(acknowledged_at, now()),
      acknowledged_by = COALESCE(acknowledged_by, v_effective_user_id),
      updated_at = now()
  WHERE (notification_id = p_notification_id OR (
    v_notif.reference_type = 'batches' AND batch_id = v_notif.reference_id
  )) AND status IN ('active', 'expired');

  GET DIAGNOSTICS v_linked_alerts_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'notification_id', p_notification_id,
    'linked_alerts_acknowledged', v_linked_alerts_count
  );
END;
$$;

-- 3. Function to mark all notifications as read & acknowledge linked alerts
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(
  p_recipient_type text DEFAULT 'internal',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user_id uuid;
  v_notifs_updated int := 0;
  v_alerts_updated int := 0;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  IF p_recipient_type = 'customer' THEN
    UPDATE public.notifications
    SET read_at = now()
    WHERE customer_id IS NOT NULL AND read_at IS NULL;
    GET DIAGNOSTICS v_notifs_updated = ROW_COUNT;

    UPDATE public.expiry_alerts
    SET status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = v_effective_user_id,
        updated_at = now()
    WHERE alert_type = 'customer' AND status IN ('active', 'expired');
    GET DIAGNOSTICS v_alerts_updated = ROW_COUNT;
  ELSE
    UPDATE public.notifications
    SET read_at = now()
    WHERE read_at IS NULL;
    GET DIAGNOSTICS v_notifs_updated = ROW_COUNT;

    UPDATE public.expiry_alerts
    SET status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = v_effective_user_id,
        updated_at = now()
    WHERE status IN ('active', 'expired');
    GET DIAGNOSTICS v_alerts_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'notifications_marked_read', v_notifs_updated,
    'alerts_acknowledged', v_alerts_updated
  );
END;
$$;

-- 4. Function to mark single expiry alert as read/acknowledged & sync linked notification
CREATE OR REPLACE FUNCTION public.mark_expiry_alert_as_read(
  p_alert_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert record;
  v_effective_user_id uuid;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  SELECT * INTO v_alert
  FROM public.expiry_alerts
  WHERE id = p_alert_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expiry alert not found');
  END IF;

  UPDATE public.expiry_alerts
  SET status = 'acknowledged',
      acknowledged_at = COALESCE(acknowledged_at, now()),
      acknowledged_by = COALESCE(acknowledged_by, v_effective_user_id),
      updated_at = now()
  WHERE id = p_alert_id;

  -- Synchronize linked notification if present
  IF v_alert.notification_id IS NOT NULL THEN
    UPDATE public.notifications
    SET read_at = COALESCE(read_at, now())
    WHERE id = v_alert.notification_id;
  ELSE
    -- If no direct notification_id, check if notification exists by reference_id = batch_id
    UPDATE public.notifications
    SET read_at = COALESCE(read_at, now())
    WHERE reference_type = 'batches' AND reference_id = v_alert.batch_id AND read_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'alert_id', p_alert_id,
    'status', 'acknowledged'
  );
END;
$$;

-- 5. Function to mark all expiry alerts as read/acknowledged
CREATE OR REPLACE FUNCTION public.mark_all_expiry_alerts_as_read(
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user_id uuid;
  v_alerts_count int := 0;
  v_notifs_count int := 0;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());

  UPDATE public.expiry_alerts
  SET status = 'acknowledged',
      acknowledged_at = now(),
      acknowledged_by = v_effective_user_id,
      updated_at = now()
  WHERE status IN ('active', 'expired');

  GET DIAGNOSTICS v_alerts_count = ROW_COUNT;

  UPDATE public.notifications
  SET read_at = now()
  WHERE type = 'expiry' AND read_at IS NULL;

  GET DIAGNOSTICS v_notifs_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'alerts_acknowledged', v_alerts_count,
    'notifications_marked_read', v_notifs_count
  );
END;
$$;

-- 6. Core Cleanup function: Deletes read notifications & acknowledged alerts older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_read_notifications_and_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_notifs int := 0;
  v_deleted_alerts int := 0;
BEGIN
  -- 1. Delete notifications marked read > 24 hours ago
  DELETE FROM public.notifications
  WHERE read_at IS NOT NULL 
    AND read_at < (now() - INTERVAL '24 hours');
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  -- 2. Delete expiry alerts acknowledged > 24 hours ago OR superseded/resolved > 24 hours ago
  DELETE FROM public.expiry_alerts
  WHERE (acknowledged_at IS NOT NULL AND acknowledged_at < (now() - INTERVAL '24 hours'))
     OR (status IN ('superseded', 'resolved') AND resolved_at IS NOT NULL AND resolved_at < (now() - INTERVAL '24 hours'))
     OR (status = 'acknowledged' AND updated_at < (now() - INTERVAL '24 hours'));
  GET DIAGNOSTICS v_deleted_alerts = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_notifications_count', v_deleted_notifs,
    'deleted_alerts_count', v_deleted_alerts,
    'timestamp', now()
  );
END;
$$;

-- 7. Integrate cleanup into evaluate_expiry_alerts so it also cleans up automatically every run
CREATE OR REPLACE FUNCTION public.evaluate_expiry_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  c_rec RECORD;
  v_rule RECORD;
  v_days_remaining int;
  v_threshold int;
  v_severity text;
  v_existing_alert_id uuid;
  v_notif_id uuid;
  v_title text;
  v_msg text;
  v_customer_user_id uuid;
  v_admin_profile_id uuid;
  v_staff_alerts_created int := 0;
  v_staff_alerts_resolved int := 0;
  v_customer_alerts_created int := 0;
  v_customer_alerts_resolved int := 0;
  v_cleanup_res jsonb;
BEGIN
  -- Clean up read notifications and acknowledged alerts older than 24 hours first
  v_cleanup_res := public.cleanup_read_notifications_and_alerts();

  -- Resolve default system internal user for notifications
  SELECT id INTO v_admin_profile_id
  FROM public.profiles
  WHERE user_type = 'internal' AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  -- PHASE 1: STAFF INVENTORY EXPIRY EVALUATION
  FOR r IN (
    SELECT 
      b.id AS batch_id,
      b.organization_id,
      b.batch_number,
      b.expiry_date,
      b.production_date,
      p.id AS product_id,
      p.name AS product_name,
      p.shelf_life_days,
      bs.location_id,
      loc.name AS location_name,
      COALESCE(bs.quantity_on_hand, 0) - COALESCE(bs.quantity_reserved, 0) AS remaining_qty,
      (b.expiry_date - CURRENT_DATE) AS days_remaining
    FROM public.batches b
    JOIN public.product_skus sku ON sku.id = b.product_sku_id
    JOIN public.products p ON p.id = sku.product_id
    LEFT JOIN public.batch_stock bs ON bs.batch_id = b.id
    LEFT JOIN public.locations loc ON loc.id = bs.location_id
    WHERE b.status NOT IN ('exhausted')
  ) LOOP

    -- If stock is exhausted, resolve active alert
    IF r.remaining_qty <= 0 THEN
      UPDATE public.expiry_alerts
      SET status = 'resolved',
          resolved_at = now(),
          remaining_quantity = 0,
          updated_at = now()
      WHERE batch_id = r.batch_id
        AND alert_type = 'staff'
        AND status IN ('active', 'acknowledged');

      IF FOUND THEN
        v_staff_alerts_resolved := v_staff_alerts_resolved + 1;
      END IF;
      CONTINUE;
    END IF;

    -- If expired
    IF r.days_remaining < 0 THEN
      UPDATE public.batches 
      SET status = 'expired', updated_at = now() 
      WHERE id = r.batch_id AND status != 'expired';

      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE organization_id = r.organization_id
        AND batch_id = r.batch_id
        AND alert_type = 'staff'
        AND threshold_days = -1
        AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ ' || r.product_name || ' batch ' || r.batch_number || ' has EXPIRED';
        v_msg := 'Remaining stock: ' || r.remaining_qty || ' units. Location: ' || COALESCE(r.location_name, 'Finished Goods Storage') || '. Expiry: ' || to_char(r.expiry_date, 'DD Mon YYYY') || '.';

        IF v_admin_profile_id IS NOT NULL THEN
          INSERT INTO public.notifications (
            organization_id, recipient_user_id, title, message, type, channel, reference_type, reference_id, created_at
          ) VALUES (
            r.organization_id, v_admin_profile_id, v_title, v_msg, 'expiry', 'in_app', 'batches', r.batch_id, now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id, batch_id, product_id, location_id, quantity, remaining_quantity,
          threshold_days, expiry_date, severity, status, alert_type, notification_id, generated_at, updated_at
        ) VALUES (
          r.organization_id, r.batch_id, r.product_id, r.location_id, r.remaining_qty, r.remaining_qty,
          -1, r.expiry_date, 'expired', 'active', 'staff', v_notif_id, now(), now()
        ) ON CONFLICT DO NOTHING;

        v_staff_alerts_created := v_staff_alerts_created + 1;
      END IF;
      CONTINUE;
    END IF;

    -- Active shelf life matching against product rule
    SELECT * INTO v_rule
    FROM public.expiry_rules
    WHERE product_id = r.product_id AND organization_id = r.organization_id AND enabled = true
    LIMIT 1;

    IF v_rule IS NULL THEN
      v_rule.alert_1_days := 10;
      v_rule.alert_2_days := 5;
      v_rule.alert_3_days := 3;
    END IF;

    v_threshold := NULL;
    v_severity := NULL;

    IF r.days_remaining <= v_rule.alert_3_days THEN
      v_threshold := v_rule.alert_3_days;
      v_severity := 'critical';
    ELSIF r.days_remaining <= v_rule.alert_2_days THEN
      v_threshold := v_rule.alert_2_days;
      v_severity := 'warning';
    ELSIF r.days_remaining <= v_rule.alert_1_days THEN
      v_threshold := v_rule.alert_1_days;
      v_severity := 'upcoming';
    END IF;

    IF v_threshold IS NOT NULL THEN
      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE organization_id = r.organization_id
        AND batch_id = r.batch_id
        AND alert_type = 'staff'
        AND threshold_days = v_threshold
        AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ ' || r.product_name || ' batch ' || r.batch_number || ' is expiring in ' || r.days_remaining || ' days';
        v_msg := 'Freshness threshold ' || v_threshold || 'd triggered. Available stock: ' || r.remaining_qty || ' units at ' || COALESCE(r.location_name, 'Cold Storage') || '.';

        IF v_admin_profile_id IS NOT NULL THEN
          INSERT INTO public.notifications (
            organization_id, recipient_user_id, title, message, type, channel, reference_type, reference_id, created_at
          ) VALUES (
            r.organization_id, v_admin_profile_id, v_title, v_msg, 'expiry', 'in_app', 'batches', r.batch_id, now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id, batch_id, product_id, location_id, quantity, remaining_quantity,
          threshold_days, expiry_date, severity, status, alert_type, notification_id, generated_at, updated_at
        ) VALUES (
          r.organization_id, r.batch_id, r.product_id, r.location_id, r.remaining_qty, r.remaining_qty,
          v_threshold, r.expiry_date, v_severity, 'active', 'staff', v_notif_id, now(), now()
        ) ON CONFLICT DO NOTHING;

        v_staff_alerts_created := v_staff_alerts_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- PHASE 2: CUSTOMER DELIVERED BATCH EVALUATION
  FOR c_rec IN (
    SELECT 
      cpb.id AS cpb_id,
      cpb.organization_id,
      cpb.customer_id,
      cpb.product_id,
      cpb.batch_id,
      cpb.quantity_remaining,
      cpb.expiry_date,
      p.name AS product_name,
      b.batch_number,
      c.business_name AS customer_name,
      (cpb.expiry_date - CURRENT_DATE) AS days_remaining
    FROM public.customer_product_batches cpb
    JOIN public.products p ON p.id = cpb.product_id
    JOIN public.batches b ON b.id = cpb.batch_id
    JOIN public.customers c ON c.id = cpb.customer_id
    WHERE cpb.is_current = true AND cpb.tracking_status = 'active'
  ) LOOP

    IF c_rec.quantity_remaining <= 0 THEN
      UPDATE public.customer_product_batches
      SET tracking_status = 'consumed', updated_at = now()
      WHERE id = c_rec.cpb_id;

      UPDATE public.expiry_alerts
      SET status = 'resolved', resolved_at = now(), remaining_quantity = 0, updated_at = now()
      WHERE customer_id = c_rec.customer_id AND product_id = c_rec.product_id AND alert_type = 'customer' AND status IN ('active', 'acknowledged');

      v_customer_alerts_resolved := v_customer_alerts_resolved + 1;
      CONTINUE;
    END IF;

    -- Resolve customer user ID for notifications
    SELECT auth_user_id INTO v_customer_user_id
    FROM public.customer_users
    WHERE customer_id = c_rec.customer_id AND is_active = true
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1;

    -- Expired customer stock
    IF c_rec.days_remaining < 0 THEN
      UPDATE public.customer_product_batches
      SET tracking_status = 'expired', updated_at = now()
      WHERE id = c_rec.cpb_id;

      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE customer_id = c_rec.customer_id AND product_id = c_rec.product_id AND batch_id = c_rec.batch_id AND threshold_days = -1 AND alert_type = 'customer' AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ Your ' || c_rec.product_name || ' has EXPIRED';
        v_msg := 'Remaining in-store quantity: ' || c_rec.quantity_remaining || ' units from batch ' || c_rec.batch_number || '. Product is past expiry date (' || to_char(c_rec.expiry_date, 'DD Mon YYYY') || ').';

        IF v_customer_user_id IS NOT NULL THEN
          INSERT INTO public.notifications (
            organization_id, recipient_user_id, customer_id, title, message, type, channel, reference_type, reference_id, created_at
          ) VALUES (
            c_rec.organization_id, v_customer_user_id, c_rec.customer_id, v_title, v_msg, 'expiry', 'in_app', 'batches', c_rec.batch_id, now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id, customer_id, product_id, batch_id, quantity, remaining_quantity,
          threshold_days, expiry_date, severity, status, alert_type, notification_id, customer_product_batch_id, generated_at, updated_at
        ) VALUES (
          c_rec.organization_id, c_rec.customer_id, c_rec.product_id, c_rec.batch_id, c_rec.quantity_remaining, c_rec.quantity_remaining,
          -1, c_rec.expiry_date, 'expired', 'active', 'customer', v_notif_id, c_rec.cpb_id, now(), now()
        ) ON CONFLICT DO NOTHING;

        v_customer_alerts_created := v_customer_alerts_created + 1;
      END IF;
      CONTINUE;
    END IF;

    -- Active customer batch threshold evaluation
    SELECT * INTO v_rule
    FROM public.expiry_rules
    WHERE product_id = c_rec.product_id AND organization_id = c_rec.organization_id AND enabled = true
    LIMIT 1;

    IF v_rule IS NULL THEN
      v_rule.alert_1_days := 10;
      v_rule.alert_2_days := 5;
      v_rule.alert_3_days := 3;
    END IF;

    v_threshold := NULL;
    v_severity := NULL;

    IF c_rec.days_remaining <= v_rule.alert_3_days THEN
      v_threshold := v_rule.alert_3_days;
      v_severity := 'critical';
    ELSIF c_rec.days_remaining <= v_rule.alert_2_days THEN
      v_threshold := v_rule.alert_2_days;
      v_severity := 'warning';
    ELSIF c_rec.days_remaining <= v_rule.alert_1_days THEN
      v_threshold := v_rule.alert_1_days;
      v_severity := 'upcoming';
    END IF;

    IF v_threshold IS NOT NULL THEN
      SELECT id INTO v_existing_alert_id
      FROM public.expiry_alerts
      WHERE customer_id = c_rec.customer_id AND product_id = c_rec.product_id AND batch_id = c_rec.batch_id AND threshold_days = v_threshold AND alert_type = 'customer' AND status IN ('active', 'acknowledged')
      LIMIT 1;

      IF v_existing_alert_id IS NULL THEN
        v_title := '⚠ Your ' || c_rec.product_name || ' is expiring in ' || c_rec.days_remaining || ' days';
        v_msg := 'Batch ' || c_rec.batch_number || ' reaches expiration on ' || to_char(c_rec.expiry_date, 'DD Mon YYYY') || '. Remaining store inventory: ' || c_rec.quantity_remaining || ' units.';

        IF v_customer_user_id IS NOT NULL THEN
          INSERT INTO public.notifications (
            organization_id, recipient_user_id, customer_id, title, message, type, channel, reference_type, reference_id, created_at
          ) VALUES (
            c_rec.organization_id, v_customer_user_id, c_rec.customer_id, v_title, v_msg, 'expiry', 'in_app', 'batches', c_rec.batch_id, now()
          ) RETURNING id INTO v_notif_id;
        END IF;

        INSERT INTO public.expiry_alerts (
          organization_id, customer_id, product_id, batch_id, quantity, remaining_quantity,
          threshold_days, expiry_date, severity, status, alert_type, notification_id, customer_product_batch_id, generated_at, updated_at
        ) VALUES (
          c_rec.organization_id, c_rec.customer_id, c_rec.product_id, c_rec.batch_id, c_rec.quantity_remaining, c_rec.quantity_remaining,
          v_threshold, c_rec.expiry_date, v_severity, 'active', 'customer', v_notif_id, c_rec.cpb_id, now(), now()
        ) ON CONFLICT DO NOTHING;

        v_customer_alerts_created := v_customer_alerts_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'staff_alerts_created', v_staff_alerts_created,
    'staff_alerts_resolved', v_staff_alerts_resolved,
    'customer_alerts_created', v_customer_alerts_created,
    'customer_alerts_resolved', v_customer_alerts_resolved,
    'cleanup', v_cleanup_res,
    'evaluated_at', now()
  );
END;
$$;

-- 8. Configure Hourly pg_cron Job for Cleanup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-read-notifications-every-hour') 
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-read-notifications-every-hour');

    PERFORM cron.schedule(
      'cleanup-read-notifications-every-hour',
      '0 * * * *',
      'SELECT public.cleanup_read_notifications_and_alerts();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;

-- 9. Immediate cleanup of notifications/alerts read > 24 hours ago
-- First, mark alerts whose notification was already read as acknowledged
UPDATE public.expiry_alerts ea
SET status = 'acknowledged',
    acknowledged_at = n.read_at,
    updated_at = now()
FROM public.notifications n
WHERE ea.notification_id = n.id AND n.read_at IS NOT NULL AND ea.status IN ('active', 'expired');

-- Then execute the 24-hour cleanup
SELECT public.cleanup_read_notifications_and_alerts();
