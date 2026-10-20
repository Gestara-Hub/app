-- Adiciona coluna de motivo de cancelamento em online_payments
ALTER TABLE public.online_payments 
ADD COLUMN IF NOT EXISTS canceled_reason text;

COMMENT ON COLUMN public.online_payments.canceled_reason IS 'Motivo pelo qual o código/link de pagamento online foi cancelado (ex: baixa manual da cobrança, gerado novo código, cobrança cancelada).';
