-- Devolucao de pagamento (26/11/2026, doc product/15 "Estorno de pagamento").
-- Cobranca devolvida e encerrada ganha a situacao 'refunded'; cada devolucao
-- (quando, quanto, como e o que foi decidido) fica em `refunds`. No pagamento
-- online, `refund_handled_at` marca o estorno ja resolvido na cobranca (o aviso
-- de estorno some).

ALTER TABLE public.charges DROP CONSTRAINT IF EXISTS charges_status_check;
ALTER TABLE public.charges ADD CONSTRAINT charges_status_check
  CHECK (status IN ('pending', 'paid', 'overdue', 'canceled', 'waived', 'refunded'));

ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS refunds jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS refund_handled_at timestamptz;
