-- =============================================================================
-- Migration: 20261024000053_platform_plans.sql
-- Description: Planos pelo painel admin (doc technical/26, fase 3): cortesia,
--   carencia estendida e voltar ao Gratis. O plano pago continua sendo gravado
--   so por codigo de servidor: aqui sao funcoes SECURITY DEFINER (uma por acao,
--   so o papel do painel executa) que validam, gravam `organizations.subscription`,
--   o historico do plano (`subscription_events`), a Auditoria do espaco (o dono
--   ve "Suporte do GestaraHub ...") e a auditoria do painel, tudo na mesma
--   transacao. Cortesia = Profissional com `courtesyUntil` e a troca para o
--   Gratis ja marcada no dia seguinte (a rotina diaria aplica sozinha).
-- =============================================================================

-- 1. Novos tipos de evento no historico do plano
ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_kind_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_kind_check CHECK (kind = ANY (ARRAY[
  'activated', 'upgraded', 'change_scheduled', 'change_canceled', 'change_applied', 'renewed', 'renewal_overdue',
  'reverted_to_free', 'reactivated', 'closed', 'canceled', 'removed_at_partner',
  'courtesy_granted', 'courtesy_ended', 'courtesy_revoked', 'grace_extended', 'forced_free'
]));

-- 2. Concessoes feitas pelo painel
CREATE TABLE IF NOT EXISTS platform.plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('courtesy', 'grace', 'forced_free')),
  tier text,
  starts_on date NOT NULL,
  ends_on date,
  days integer,
  reason text NOT NULL,
  granted_by uuid,
  granted_by_name text,
  revoked_at timestamptz,
  revoked_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_grants_org ON platform.plan_grants (organization_id, created_at DESC);
ALTER TABLE platform.plan_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_grants_platform_app ON platform.plan_grants FOR SELECT TO platform_app USING (true);
GRANT SELECT ON platform.plan_grants TO platform_app;

