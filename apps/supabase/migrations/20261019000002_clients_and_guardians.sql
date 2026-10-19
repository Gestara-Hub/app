-- Migration: 20261019000002_clients_and_guardians.sql
-- Description: Fatia 2 — Tabela de Alunos (clients) com responsáveis, endereço, dados financeiros, evoluções e RLS multi-tenant

CREATE TABLE public.clients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  birth_date date,
  guardians jsonb,
  notes text,
  address jsonb,
  -- Gestão de planos e mensalidade
  plan_id text,
  plan_start_date date,
  billing_strategy text,
  cycle_payment_timing text,
  due_day integer NOT NULL DEFAULT 10 CHECK (due_day >= 1 AND due_day <= 31),
  discount jsonb,
  membership_status text NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'paused', 'canceled')),
  -- Evolução por modalidade (faixas, graus, metas de treino e avaliações)
  progressions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices de performance multi-tenant
CREATE INDEX idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX idx_clients_status ON public.clients(organization_id, status);
CREATE INDEX idx_clients_name ON public.clients(organization_id, name);
CREATE INDEX idx_clients_phone ON public.clients(organization_id, phone);

-- Gatilho para manter updated_at atualizado automaticamente
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Habilita Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso por tenant (RLS)
CREATE POLICY clients_select_own ON public.clients
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

CREATE POLICY clients_insert_own ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

CREATE POLICY clients_update_own ON public.clients
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager', 'attendant', 'professional')
  );

CREATE POLICY clients_delete_own ON public.clients
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.current_user_profile() IN ('owner', 'manager')
  );
