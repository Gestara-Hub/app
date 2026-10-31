-- =============================================================================
-- Migration: 20261031000076_server_only_writes.sql
-- Description: revisao geral de 31/10/2026 (achados S3 e S6).
--   S3: o app grava estas tabelas so pelo servidor (apply_world_changes ou a
--   chave de servico), mas o usuario logado ainda podia escrever direto pelo
--   PostgREST e pular validacao e auditoria (ex.: atendente mudando
--   charges_from ou a graduacao do aluno; professor reescrevendo notas de
--   qualquer turma). Como na migracao 69 para as tabelas de turma: sem
--   INSERT, UPDATE, DELETE e TRUNCATE para anon e authenticated.
--   Ficam de fora as tabelas que algumas actions ainda gravam com o cliente do
--   usuario: categories, roles, professionals, plans, lesson_packages,
--   attachments e online_payments (proximo passo: passar para o servidor).
--   S6: leitura direta pelo banco. Professor nao le notas nem testes e medidas
--   do espaco inteiro (as telas leem pelo servidor, com o escopo dele); os
--   aceites de termos (IP, navegador, dados do responsavel) so dono e gerente.
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.assessments,
  public.clients,
  public.charges,
  public.financial_entries,
  public.financial_recurrences,
  public.financial_categories,
  public.student_packages,
  public.teacher_payouts,
  public.teacher_pay_rules,
  public.class_groups,
  public.units,
  public.users,
  public.message_templates,
  public.message_logs,
  public.whatsapp_connections
FROM anon, authenticated;

-- Escrita revogada: a politica FOR ALL de avaliacoes so dava leitura ao professor.
DROP POLICY IF EXISTS assessments_manage_own ON public.assessments;

DROP POLICY IF EXISTS assessments_select_own ON public.assessments;
CREATE POLICY assessments_select_own ON public.assessments
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_organization_id())
    AND (SELECT public.current_user_profile()) IN ('owner', 'manager', 'attendant')
  );

DROP POLICY IF EXISTS student_measurements_select_own ON public.student_measurements;
CREATE POLICY student_measurements_select_own ON public.student_measurements
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_organization_id())
    AND (SELECT public.current_user_profile()) IN ('owner', 'manager', 'attendant')
  );

DROP POLICY IF EXISTS legal_consents_isolation_select ON public.legal_consents;
CREATE POLICY legal_consents_isolation_select ON public.legal_consents
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_organization_id())
    AND (SELECT public.current_user_profile()) IN ('owner', 'manager')
  );
