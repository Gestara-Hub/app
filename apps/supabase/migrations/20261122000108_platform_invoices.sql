-- Notas fiscais (NFS-e) do Plano GestaraHub, emitidas pela conta principal do
-- Asaas (doc technical/24 §7.1, 22/11/2026). Uma nota por pagamento confirmado
-- do plano: renovacao da assinatura ou diferenca da troca de plano.
-- So o servidor le e grava (a tela le por uma acao que confere o perfil).

CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('subscription', 'plan_upgrade', 'platform_fees', 'addon')),
  -- Vazio enquanto o pedido ao Asaas nao voltou (ou falhou ao criar).
  asaas_invoice_id text UNIQUE,
  asaas_payment_id text,
  external_reference text,
  status text NOT NULL CHECK (status IN (
    'requesting',               -- pedido ao Asaas em andamento
    'scheduled',                -- agendada no Asaas
    'synchronized',             -- enviada a prefeitura
    'authorized',               -- emitida
    'processing_cancellation',  -- cancelamento pedido
    'canceled',                 -- cancelada
    'cancellation_denied',      -- cancelamento recusado
    'error'                     -- recusada pela prefeitura ou pelo Asaas
  )),
  amount_cents integer NOT NULL,
  service_description text NOT NULL,
  effective_date date,
  invoice_number text,
  validation_code text,
  pdf_url text,
  xml_url text,
  -- Motivo da recusa (prefeitura ou Asaas).
  status_description text,
  -- Pedidos de criacao que falharam (a rotina diaria tenta de novo ate 5).
  attempts integer NOT NULL DEFAULT 0,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma nota valida por cobranca: o polling e o webhook confirmam o mesmo
-- pagamento ao mesmo tempo, e so um pedido chega ao Asaas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_invoices_payment_active
  ON public.platform_invoices (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL AND status <> 'canceled';

-- "Notas fiscais" (Configuracoes -> Plano e painel): espaco + mais recente primeiro.
CREATE INDEX IF NOT EXISTS idx_platform_invoices_org_time
  ON public.platform_invoices (organization_id, created_at DESC);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
