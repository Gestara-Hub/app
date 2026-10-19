-- Migration: 20261019000008_communication_templates_and_logs.sql
-- Description: Fatia 7 — Comunicação (Modelos de Mensagem, Histórico/Logs de Mensagens e Conexão WhatsApp)

-- =============================================================================
-- 1. Conexão do WhatsApp (WhatsApp Connections)
-- =============================================================================
CREATE TABLE public.whatsapp_connections (
  organization_id text PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  official_status text NOT NULL DEFAULT 'not_connected' CHECK (official_status IN ('not_connected', 'pending', 'connected')),
  phone_number text,
  display_name text,
  connected_at timestamptz,
  allowed_send_hours jsonb NOT NULL DEFAULT '{"start": "08:00", "end": "20:00"}'::jsonb,
  monthly_quota jsonb NOT NULL DEFAULT '{"used": 0, "included": 500}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_connections_select_own ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'receptionist')
  );

CREATE POLICY whatsapp_connections_manage_own ON public.whatsapp_connections
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- =============================================================================
-- 2. Modelos de Mensagem (Message Templates)
-- =============================================================================
CREATE TABLE public.message_templates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  category text NOT NULL CHECK (category IN ('billing', 'retention', 'administrative')),
  title text NOT NULL,
  description text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  send_hour text NOT NULL DEFAULT '09:00',
  days_offset integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  available_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_message_templates_org_trigger UNIQUE (organization_id, trigger)
);

CREATE INDEX idx_message_templates_org ON public.message_templates(organization_id);

CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_templates_select_own ON public.message_templates
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'receptionist')
  );

CREATE POLICY message_templates_manage_own ON public.message_templates
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );

-- =============================================================================
-- 3. Histórico de Mensagens / Envios (Message Logs)
-- =============================================================================
CREATE TABLE public.message_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  trigger text NOT NULL,
  category text NOT NULL CHECK (category IN ('billing', 'retention', 'administrative')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'queued', 'sent', 'delivered', 'read', 'failed')),
  client_id text REFERENCES public.clients(id) ON DELETE SET NULL,
  charge_id text REFERENCES public.charges(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_logs_org ON public.message_logs(organization_id);
CREATE INDEX idx_message_logs_sent_at ON public.message_logs(organization_id, sent_at DESC);
CREATE INDEX idx_message_logs_client ON public.message_logs(organization_id, client_id);
CREATE INDEX idx_message_logs_charge ON public.message_logs(organization_id, charge_id);

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_logs_select_own ON public.message_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'receptionist')
  );

CREATE POLICY message_logs_manage_own ON public.message_logs
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'receptionist')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'receptionist')
  );
