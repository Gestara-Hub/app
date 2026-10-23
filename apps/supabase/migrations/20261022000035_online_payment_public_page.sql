-- Migration: 20261022000035_online_payment_public_page.
-- Pagina publica da cobranca online (/p/<codigo>): o aluno recebe um endereco
-- do GestaraHub em vez do link do Asaas ou do Pix solto. A pagina confere se o
-- codigo ainda vale (vencido: "peca um novo"; pago: "ja esta paga"), mostra o
-- Pix com QR e copia e cola, ou leva a fatura do cartao.
--  - public_code: codigo curto e aleatorio do endereco (gerado pelo app);
--  - opened_at: primeira vez que o aluno abriu a pagina.

alter table public.online_payments
  add column if not exists public_code text,
  add column if not exists opened_at timestamptz;

-- Pagamentos ja criados ganham um codigo (12 caracteres hex, aleatorios).
update public.online_payments
  set public_code = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12)
  where public_code is null;

create unique index if not exists uq_online_payments_public_code
  on public.online_payments(public_code)
  where public_code is not null;
