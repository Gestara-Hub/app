-- Migration: 20261113000098_enrollment_moved_to.sql
-- Mudar de turma (doc product/30 §2, decidido em 13/11/2026): a matricula
-- antiga fecha como encerrada ('canceled') com a turma para onde o aluno foi.
-- Nao e saida do aluno: relatorios e Auditoria leem esta coluna.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS moved_to_class_group_id text
    REFERENCES public.class_groups(id) ON DELETE SET NULL;
