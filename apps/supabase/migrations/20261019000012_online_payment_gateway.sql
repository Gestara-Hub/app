-- Migration: 20261019000012_online_payment_gateway.sql
-- Infraestrutura neutra de gateways de pagamento online (Asaas, PagBank, etc.)
-- Suporta subcontas de organizações, identificadores de pagadores e transações online.

-- 1. Campos de Gateway na tabela de organizações (Subcontas / Marketplace)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gateway_provider text DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS gateway_account_id text,
  ADD COLUMN IF NOT EXISTS gateway_wallet_id text,
  ADD COLUMN IF NOT EXISTS gateway_status text DEFAULT 'not_configured';

CREATE INDEX IF NOT EXISTS idx_organizations_gateway_account 
  ON public.organizations(gateway_provider, gateway_account_id);

-- 2. Identificador de pagador na tabela de clientes (Alunos)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gateway_customer_id text;

CREATE INDEX IF NOT EXISTS idx_clients_gateway_customer 
  ON public.clients(organization_id, gateway_customer_id);

-- 3. Tabela de Pagamentos Online (online_payments) agnóstica a provedor
CREATE TABLE IF NOT EXISTS public.online_payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  charge_id text NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  client_id text REFERENCES public.clients(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'pix' CHECK (method IN ('pix', 'link')),
  status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'paid', 'expired', 'canceled')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  split_amount_cents integer DEFAULT 0,
  net_amount_cents integer DEFAULT 0,
  gateway_provider text NOT NULL DEFAULT 'asaas',
  gateway_payment_id text,
  pix_copy_paste text,
  pix_qr_code_base64 text,
  link_url text,
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_payments_org 
  ON public.online_payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_online_payments_charge 
  ON public.online_payments(charge_id);

CREATE INDEX IF NOT EXISTS idx_online_payments_gateway 
  ON public.online_payments(gateway_provider, gateway_payment_id);

-- Trigger de updated_at para online_payments
CREATE TRIGGER trg_online_payments_updated_at
  BEFORE UPDATE ON public.online_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS para online_payments
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY online_payments_select_own ON public.online_payments
  FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());

CREATE POLICY online_payments_manage_own ON public.online_payments
  FOR ALL TO authenticated
  USING (
    organization_id = current_organization_id() AND
    current_user_profile() = ANY (ARRAY['owner'::text, 'manager'::text])
  )
  WITH CHECK (
    organization_id = current_organization_id() AND
    current_user_profile() = ANY (ARRAY['owner'::text, 'manager'::text])
  );
