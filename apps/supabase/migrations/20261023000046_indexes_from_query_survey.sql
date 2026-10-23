-- =============================================================================
-- Migration: 20261023000046_indexes_from_query_survey.sql
-- Description: Doc 19, secao 13: levantamento geral de indices. Espaco de 1 ano
--   (28 mil presencas, 30 mil eventos de auditoria, 6 mil mensagens), as acoes
--   reais do app medidas com pg_stat_statements e EXPLAIN ANALYZE. Os indices
--   seguem a forma das consultas do codigo, nao a contagem de uso local (no
--   banco local um espaco tem quase todas as linhas; em producao o filtro por
--   espaco separa muito mais).
--
--   1. (organization_id, id) em toda tabela do espaco. A carga do espaco
--      inteiro e o `load.all` dos recortes leem "linhas do espaco, por id, de mil
--      em mil": sem esse indice, cada pagina ordenava todas as linhas do espaco
--      (nas presencas, ordenacao em disco). Substitui o indice so de
--      organization_id, que vira prefixo deste.
--   2. Auditoria: a carga parcial (so dos lancamentos, `target->>'type'`, em
--      toda carga do espaco) lia o historico inteiro e descartava o resto; o
--      GIN em `target` nao atende esse filtro e nenhuma consulta usa
--      "contem" (sai: pesava em toda gravacao da tabela que mais cresce).
--      A pagina da tela ordena por data e id: o indice passa a ter o id.
--   3. Mensagens: a pagina ordena por data e id (indice com o id) e o painel
--      le por gatilho (parabens, faltas, pacote acabando).
--   4. Duplicados: presencas por aula e substituicoes por aula ja estao
--      cobertos pelos indices unicos (organization_id, session_id, ...).
--
--   Sem CONCURRENTLY: a migracao roda em transacao e, na primeira publicacao,
--   as tabelas de producao estao vazias. Para recriar com dados, rodar a mao
--   com CREATE INDEX CONCURRENTLY.
-- =============================================================================

-- 1. (organization_id, chave) nas tabelas do espaco -----------------------------
DO $$
DECLARE
  v_table text;
  v_pk text;
  v_single text;
  v_tables constant text[] := ARRAY[
    'roles', 'users', 'categories', 'professionals', 'clients', 'plans', 'lesson_packages', 'student_packages',
    'charges', 'class_groups', 'enrollments', 'attendances', 'waitlist', 'class_reservations',
    'class_session_overrides', 'assessments', 'financial_categories', 'financial_recurrences', 'financial_entries',
    'teacher_pay_rules', 'teacher_payouts', 'online_payments', 'message_templates', 'message_logs', 'units'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT a.attname INTO v_pk
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE i.indrelid = format('public.%I', v_table)::regclass AND i.indisprimary;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id, %I)', 'idx_' || v_table || '_org_pk', v_table, v_pk);
    -- O indice so de organization_id vira prefixo do novo.
    FOR v_single IN
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = v_table
         AND indexdef ~ '\(organization_id\)$' AND indexdef !~ 'UNIQUE'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', v_single);
    END LOOP;
  END LOOP;
END;
$$;

-- 2. Auditoria -------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_audit_logs_target;
DROP INDEX IF EXISTS public.idx_audit_logs_organization_timestamp;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time
  ON public.audit_logs (organization_id, "timestamp" DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_type_time
  ON public.audit_logs (organization_id, (target->>'type'), "timestamp" DESC, id DESC);

-- 3. Mensagens -------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_message_logs_sent_at;
CREATE INDEX IF NOT EXISTS idx_message_logs_org_sent
  ON public.message_logs (organization_id, sent_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_org_trigger
  ON public.message_logs (organization_id, trigger);

-- 4. Duplicados ------------------------------------------------------------------
-- (organization_id, session_id) e prefixo do unico (organization_id, session_id, student_id).
DROP INDEX IF EXISTS public.idx_attendances_session;
-- Igual ao unico (organization_id, session_id) da tabela.
DROP INDEX IF EXISTS public.idx_session_overrides_org_session;

ANALYZE public.attendances, public.audit_logs, public.message_logs, public.charges, public.clients, public.enrollments;
