-- Migration: 20261112000097_event_public_signup.sql
-- Inscricao publica por link, vaga garantida e ingresso com QR code
-- (doc product/29, "Proposta: inscricao publica por link", aprovada em 12/11/2026).

-- 1. Evento: link publico, quando a vaga fica garantida e o tempo da reserva.
ALTER TABLE public.events
  -- { enabled: bool, code: text, until?: date }
  ADD COLUMN IF NOT EXISTS public_signup jsonb,
  ADD COLUMN IF NOT EXISTS seat_guarantee text NOT NULL DEFAULT 'on_signup'
    CHECK (seat_guarantee IN ('on_signup', 'on_payment')),
  ADD COLUMN IF NOT EXISTS hold_minutes integer NOT NULL DEFAULT 30
    CHECK (hold_minutes IN (15, 30, 60));

CREATE UNIQUE INDEX IF NOT EXISTS events_public_signup_code_idx
  ON public.events ((public_signup ->> 'code'))
  WHERE public_signup ->> 'code' IS NOT NULL;

-- 2. Inscricao: reserva ate pagar, de onde veio, ingresso e a prova do aceite.
ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE public.event_registrations ADD CONSTRAINT event_registrations_status_check
  CHECK (status IN ('confirmed', 'reserved', 'waitlist', 'canceled'));

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'public_link')),
  ADD COLUMN IF NOT EXISTS hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_code text,
  -- Aceite da inscricao pelo link (e do responsavel, no menor): texto, data e IP.
  ADD COLUMN IF NOT EXISTS signup_evidence jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_ticket_code_idx
  ON public.event_registrations (ticket_code)
  WHERE ticket_code IS NOT NULL;

-- 3. Entrada pelo ingresso: quando e quem confirmou (a segunda leitura responde "Ja entrou").
ALTER TABLE public.event_attendances
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by text;
