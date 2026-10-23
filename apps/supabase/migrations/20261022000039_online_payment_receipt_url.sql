-- Migration: 20261022000039_online_payment_receipt_url.sql
-- Comprovante do pagamento online: endereco publico do comprovante no parceiro
-- (transactionReceiptUrl do aviso de pagamento do Asaas). A pagina /p/<codigo>
-- paga mostra o botao "Ver comprovante".
alter table public.online_payments
  add column if not exists receipt_url text;
