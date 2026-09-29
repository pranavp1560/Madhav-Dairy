-- =============================================================================
-- Migration 014: Expiry Rules, Freshness Radar Alerts, and Notifications
-- Module: Cold-Chain Food Quality & Multichannel Notifications
-- =============================================================================

-- Automated regulatory expiry monitoring rules
CREATE TABLE IF NOT EXISTS public.expiry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  days_before_expiry integer NOT NULL CHECK (days_before_expiry >= 0),
  severity text NOT NULL CHECK (severity IN ('urgent', 'soon', 'upcoming', 'expired')),
  target_customer boolean DEFAULT false NOT NULL,
  target_internal boolean DEFAULT true NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_expiry_rules_updated_at
  BEFORE UPDATE ON public.expiry_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Active generated expiry risk incidents (Freshness Radar)
CREATE TABLE IF NOT EXISTS public.expiry_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity >= 0),
  severity text NOT NULL CHECK (severity IN ('urgent', 'soon', 'upcoming', 'expired')),
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'acknowledged', 'resolved')),
  generated_at timestamptz DEFAULT now() NOT NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Multichannel notification logs (In-App, Push, WhatsApp, SMS data model)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('expiry', 'order', 'product', 'payment', 'system')),
  channel text DEFAULT 'in_app' NOT NULL CHECK (channel IN ('in_app', 'push', 'whatsapp', 'sms')),
  reference_type text, -- e.g. 'orders', 'invoices', 'batches'
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance and FK integrity
CREATE INDEX IF NOT EXISTS idx_expiry_rules_org ON public.expiry_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_expiry_rules_enabled ON public.expiry_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_batch ON public.expiry_alerts(batch_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_loc ON public.expiry_alerts(location_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_customer ON public.expiry_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_status ON public.expiry_alerts(status);
CREATE INDEX IF NOT EXISTS idx_expiry_alerts_severity ON public.expiry_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);
