-- Painel admin le as notas fiscais do plano (aba Assinatura do espaco, doc
-- technical/24 §7.1). A migracao 108 criou a tabela sem a leitura do papel do
-- painel (`platform_app`): a aba quebrava com "permission denied" (25/11/2026).
-- So leitura; quem grava e o servidor do app (service_role).

GRANT SELECT ON public.platform_invoices TO platform_app;

DROP POLICY IF EXISTS platform_invoices_platform_app_select ON public.platform_invoices;
CREATE POLICY platform_invoices_platform_app_select ON public.platform_invoices
  FOR SELECT TO platform_app USING (true);
