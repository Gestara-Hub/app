-- =============================================================================
-- Migration: 20261109000093_online_payment_disputes.sql
-- Description: Estorno e contestacao do parceiro de pagamentos (doc product/25,
--   niveis e urgencia). O webhook grava o ultimo aviso no pagamento online; a
--   cobranca continua paga e o dono decide (sino, aviso fixo e modal).
-- =============================================================================

ALTER TABLE public.online_payments
  ADD COLUMN IF NOT EXISTS dispute_status text CHECK (dispute_status IS NULL OR dispute_status IN (
    'refund_in_progress', 'refunded', 'chargeback_requested', 'chargeback_dispute', 'chargeback_reversal_pending'
  )),
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_online_payments_dispute
  ON public.online_payments(organization_id, dispute_status)
  WHERE dispute_status IS NOT NULL;
