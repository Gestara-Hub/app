-- =============================================================================
-- Migration: 20261021000033_select_policies_by_profile.sql
-- Description: Doc 15, fatia 3. O servidor le o espaco com a chave de servico
--              (depois de conferir sessao e permissao), entao o RLS de leitura
--              passa a seguir as permissoes do app para o acesso direto do
--              navegador (lib/permissions.ts):
--              - alunos: clients:view (dono, gerente, recepcao);
--              - cobrancas, pagamentos online e pacotes do aluno: billing:view
--                (dono, gerente, recepcao);
--              - auditoria: audit:view (dono e gerente);
--              - usuarios: dono e gerente veem todos; os demais, so a si.
-- =============================================================================

DROP POLICY IF EXISTS clients_select_own ON public.clients;
CREATE POLICY clients_select_own ON public.clients
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS charges_select_own ON public.charges;
CREATE POLICY charges_select_own ON public.charges
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS online_payments_select_own ON public.online_payments;
CREATE POLICY online_payments_select_own ON public.online_payments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS student_packages_select_own ON public.student_packages;
CREATE POLICY student_packages_select_own ON public.student_packages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager', 'attendant'));

DROP POLICY IF EXISTS audit_logs_isolation_select ON public.audit_logs;
CREATE POLICY audit_logs_isolation_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.current_user_profile() IN ('owner', 'manager'));

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.current_user_profile() IN ('owner', 'manager') OR auth_user_id = auth.uid() OR id = auth.uid()::text)
  );
