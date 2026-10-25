-- =============================================================================
-- Migration: 20261025000063_support_protocol_number.sql
-- Description: Numero de protocolo legivel das conversas do suporte (GH-1042).
--   Sequencial a partir de 1001; as conversas que ja existem ganham numero na
--   ordem de criacao. O `id` (uuid) segue sendo a chave; o numero e o que a
--   pessoa e a equipe citam por e-mail, WhatsApp e relatorios.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS platform.support_thread_number_seq START 1001;

ALTER TABLE platform.support_threads ADD COLUMN IF NOT EXISTS number integer;

-- Numero para as conversas antigas, na ordem em que foram abertas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM platform.support_threads WHERE number IS NULL ORDER BY created_at, id LOOP
    UPDATE platform.support_threads SET number = nextval('platform.support_thread_number_seq') WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE platform.support_threads ALTER COLUMN number SET DEFAULT nextval('platform.support_thread_number_seq');
ALTER TABLE platform.support_threads ALTER COLUMN number SET NOT NULL;
ALTER SEQUENCE platform.support_thread_number_seq OWNED BY platform.support_threads.number;
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_number ON platform.support_threads (number);

-- O painel (papel platform_app) so le: consulta pelo numero na busca.
GRANT SELECT ON platform.support_threads TO platform_app;

-- Funcoes do app dos clientes: o numero passa a vir junto.
DROP FUNCTION IF EXISTS public.support_list_threads(text, text);
DROP FUNCTION IF EXISTS public.support_thread_status(text, text, uuid);
DROP FUNCTION IF EXISTS public.support_escalate(text, text, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.support_list_threads(p_org text, p_user text)
RETURNS TABLE (id uuid, subject text, status text, urgent boolean, created_at timestamptz, last_message_at timestamptz,
               unread integer, last_preview text, kind text, number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.id, t.subject, t.status, t.urgent, t.created_at, t.last_message_at,
         (SELECT count(*)::int FROM platform.support_messages m
           WHERE m.thread_id = t.id AND m.author = 'staff' AND NOT m.internal
             AND m.created_at > coalesce(t.customer_seen_at, 'epoch'::timestamptz)),
         (SELECT left(m.body, 140) FROM platform.support_messages m
           WHERE m.thread_id = t.id AND NOT m.internal ORDER BY m.created_at DESC LIMIT 1),
         t.kind, t.number
    FROM platform.support_threads t
   WHERE t.organization_id = p_org AND t.user_id = p_user
   ORDER BY t.last_message_at DESC
   LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.support_thread_status(p_org text, p_user text, p_thread uuid)
RETURNS TABLE (status text, bot_helped boolean, subject text, kind text, number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, platform AS $$
  SELECT t.status, t.bot_helped, t.subject, t.kind, t.number FROM platform.support_threads t
   WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user
$$;

CREATE OR REPLACE FUNCTION public.support_escalate(p_org text, p_user text, p_thread uuid, p_summary text, p_urgent boolean)
RETURNS TABLE (subject text, user_name text, user_email text, organization_name text, urgent boolean, kind text, number integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_kind text; v_number integer;
BEGIN
  UPDATE platform.support_threads t SET
    status = 'waiting_us', urgent = coalesce(p_urgent, false), summary = left(nullif(trim(p_summary), ''), 600),
    escalated_at = coalesce(t.escalated_at, now()), last_message_at = now(), customer_seen_at = now()
  WHERE t.id = p_thread AND t.organization_id = p_org AND t.user_id = p_user AND t.status IN ('bot', 'waiting_customer', 'resolved')
  RETURNING t.kind, t.number INTO v_kind, v_number;
  IF NOT FOUND THEN
    -- Ja estava com o suporte (ou nao e da pessoa): nada a mudar.
    RETURN;
  END IF;
  INSERT INTO platform.support_messages (thread_id, author, body)
  VALUES (p_thread, 'system', CASE v_kind
    WHEN 'bug' THEN 'Recebemos seu relato (protocolo GH-' || v_number || '). Obrigado por nos ajudar a melhorar o GestaraHub. Se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    WHEN 'suggestion' THEN 'Recebemos sua sugestão (protocolo GH-' || v_number || '). Obrigado por nos ajudar a melhorar o GestaraHub. Lemos todas e, se precisarmos de mais detalhes, escrevemos por aqui e por e-mail.'
    ELSE 'Enviamos sua conversa para o suporte (protocolo GH-' || v_number || '). Respondemos em até 2 dias úteis, por aqui e por e-mail.' END);
  RETURN QUERY SELECT t.subject, t.user_name, t.user_email, o.name, t.urgent, t.kind, t.number
    FROM platform.support_threads t JOIN public.organizations o ON o.id = t.organization_id WHERE t.id = p_thread;
END $$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'support_list_threads(text,text)',
    'support_thread_status(text,text,uuid)',
    'support_escalate(text,text,uuid,text,boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
