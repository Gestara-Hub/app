-- =============================================================================
-- Migration: 20261024000060_support_thread_kind.sql
-- Description: Tipo da conversa do "Fale com a gente": duvida (question, passa
--   pelo assistente), problema (bug) e sugestao (suggestion). Problema e
--   sugestao vao direto para a equipe. A coluna entra com padrao `question`,
--   entao as conversas que ja existem nao mudam.
-- =============================================================================

ALTER TABLE platform.support_threads
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'question'
  CHECK (kind IN ('question', 'bug', 'suggestion'));

CREATE INDEX IF NOT EXISTS idx_support_threads_kind ON platform.support_threads (kind, last_message_at DESC);

-- Abrir conversa agora recebe o tipo (assinatura nova; a antiga sai).
DROP FUNCTION IF EXISTS public.support_open_thread(text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.support_open_thread(
  p_org text, p_user text, p_name text, p_email text, p_phone text,
  p_subject text, p_first_message text, p_origin text, p_error_ref text, p_tier text,
  p_kind text DEFAULT 'question'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_id uuid;
BEGIN
  IF length(trim(coalesce(p_first_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Escreva a mensagem.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_kind, 'question') NOT IN ('question', 'bug', 'suggestion') THEN
    RAISE EXCEPTION 'Tipo de conversa inválido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO platform.support_threads (organization_id, user_id, user_name, user_email, user_phone, subject,
                                         origin_screen, error_reference, plan_tier, last_customer_message_at, kind)
  VALUES (p_org, p_user, p_name, p_email, nullif(p_phone, ''), left(trim(p_subject), 120),
          nullif(left(p_origin, 200), ''), nullif(left(p_error_ref, 40), ''), p_tier, now(), coalesce(p_kind, 'question'))
  RETURNING id INTO v_id;
  INSERT INTO platform.support_messages (thread_id, author, body) VALUES (v_id, 'customer', left(p_first_message, 4000));
  RETURN v_id;
END $$;

-- Encaminhar: o aviso na conversa muda conforme o tipo (e o retorno ganha `kind`).
DROP FUNCTION IF EXISTS public.support_escalate(text, text, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.support_escalate(p_org text, p_user text, p_thread uuid, p_summary text, p_urgent boolean)
RETURNS TABLE (subject text, user_name text, user_email text, organization_name text, urgent boolean, kind text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_kind text;
BEGIN
  UPDATE platform.support_threads t SET
    status = 'waiting_us', urgent = coalesce(p_urgent, false), summary = left(nullif(trim(p_summary), ''), 600),
    escalated_at = coalesce(t.escalated_at, now()), last_message_at = now(), customer_seen_at = now()
  WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user AND t.status IN ('bot', 'waiting_customer', 'resolved')
  RETURNING t.kind INTO v_kind;
  IF NOT FOUND THEN
    -- Ja estava com o suporte (ou nao e da pessoa): nada a mudar.
    RETURN;
  END IF;
  INSERT INTO platform.support_messages (thread_id, author, body)
  VALUES (p_thread, 'system', CASE v_kind
    WHEN 'bug' THEN 'Recebemos seu relato. Obrigado por nos ajudar a melhorar o GestaraHub. Se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    WHEN 'suggestion' THEN 'Recebemos sua sugestão. Obrigado por nos ajudar a melhorar o GestaraHub. Lemos todas e, se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    ELSE 'Enviamos sua conversa para o suporte. Respondemos em até 2 dias úteis, por aqui e por e-mail.' END);
  RETURN QUERY SELECT t.subject, t.user_name, t.user_email, o.name, t.urgent, t.kind
    FROM platform.support_threads t JOIN public.organizations o ON o.id = t.organization_id WHERE t.id = p_thread;
END $$;

DROP FUNCTION IF EXISTS public.support_list_threads(text, text);
DROP FUNCTION IF EXISTS public.support_thread_status(text, text, uuid);

CREATE OR REPLACE FUNCTION public.support_list_threads(p_org text, p_user text)
RETURNS TABLE (id uuid, subject text, status text, urgent boolean, created_at timestamptz, last_message_at timestamptz,
               unread integer, last_preview text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.id, t.subject, t.status, t.urgent, t.created_at, t.last_message_at,
         (SELECT count(*)::int FROM platform.support_messages m
           WHERE m.thread_id = t.id AND m.author = 'staff' AND NOT m.internal
             AND m.created_at > coalesce(t.customer_seen_at, 'epoch'::timestamptz)),
         (SELECT left(m.body, 140) FROM platform.support_messages m
           WHERE m.thread_id = t.id AND NOT m.internal ORDER BY m.created_at DESC LIMIT 1),
         t.kind
    FROM platform.support_threads t
   WHERE t.organization_id = p_org AND t.user_id = p_user
   ORDER BY t.last_message_at DESC
   LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.support_thread_status(p_org text, p_user text, p_thread uuid)
RETURNS TABLE (status text, bot_helped boolean, subject text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.status, t.bot_helped, t.subject, t.kind FROM platform.support_threads t
   WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user
$$;

-- As funcoes recriadas voltam a ser so da chave de servico.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'support_open_thread(text,text,text,text,text,text,text,text,text,text,text)',
    'support_escalate(text,text,uuid,text,boolean)',
    'support_list_threads(text,text)',
    'support_thread_status(text,text,uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
