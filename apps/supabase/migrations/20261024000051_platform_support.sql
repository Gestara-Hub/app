-- =============================================================================
-- Migration: 20261024000051_platform_support.sql
-- Description: Suporte do GestaraHub (doc technical/26, fase 1): conversas do
--   "Fale com a gente", mensagens do cliente, do bot e do suporte, notas
--   internas, respostas prontas, configuracao e uso do bot. Tudo mora no schema
--   `platform`. O app dos clientes (servidor, com a chave de servico) so entra
--   por funcoes `public.support_*` deste arquivo, uma por acao, que conferem o
--   espaco e o usuario; nenhuma tabela e aberta para a API.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform.settings (key, value) VALUES
  ('support.reply_target_business_days', '2'::jsonb),
  ('support.bot_monthly_budget_cents', '15000'::jsonb),
  ('support.bot_daily_messages_per_user', '30'::jsonb),
  ('support.bot_daily_messages_per_space', '150'::jsonb),
  ('support.notify_email', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  -- Contato da hora da conversa (a pessoa pode mudar o e-mail depois).
  user_name text NOT NULL,
  user_email text NOT NULL,
  user_phone text,
  subject text NOT NULL,
  -- bot: so o bot atendeu; waiting_us: precisa de resposta nossa;
  -- waiting_customer: respondemos e esperamos a pessoa; resolved: encerrada.
  status text NOT NULL DEFAULT 'bot' CHECK (status IN ('bot', 'waiting_us', 'waiting_customer', 'resolved')),
  urgent boolean NOT NULL DEFAULT false,
  summary text,
  origin_screen text,
  error_reference text,
  plan_tier text,
  bot_helped boolean,
  customer_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_customer_message_at timestamptz,
  escalated_at timestamptz,
  first_reply_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_threads_status ON platform.support_threads (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_org ON platform.support_threads (organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_user ON platform.support_threads (user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS platform.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES platform.support_threads(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('customer', 'bot', 'staff', 'system')),
  staff_admin_id uuid,
  staff_name text,
  body text NOT NULL,
  -- Trechos da ajuda que sustentam a resposta do bot ([{title, href}]).
  sources jsonb,
  -- Nota interna: so o painel ve.
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON platform.support_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS platform.support_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gasto do bot por mes ("2026-10"): tokens e custo estimado.
CREATE TABLE IF NOT EXISTS platform.bot_usage (
  month text PRIMARY KEY,
  messages integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0
);

ALTER TABLE platform.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.support_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.bot_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_platform_app ON platform.settings FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY support_threads_platform_app ON platform.support_threads FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY support_messages_platform_app ON platform.support_messages FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY support_macros_platform_app ON platform.support_macros FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY bot_usage_platform_app ON platform.bot_usage FOR ALL TO platform_app USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON platform.settings TO platform_app;
GRANT SELECT, INSERT, UPDATE ON platform.support_threads TO platform_app;
GRANT SELECT, INSERT, UPDATE ON platform.support_messages TO platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.support_macros TO platform_app;
GRANT SELECT, INSERT, UPDATE ON platform.bot_usage TO platform_app;

-- -----------------------------------------------------------------------------
-- Funcoes do app dos clientes (so a chave de servico executa; o servidor do
-- app ja conferiu a sessao e passa o espaco e o usuario)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.support_open_thread(
  p_org text, p_user text, p_name text, p_email text, p_phone text,
  p_subject text, p_first_message text, p_origin text, p_error_ref text, p_tier text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_id uuid;
BEGIN
  IF length(trim(coalesce(p_first_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Escreva a mensagem.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO platform.support_threads (organization_id, user_id, user_name, user_email, user_phone, subject,
                                         origin_screen, error_reference, plan_tier, last_customer_message_at)
  VALUES (p_org, p_user, p_name, p_email, nullif(p_phone, ''), left(trim(p_subject), 120),
          nullif(left(p_origin, 200), ''), nullif(left(p_error_ref, 40), ''), p_tier, now())
  RETURNING id INTO v_id;
  INSERT INTO platform.support_messages (thread_id, author, body) VALUES (v_id, 'customer', left(p_first_message, 4000));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.support_add_customer_message(p_org text, p_user text, p_thread uuid, p_body text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM platform.support_threads
   WHERE id = p_thread AND organization_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF length(trim(coalesce(p_body, ''))) = 0 THEN RAISE EXCEPTION 'Escreva a mensagem.' USING ERRCODE = '22023'; END IF;
  INSERT INTO platform.support_messages (thread_id, author, body) VALUES (p_thread, 'customer', left(p_body, 4000));
  UPDATE platform.support_threads SET
    status = CASE WHEN status IN ('waiting_customer', 'resolved') THEN 'waiting_us' ELSE status END,
    resolved_at = CASE WHEN status = 'resolved' THEN NULL ELSE resolved_at END,
    escalated_at = CASE WHEN status IN ('waiting_customer', 'resolved') THEN coalesce(escalated_at, now()) ELSE escalated_at END,
    last_message_at = now(), last_customer_message_at = now(), customer_seen_at = now()
  WHERE id = p_thread;
END $$;

CREATE OR REPLACE FUNCTION public.support_add_bot_message(
  p_thread uuid, p_body text, p_sources jsonb, p_input_tokens integer, p_output_tokens integer, p_cost_cents integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
BEGIN
  INSERT INTO platform.support_messages (thread_id, author, body, sources) VALUES (p_thread, 'bot', left(p_body, 6000), p_sources);
  UPDATE platform.support_threads SET last_message_at = now(), customer_seen_at = now() WHERE id = p_thread;
  INSERT INTO platform.bot_usage (month, messages, input_tokens, output_tokens, cost_cents)
  VALUES (to_char(now(), 'YYYY-MM'), 1, greatest(p_input_tokens, 0), greatest(p_output_tokens, 0), greatest(p_cost_cents, 0))
  ON CONFLICT (month) DO UPDATE SET
    messages = platform.bot_usage.messages + 1,
    input_tokens = platform.bot_usage.input_tokens + greatest(p_input_tokens, 0),
    output_tokens = platform.bot_usage.output_tokens + greatest(p_output_tokens, 0),
    cost_cents = platform.bot_usage.cost_cents + greatest(p_cost_cents, 0);
END $$;

CREATE OR REPLACE FUNCTION public.support_escalate(p_org text, p_user text, p_thread uuid, p_summary text, p_urgent boolean)
RETURNS TABLE (subject text, user_name text, user_email text, organization_name text, urgent boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
BEGIN
  UPDATE platform.support_threads t SET
    status = 'waiting_us', urgent = coalesce(p_urgent, false), summary = left(nullif(trim(p_summary), ''), 600),
    escalated_at = coalesce(t.escalated_at, now()), last_message_at = now(), customer_seen_at = now()
  WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user AND t.status IN ('bot', 'waiting_customer', 'resolved');
  IF NOT FOUND THEN
    -- Ja estava com o suporte (ou nao e da pessoa): nada a mudar.
    RETURN QUERY SELECT t.subject, t.user_name, t.user_email, o.name, t.urgent
      FROM platform.support_threads t JOIN public.organizations o ON o.id = t.organization_id
     WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user AND t.status = 'waiting_us' AND false;
    RETURN;
  END IF;
  INSERT INTO platform.support_messages (thread_id, author, body)
  VALUES (p_thread, 'system', 'Enviamos sua conversa para o suporte. Respondemos em até 2 dias úteis, por aqui e por e-mail.');
  RETURN QUERY SELECT t.subject, t.user_name, t.user_email, o.name, t.urgent
    FROM platform.support_threads t JOIN public.organizations o ON o.id = t.organization_id WHERE t.id = p_thread;
END $$;

CREATE OR REPLACE FUNCTION public.support_mark_bot_helped(p_org text, p_user text, p_thread uuid, p_helped boolean)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, platform AS $$
  UPDATE platform.support_threads SET
    bot_helped = p_helped,
    status = CASE WHEN p_helped AND status = 'bot' THEN 'resolved' ELSE status END,
    resolved_at = CASE WHEN p_helped AND status = 'bot' THEN now() ELSE resolved_at END
  WHERE id = p_thread AND organization_id = p_org AND user_id = p_user
$$;

CREATE OR REPLACE FUNCTION public.support_list_threads(p_org text, p_user text)
RETURNS TABLE (id uuid, subject text, status text, urgent boolean, created_at timestamptz, last_message_at timestamptz,
               unread integer, last_preview text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.id, t.subject, t.status, t.urgent, t.created_at, t.last_message_at,
         (SELECT count(*)::int FROM platform.support_messages m
           WHERE m.thread_id = t.id AND m.author = 'staff' AND NOT m.internal
             AND m.created_at > coalesce(t.customer_seen_at, 'epoch'::timestamptz)),
         (SELECT left(m.body, 140) FROM platform.support_messages m
           WHERE m.thread_id = t.id AND NOT m.internal ORDER BY m.created_at DESC LIMIT 1)
    FROM platform.support_threads t
   WHERE t.organization_id = p_org AND t.user_id = p_user
   ORDER BY t.last_message_at DESC
   LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.support_thread_messages(p_org text, p_user text, p_thread uuid, p_mark_seen boolean)
RETURNS TABLE (id uuid, author text, staff_name text, body text, sources jsonb, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform.support_threads t WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user) THEN
    RAISE EXCEPTION 'Conversa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF p_mark_seen THEN UPDATE platform.support_threads SET customer_seen_at = now() WHERE platform.support_threads.id = p_thread; END IF;
  RETURN QUERY SELECT m.id, m.author, m.staff_name, m.body, m.sources, m.created_at
    FROM platform.support_messages m WHERE m.thread_id = p_thread AND NOT m.internal ORDER BY m.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.support_thread_status(p_org text, p_user text, p_thread uuid)
RETURNS TABLE (status text, bot_helped boolean, subject text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.status, t.bot_helped, t.subject FROM platform.support_threads t
   WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user
$$;

CREATE OR REPLACE FUNCTION public.support_unread_count(p_org text, p_user text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT count(*)::int FROM platform.support_messages m
    JOIN platform.support_threads t ON t.id = m.thread_id
   WHERE t.organization_id = p_org AND t.user_id = p_user AND m.author = 'staff' AND NOT m.internal
     AND m.created_at > coalesce(t.customer_seen_at, 'epoch'::timestamptz)
$$;

-- Limites do bot (por pessoa e por espaco no dia; gasto no mes).
CREATE OR REPLACE FUNCTION public.support_bot_quota(p_org text, p_user text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT jsonb_build_object(
    'user_today', (SELECT count(*) FROM platform.support_messages m JOIN platform.support_threads t ON t.id = m.thread_id
                    WHERE t.user_id = p_user AND m.author = 'customer' AND m.created_at >= date_trunc('day', now())),
    'user_limit', coalesce((SELECT (value)::int FROM platform.settings WHERE key = 'support.bot_daily_messages_per_user'), 30),
    'space_today', (SELECT count(*) FROM platform.support_messages m JOIN platform.support_threads t ON t.id = m.thread_id
                     WHERE t.organization_id = p_org AND m.author = 'customer' AND m.created_at >= date_trunc('day', now())),
    'space_limit', coalesce((SELECT (value)::int FROM platform.settings WHERE key = 'support.bot_daily_messages_per_space'), 150),
    'month_cost_cents', coalesce((SELECT cost_cents FROM platform.bot_usage WHERE month = to_char(now(), 'YYYY-MM')), 0),
    'budget_cents', coalesce((SELECT (value)::int FROM platform.settings WHERE key = 'support.bot_monthly_budget_cents'), 15000)
  )
$$;

-- Onde avisar quando chega chamado (vazio: cai no e-mail de suporte do app).
CREATE OR REPLACE FUNCTION public.support_notify_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT coalesce(trim(both '"' from (SELECT value::text FROM platform.settings WHERE key = 'support.notify_email')), '')
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'support_open_thread(text,text,text,text,text,text,text,text,text,text)',
    'support_add_customer_message(text,text,uuid,text)',
    'support_add_bot_message(uuid,text,jsonb,integer,integer,integer)',
    'support_escalate(text,text,uuid,text,boolean)',
    'support_mark_bot_helped(text,text,uuid,boolean)',
    'support_list_threads(text,text)',
    'support_thread_messages(text,text,uuid,boolean)',
    'support_thread_status(text,text,uuid)',
    'support_unread_count(text,text)',
    'support_bot_quota(text,text)',
    'support_notify_email()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
