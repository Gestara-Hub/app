-- =============================================================================
-- Migration: 20261117000103_whatsapp_credentials.sql
-- Description: credenciais do WhatsApp oficial de cada espaco (doc technical/07
--   §1.1). O cadastro guiado da Meta devolve o id do numero, o id da conta
--   (WABA) e um codigo que o servidor troca pelo token do espaco. O token e o
--   PIN do registro ficam no Vault; a tabela guarda so os ids e a referencia
--   ao segredo. So o servidor (chave de servico) le e grava: o navegador nao
--   ve nem a tabela nem as funcoes.
-- =============================================================================

CREATE TABLE public.whatsapp_credentials (
  organization_id text PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL UNIQUE,
  waba_id text NOT NULL,
  business_id text,
  -- cloud: numero novo na API (registro com PIN); coexistence: o espaco segue
  -- usando o app WhatsApp Business no mesmo numero (sem registro).
  onboarding text NOT NULL CHECK (onboarding IN ('cloud', 'coexistence')),
  token_secret_id uuid NOT NULL,
  pin_secret_id uuid,
  registered_at timestamptz,
  subscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_credentials_waba_idx ON public.whatsapp_credentials (waba_id);

CREATE TRIGGER trg_whatsapp_credentials_updated_at
  BEFORE UPDATE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_credentials FROM anon, authenticated;

-- Segredos saem do Vault junto com a linha (desconectar ou excluir o espaco).
CREATE OR REPLACE FUNCTION public.whatsapp_credentials_drop_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id IN (OLD.token_secret_id, OLD.pin_secret_id);
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_whatsapp_credentials_drop_secrets
  AFTER DELETE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_credentials_drop_secrets();

-- Grava (ou troca) as credenciais do espaco. O numero ja ligado a outro espaco
-- e recusado (unique em phone_number_id).
CREATE OR REPLACE FUNCTION public.whatsapp_credentials_save(
  p_organization_id text,
  p_phone_number_id text,
  p_waba_id text,
  p_business_id text,
  p_onboarding text,
  p_token text,
  p_pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old public.whatsapp_credentials%ROWTYPE;
  v_token uuid;
  v_pin uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_credentials
     WHERE phone_number_id = p_phone_number_id AND organization_id <> p_organization_id
  ) THEN
    RAISE EXCEPTION 'whatsapp: numero ligado a outro espaco' USING ERRCODE = 'PT409';
  END IF;

  SELECT * INTO v_old FROM public.whatsapp_credentials WHERE organization_id = p_organization_id;

  IF FOUND THEN
    PERFORM vault.update_secret(v_old.token_secret_id, p_token);
    v_token := v_old.token_secret_id;
    IF p_pin IS NULL THEN
      DELETE FROM vault.secrets WHERE id = v_old.pin_secret_id;
      v_pin := NULL;
    ELSIF v_old.pin_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_old.pin_secret_id, p_pin);
      v_pin := v_old.pin_secret_id;
    ELSE
      v_pin := vault.create_secret(p_pin);
    END IF;

    UPDATE public.whatsapp_credentials
       SET phone_number_id = p_phone_number_id,
           waba_id = p_waba_id,
           business_id = p_business_id,
           onboarding = p_onboarding,
           token_secret_id = v_token,
           pin_secret_id = v_pin,
           registered_at = NULL,
           subscribed_at = NULL
     WHERE organization_id = p_organization_id;
  ELSE
    v_token := vault.create_secret(p_token);
    v_pin := CASE WHEN p_pin IS NULL THEN NULL ELSE vault.create_secret(p_pin) END;
    INSERT INTO public.whatsapp_credentials
      (organization_id, phone_number_id, waba_id, business_id, onboarding, token_secret_id, pin_secret_id)
    VALUES
      (p_organization_id, p_phone_number_id, p_waba_id, p_business_id, p_onboarding, v_token, v_pin);
  END IF;
END;
$$;

-- Credenciais do espaco com o token aberto (so para chamar a Meta).
CREATE OR REPLACE FUNCTION public.whatsapp_credentials_get(p_organization_id text)
RETURNS TABLE (
  phone_number_id text,
  waba_id text,
  onboarding text,
  token text,
  pin text,
  registered_at timestamptz,
  subscribed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.phone_number_id, c.waba_id, c.onboarding, t.decrypted_secret, p.decrypted_secret,
         c.registered_at, c.subscribed_at
    FROM public.whatsapp_credentials c
    JOIN vault.decrypted_secrets t ON t.id = c.token_secret_id
    LEFT JOIN vault.decrypted_secrets p ON p.id = c.pin_secret_id
   WHERE c.organization_id = p_organization_id;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_credentials_save(text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_credentials_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_credentials_drop_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_credentials_save(text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_credentials_get(text) TO service_role;
