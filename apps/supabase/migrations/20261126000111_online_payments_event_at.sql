-- Historico de Recebimentos online (26/11/2026): a data mostrada e a ordem da
-- lista vem do ultimo acontecimento do pagamento: estorno ou contestacao,
-- pagamento ou criacao do codigo. Antes a lista ordenava pela criacao e
-- mostrava a hora do pagamento (um boleto pago depois aparecia abaixo).
ALTER TABLE public.online_payments
  ADD COLUMN IF NOT EXISTS event_at timestamptz
  GENERATED ALWAYS AS (COALESCE(disputed_at, paid_at, created_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_online_payments_event_at
  ON public.online_payments (organization_id, event_at DESC);