-- 3. Nucleo: grava o plano novo e os tres registros
CREATE OR REPLACE FUNCTION platform.write_plan_change(
  p_org text, p_next jsonb, p_kind text, p_predicate text, p_reason text, p_details jsonb,
  p_admin uuid, p_admin_name text, p_audit_action text, p_ip text, p_ua text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_before jsonb;
  v_event uuid;
  v_audit uuid := gen_random_uuid();
  v_tier_before text;
  v_tier_after text := coalesce(p_next->>'tier', 'free');
  v_label text := 'Suporte do GestaraHub';
BEGIN
  SELECT subscription INTO v_before FROM public.organizations WHERE id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  v_tier_before := coalesce(v_before->>'tier', 'free');
  UPDATE public.organizations SET subscription = p_next WHERE id = p_org;

  INSERT INTO public.audit_logs (id, organization_id, actor, action, target, summary, changes, security, source)
  VALUES (v_audit, p_org,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'updated', jsonb_build_object('type', 'subscription', 'id', p_org, 'label', 'Plano GestaraHub'),
          v_label || ' ' || p_predicate, NULL, true, 'platform');

  INSERT INTO public.subscription_events (organization_id, kind, tier_before, tier_after, interval_before, interval_after,
                                          effective_on, actor, source, details, audit_log_id)
  VALUES (p_org, p_kind, v_tier_before, v_tier_after, v_before->>'interval', p_next->>'interval',
          nullif(coalesce(p_next->>'courtesyUntil', p_next->>'renewsOn'), '')::date,
          jsonb_build_object('kind', 'system', 'userId', 'platform', 'name', v_label, 'profile', 'owner'),
          'platform', coalesce(p_details, '{}'::jsonb), v_audit)
  RETURNING id INTO v_event;

  INSERT INTO platform.audit_logs (admin_id, admin_name, action, organization_id, target, reason, before, after, ip, user_agent)
  VALUES (p_admin, p_admin_name, p_audit_action, p_org, jsonb_build_object('subscriptionEventId', v_event) || coalesce(p_details, '{}'::jsonb),
          p_reason, jsonb_build_object('tier', v_tier_before, 'courtesyUntil', v_before->>'courtesyUntil', 'renewsOn', v_before->>'renewsOn'),
          jsonb_build_object('tier', v_tier_after, 'courtesyUntil', p_next->>'courtesyUntil', 'renewsOn', p_next->>'renewsOn'), p_ip, p_ua);
END $$;

CREATE OR REPLACE FUNCTION platform.brasilia_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- 4. Cortesia: Profissional (ou Expansao) de graca por N dias, com fim obrigatorio
CREATE OR REPLACE FUNCTION platform.grant_courtesy(
  p_org text, p_tier text, p_days integer, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text
) RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_current jsonb;
  v_today date := platform.brasilia_today();
  v_base date;
  v_ends date;
  v_next jsonb;
BEGIN
  IF p_tier NOT IN ('pro', 'scale') THEN RAISE EXCEPTION 'Escolha o Profissional ou o Expansão.' USING ERRCODE = '22023'; END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN RAISE EXCEPTION 'A cortesia vai de 1 a 365 dias.' USING ERRCODE = '22023'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo da cortesia.' USING ERRCODE = '22023'; END IF;
  SELECT subscription INTO v_current FROM public.organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(v_current->>'tier', 'free') <> 'free' AND v_current ? 'asaasSubscriptionId' AND NOT (v_current ? 'courtesyUntil') THEN
    RAISE EXCEPTION 'Este espaço já tem assinatura paga. Não dá para dar cortesia por cima.' USING ERRCODE = '22023';
  END IF;
  -- Cortesia que ja existe: soma a partir do fim dela (ou de hoje, se ja acabou).
  v_base := greatest(v_today, coalesce(nullif(v_current->>'courtesyUntil', '')::date, v_today));
  v_ends := v_base + p_days;
  v_next := jsonb_build_object(
    'tier', p_tier, 'interval', 'monthly', 'status', 'active', 'courtesyUntil', v_ends,
    'scheduledChange', jsonb_build_object('tier', 'free', 'effectiveOn', v_ends + 1),
    'changedAt', now()
  );
  IF v_current ? 'asaasCustomerId' THEN v_next := v_next || jsonb_build_object('asaasCustomerId', v_current->>'asaasCustomerId'); END IF;

  PERFORM platform.write_plan_change(p_org, v_next, 'courtesy_granted',
    format('deu cortesia do Plano %s até %s', CASE p_tier WHEN 'pro' THEN 'Profissional' ELSE 'Expansão' END, to_char(v_ends, 'DD/MM/YYYY')),
    p_reason, jsonb_build_object('days', p_days, 'endsOn', v_ends), p_admin, p_admin_name, 'plan.courtesy_grant', p_ip, p_ua);
  INSERT INTO platform.plan_grants (organization_id, kind, tier, starts_on, ends_on, days, reason, granted_by, granted_by_name)
  VALUES (p_org, 'courtesy', p_tier, v_today, v_ends, p_days, p_reason, p_admin, p_admin_name);
  RETURN v_ends;
END $$;

-- 5. Encerrar a cortesia antes do fim
CREATE OR REPLACE FUNCTION platform.revoke_courtesy(p_org text, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_current jsonb; v_next jsonb;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT subscription INTO v_current FROM public.organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (v_current ? 'courtesyUntil') THEN RAISE EXCEPTION 'Este espaço não está em cortesia.' USING ERRCODE = '22023'; END IF;
  v_next := jsonb_build_object('tier', 'free', 'changedAt', now());
  IF v_current ? 'asaasCustomerId' THEN v_next := v_next || jsonb_build_object('asaasCustomerId', v_current->>'asaasCustomerId'); END IF;
  PERFORM platform.write_plan_change(p_org, v_next, 'courtesy_revoked', 'encerrou a cortesia: o espaço voltou ao Grátis',
    p_reason, '{}'::jsonb, p_admin, p_admin_name, 'plan.courtesy_revoke', p_ip, p_ua);
  UPDATE platform.plan_grants SET revoked_at = now(), revoked_by_name = p_admin_name
   WHERE organization_id = p_org AND kind = 'courtesy' AND revoked_at IS NULL;
END $$;

-- 6. Carencia: mais N dias para pagar uma renovacao atrasada
CREATE OR REPLACE FUNCTION platform.extend_grace(p_org text, p_days integer, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text)
RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE
  v_current jsonb;
  v_today date := platform.brasilia_today();
  v_old date;
  v_new date;
  v_next jsonb;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 30 THEN RAISE EXCEPTION 'Dê de 1 a 30 dias.' USING ERRCODE = '22023'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT subscription INTO v_current FROM public.organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(v_current->>'tier', 'free') = 'free' OR v_current ? 'courtesyUntil' THEN
    RAISE EXCEPTION 'Só vale para plano pago com renovação atrasada.' USING ERRCODE = '22023';
  END IF;
  v_old := nullif(coalesce(v_current->>'renewsOn', v_current->>'nextDueDate'), '')::date;
  IF v_old IS NULL OR v_old >= v_today THEN RAISE EXCEPTION 'A renovação deste espaço não está atrasada.' USING ERRCODE = '22023'; END IF;
  v_new := v_today + p_days;
  v_next := (v_current || jsonb_build_object('renewsOn', v_new, 'nextDueDate', v_new, 'changedAt', now())) - 'noticesSent';
  PERFORM platform.write_plan_change(p_org, v_next, 'grace_extended',
    format('deu mais %s dias para pagar a renovação (nova data: %s)', p_days, to_char(v_new, 'DD/MM/YYYY')),
    p_reason, jsonb_build_object('days', p_days, 'from', v_old, 'to', v_new), p_admin, p_admin_name, 'plan.grace_extend', p_ip, p_ua);
  INSERT INTO platform.plan_grants (organization_id, kind, tier, starts_on, ends_on, days, reason, granted_by, granted_by_name)
  VALUES (p_org, 'grace', v_current->>'tier', v_today, v_new, p_days, p_reason, p_admin, p_admin_name);
  RETURN v_new;
END $$;

-- 7. Voltar ao Gratis agora (abuso, pedido do cliente fora do app)
CREATE OR REPLACE FUNCTION platform.force_free(p_org text, p_partner_canceled boolean, p_reason text, p_admin uuid, p_admin_name text, p_ip text, p_ua text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, platform AS $$
DECLARE v_current jsonb; v_next jsonb;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo.' USING ERRCODE = '22023'; END IF;
  SELECT subscription INTO v_current FROM public.organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espaço não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF coalesce(v_current->>'tier', 'free') = 'free' THEN RAISE EXCEPTION 'Este espaço já está no Grátis.' USING ERRCODE = '22023'; END IF;
  IF v_current ? 'asaasSubscriptionId' AND NOT v_current ? 'courtesyUntil' AND NOT coalesce(p_partner_canceled, false) THEN
    RAISE EXCEPTION 'Cancele a assinatura no parceiro de pagamentos antes e confirme aqui.' USING ERRCODE = '22023';
  END IF;
  v_next := jsonb_build_object('tier', 'free', 'changedAt', now());
  IF v_current ? 'asaasCustomerId' THEN v_next := v_next || jsonb_build_object('asaasCustomerId', v_current->>'asaasCustomerId'); END IF;
  PERFORM platform.write_plan_change(p_org, v_next, 'forced_free', 'voltou o espaço ao Grátis', p_reason, '{}'::jsonb,
    p_admin, p_admin_name, 'plan.force_free', p_ip, p_ua);
  UPDATE platform.plan_grants SET revoked_at = now(), revoked_by_name = p_admin_name
   WHERE organization_id = p_org AND kind = 'courtesy' AND revoked_at IS NULL;
  INSERT INTO platform.plan_grants (organization_id, kind, starts_on, reason, granted_by, granted_by_name)
  VALUES (p_org, 'forced_free', platform.brasilia_today(), p_reason, p_admin, p_admin_name);
END $$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'platform.write_plan_change(text,jsonb,text,text,text,jsonb,uuid,text,text,text,text)',
    'platform.grant_courtesy(text,text,integer,text,uuid,text,text,text)',
    'platform.revoke_courtesy(text,text,uuid,text,text,text)',
    'platform.extend_grace(text,integer,text,uuid,text,text,text)',
    'platform.force_free(text,boolean,text,uuid,text,text,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn);
  END LOOP;
  GRANT EXECUTE ON FUNCTION platform.grant_courtesy(text,text,integer,text,uuid,text,text,text) TO platform_app;
  GRANT EXECUTE ON FUNCTION platform.revoke_courtesy(text,text,uuid,text,text,text) TO platform_app;
  GRANT EXECUTE ON FUNCTION platform.extend_grace(text,integer,text,uuid,text,text,text) TO platform_app;
  GRANT EXECUTE ON FUNCTION platform.force_free(text,boolean,text,uuid,text,text,text) TO platform_app;
END $$;
