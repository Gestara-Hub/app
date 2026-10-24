-- =============================================================================
-- Migration: 20261023000049_background_history.sql
-- Description: Historico do que acontece sem acao de pessoa (doc technical/23).
--   1. Auditoria aceita o "sistema" como autor (rotina diaria, parceiro de
--      pagamentos), com a origem tecnica e, quando falha, o codigo do registro
--      de erros. Continua so do servidor (chave de servico), sem UPDATE/DELETE.
--   2. subscription_events: linha do tempo do Plano GestaraHub (para sempre).
--   3. job_runs: uma linha por execucao de rotina (120 dias).
--   4. webhook_events: um aviso do Asaas por linha, com o resultado; o id do
--      evento impede tratar o mesmo aviso duas vezes (120 dias).
--   Os indices seguem as consultas de cada tabela (comentadas em cada um).
-- =============================================================================

-- 1. Auditoria: autor sistema ---------------------------------------------------
ALTER TABLE public.audit_logs
  -- Origem tecnica do evento sem pessoa ("cron.daily", "webhook.asaas"); vazio = pessoa.
  ADD COLUMN IF NOT EXISTS source text,
  -- A tarefa falhou nesse espaco (a linha leva o codigo do erro).
  ADD COLUMN IF NOT EXISTS failed boolean NOT NULL DEFAULT false,
  -- Codigo do registro de erros (error_logs.last_reference) mostrado ao usuario.
  ADD COLUMN IF NOT EXISTS error_reference text;

-- Filtro "Sistema" da Auditoria: espaco + mais recente primeiro, so as linhas
-- sem pessoa (pequena parte da tabela). O filtro "Pessoas" e a lista sem
-- filtro usam o idx_audit_logs_org_time de sempre.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_system_time
  ON public.audit_logs (organization_id, "timestamp" DESC, id DESC)
  WHERE source IS NOT NULL;
-- "So o que falhou", no espaco.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_failed_time
  ON public.audit_logs (organization_id, "timestamp" DESC, id DESC)
  WHERE failed;
-- Suporte: do codigo que o usuario mandou ("K7Q2M9XD") a linha da Auditoria.
CREATE INDEX IF NOT EXISTS idx_audit_logs_error_reference
  ON public.audit_logs (error_reference)
  WHERE error_reference IS NOT NULL;

-- 2. Historico do plano ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'activated',          -- assinou (checkout pago)
    'upgraded',           -- plano maior ou mensal -> anual, pago pela diferenca
    'change_scheduled',   -- reducao marcada para o fim do periodo
    'change_canceled',    -- troca marcada desmarcada
    'change_applied',     -- troca marcada aplicada no dia
    'renewed',            -- renovacao paga
    'renewal_overdue',    -- renovacao vencida sem pagamento
    'reverted_to_free',   -- 5 dias sem pagar: voltou ao Gratis
    'reactivated',        -- pagou a atrasada e religou
    'closed',             -- 15 dias depois de voltar ao Gratis: assinatura encerrada
    'canceled',           -- voltou ao Gratis na hora (demonstracao, conta sem dias pagos)
    'removed_at_partner'  -- assinatura removida direto no Asaas
  )),
  tier_before text,
  tier_after text,
  interval_before text,
  interval_after text,
  amount_cents integer,
  -- Cobranca e assinatura do Asaas ligadas ao evento (diferenca, renovacao).
  asaas_payment_id text,
  asaas_subscription_id text,
  -- Dia em que a troca vale (marcada) ou a renovacao a que se refere.
  effective_on date,
  -- Pessoa ({userId, name, profile}) ou sistema ({kind: "system", name}).
  actor jsonb NOT NULL,
  -- Origem tecnica quando nao foi pessoa; vazio = pessoa.
  source text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Linha da Auditoria gravada junto (o mesmo fato nas duas telas).
  audit_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "Historico do plano" (Configuracoes -> Plano): espaco + mais recente primeiro.
CREATE INDEX IF NOT EXISTS idx_subscription_events_org_time
  ON public.subscription_events (organization_id, created_at DESC, id DESC);
-- Suporte: "o que esta cobranca do Asaas fez?". So eventos com cobranca.
CREATE INDEX IF NOT EXISTS idx_subscription_events_payment
  ON public.subscription_events (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- So o servidor le e grava (a tela le por uma acao que confere o perfil).
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- 3. Execucoes das rotinas -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "cron.daily", "cron.online-payments"
  job text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'partial', 'failed')),
  organizations integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  -- Totais da execucao ("membershipCharges": 340, "plan": {...}).
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Codigos do registro de erros das falhas desta execucao.
  error_references text[] NOT NULL DEFAULT '{}'
);

-- "A rotina rodou? como foi a ultima?": por rotina, mais recente primeiro.
-- Poucas linhas (cerca de 25 por dia): a limpeza por data dispensa indice proprio.
CREATE INDEX IF NOT EXISTS idx_job_runs_job_started
  ON public.job_runs (job, started_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- 4. Avisos do Asaas -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas',
  -- Id do evento no parceiro ("evt_..."): o mesmo aviso pode chegar mais de uma vez.
  event_id text,
  event text NOT NULL,
  payment_id text,
  subscription_id text,
  -- Espaco afetado, quando o tratamento descobre (aluno ou plano).
  organization_id text REFERENCES public.organizations(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  -- O que o tratamento fez, em poucas palavras ("plano: renovacao paga").
  outcome text,
  error_reference text
);

-- Idempotencia: um evento do parceiro por linha (aviso repetido e reconhecido).
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event
  ON public.webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;
-- Suporte: "o que chegou sobre a cobranca pay_..."? (todo evento de cobranca tem).
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment
  ON public.webhook_events (payment_id, received_at DESC)
  WHERE payment_id IS NOT NULL;
-- Avisos de um espaco, mais recente primeiro.
CREATE INDEX IF NOT EXISTS idx_webhook_events_org_received
  ON public.webhook_events (organization_id, received_at DESC)
  WHERE organization_id IS NOT NULL;
-- Ultimos avisos e limpeza de 120 dias (tabela que cresce com o uso).
CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON public.webhook_events (received_at DESC);
-- So os que falharam, para conferir e reprocessar.
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed
  ON public.webhook_events (received_at DESC)
  WHERE status = 'failed';

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Retencao dos registros tecnicos: 120 dias (como o registro de erros). A
-- Auditoria e o historico do plano ficam para sempre.
CREATE OR REPLACE FUNCTION public.prune_background_logs()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH runs AS (
    DELETE FROM public.job_runs WHERE started_at < now() - interval '120 days' RETURNING 1
  ), events AS (
    DELETE FROM public.webhook_events WHERE received_at < now() - interval '120 days' RETURNING 1
  )
  SELECT (SELECT count(*) FROM runs) + (SELECT count(*) FROM events);
$$;

REVOKE ALL ON FUNCTION public.prune_background_logs() FROM public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Todo dia as 03:45 de Brasilia (06:45 UTC). Reagenda se ja existir.
select cron.unschedule(jobid) from cron.job where jobname = 'background-logs-prune-daily';
select cron.schedule('background-logs-prune-daily', '45 6 * * *', 'select public.prune_background_logs()');
