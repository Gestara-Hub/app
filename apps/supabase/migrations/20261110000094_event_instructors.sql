-- =============================================================================
-- Migration: 20261110000094_event_instructors.sql
-- Description: Mais de uma pessoa conduzindo o evento (doc product/29, decidido
--   em 10/11/2026). Seminario com um sensei por dia, aulao com dois professores
--   no mesmo bloco. O evento passa a ter a lista de quem conduz (`instructors`,
--   jsonb: cada item e alguem da equipe ou um convidado pelo nome) e cada dia
--   pode dizer quem conduz aquele bloco (`instructor_ids`, jsonb com os ids da
--   lista; vazio = todos). Mesmo formato de `event_registrations.session_ids`:
--   sem tabela nova, a gravacao do mundo (apply_world_changes) nao muda.
--   Os eventos atuais viram uma lista de uma pessoa so, sem perda.
-- =============================================================================

-- 1. Lista de quem conduz no evento.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS instructors jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.events
SET instructors = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'professionalId', instructor_id,
      'guestName', guest_instructor_name,
      'guestOrigin', guest_instructor_origin
    )
  )
)
WHERE instructors = '[]'::jsonb;

-- 2. Pelo menos uma pessoa (substitui a regra "equipe ou convidado").
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_instructor;
ALTER TABLE public.events ADD CONSTRAINT events_instructors_not_empty
  CHECK (jsonb_typeof(instructors) = 'array' AND jsonb_array_length(instructors) > 0);

-- 3. As colunas de uma pessoa so saem (o dado ja esta na lista).
DROP INDEX IF EXISTS public.idx_events_instructor;
ALTER TABLE public.events DROP COLUMN IF EXISTS instructor_id;
ALTER TABLE public.events DROP COLUMN IF EXISTS guest_instructor_name;
ALTER TABLE public.events DROP COLUMN IF EXISTS guest_instructor_origin;

-- 4. Quem conduz cada dia (ids da lista do evento; nulo ou vazio = todos).
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS instructor_ids jsonb;
