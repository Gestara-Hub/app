-- =============================================================================
-- Migration: 20261025000067_bug_lifecycle.sql
-- Description: Andamento de um problema relatado (doc technical/26). Os estados
--   da conversa sao de atendimento (com a equipe, aguardando o cliente); um bug
--   tem o seu proprio caminho: novo, investigando, corrigido, nao reproduzi.
--   "Corrigido" guarda quando e em que versao; se o erro ligado ao relato
--   voltar depois disso, o painel avisa (a conta e feita na leitura, pelas
--   ocorrencias de `error_occurrences`). Sem valor = conversa que nao e bug, ou
--   bug ainda sem triagem (o painel le como "novo").
-- =============================================================================

ALTER TABLE platform.support_threads
  ADD COLUMN IF NOT EXISTS bug_status text,
  ADD COLUMN IF NOT EXISTS fixed_in text,
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz;

ALTER TABLE platform.support_threads
  ADD CONSTRAINT support_threads_bug_status_check
    CHECK (bug_status IS NULL OR bug_status IN ('new', 'investigating', 'fixed', 'cannot_reproduce')),
  ADD CONSTRAINT support_threads_bug_only_check
    CHECK (bug_status IS NULL OR kind = 'bug'),
  ADD CONSTRAINT support_threads_fixed_check
    CHECK ((bug_status = 'fixed') OR (fixed_in IS NULL AND fixed_at IS NULL));
