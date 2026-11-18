-- Situacao do numero e da conta do WhatsApp do espaco na Meta (17/11/2026, doc
-- technical/07 §1.6): envio liberado, limitado ou bloqueado, bloqueio por falta
-- de pagamento, nome exibido, qualidade e limite diario. Gravada ao conectar,
-- de hora em hora pela rotina e no botao "Atualizar" da Conexao.
alter table public.whatsapp_connections
  add column if not exists meta_health jsonb;
