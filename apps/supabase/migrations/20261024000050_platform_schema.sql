-- =============================================================================
-- Migration: 20261024000050_platform_schema.sql
-- Description: Painel admin do GestaraHub (doc technical/26, fase 0).
--   Schema proprio `platform`, fora da API do Supabase (nao entra em
--   `api.schemas`), e o papel `platform_app`, que o apps/admin usa por conexao
--   direta de servidor. O papel le o `public` so onde uma politica de RLS
--   permite (`TO platform_app`) e nao escreve nada em `public`. Os papeis da
--   API (anon, authenticated, service_role) nao enxergam o schema `platform`.
--   A senha do papel NAO fica aqui: o `pnpm admin:setup` (local) ou o dono (producao)
--   define com ALTER ROLE ... LOGIN PASSWORD.
-- =============================================================================

-- 1. Papel de aplicacao do painel (sem login ate alguem definir a senha)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

-- No Supabase o `postgres` precisa ser membro para criar objetos em nome do papel.
GRANT platform_app TO postgres;

-- 2. Schema e permissoes base
CREATE SCHEMA IF NOT EXISTS platform;
REVOKE ALL ON SCHEMA platform FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA platform TO platform_app;
GRANT USAGE ON SCHEMA public TO platform_app;

-- 3. Administradores do painel (ligados a auth.users; nunca a public.users)
CREATE TABLE IF NOT EXISTS platform.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('platform_owner', 'platform_support', 'platform_finance', 'platform_viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  invited_by uuid REFERENCES platform.admins(id) ON DELETE SET NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Quem e administrador nunca e usuario de um espaco (e o contrario): o e-mail nao repete.
CREATE OR REPLACE FUNCTION platform.reject_tenant_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, platform
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Este e-mail já é de um usuário de espaço.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION platform.reject_tenant_user_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admins_reject_tenant_email ON platform.admins;
CREATE TRIGGER admins_reject_tenant_email
  BEFORE INSERT OR UPDATE OF email ON platform.admins
  FOR EACH ROW EXECUTE FUNCTION platform.reject_tenant_user_email();

-- 4. Auditoria do painel: so acrescenta
CREATE TABLE IF NOT EXISTS platform.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sem chave estrangeira de proposito: a auditoria e um livro de registro e nunca
  -- muda (apagar ou editar um administrador nao pode mexer nela). `admin_name` guarda o nome da hora.
  admin_id uuid,
  -- Nome de quem fez no momento (a linha de admins pode mudar ou sair).
  admin_name text,
  action text NOT NULL,
  organization_id text,
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_admin ON platform.audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_org ON platform.audit_logs (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION platform.audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'A auditoria do painel só acrescenta: não edita nem apaga.' USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON platform.audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON platform.audit_logs
  FOR EACH ROW EXECUTE FUNCTION platform.audit_logs_immutable();

-- 5. Limite de tentativas do login do painel (separado do `public.rate_limits` do app dos clientes)
CREATE TABLE IF NOT EXISTS platform.rate_limits (
  key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 1,
  expire_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION platform.check_rate_limit(p_key text, p_max_points integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_points integer;
BEGIN
  INSERT INTO platform.rate_limits (key, points, expire_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
  SET points = CASE WHEN platform.rate_limits.expire_at <= v_now THEN 1 ELSE platform.rate_limits.points + 1 END,
      expire_at = CASE WHEN platform.rate_limits.expire_at <= v_now
                       THEN v_now + make_interval(secs => p_window_seconds)
                       ELSE platform.rate_limits.expire_at END
  RETURNING points INTO v_points;
  RETURN v_points <= p_max_points;
END
$$;

CREATE OR REPLACE FUNCTION platform.reset_rate_limit(p_key text)
RETURNS void
LANGUAGE sql
AS $$ DELETE FROM platform.rate_limits WHERE key = p_key $$;

-- 6. RLS ligada em tudo; so o papel do painel tem politica
ALTER TABLE platform.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_platform_app ON platform.admins FOR ALL TO platform_app USING (true) WITH CHECK (true);
CREATE POLICY audit_platform_app_select ON platform.audit_logs FOR SELECT TO platform_app USING (true);
CREATE POLICY audit_platform_app_insert ON platform.audit_logs FOR INSERT TO platform_app WITH CHECK (true);
CREATE POLICY rate_limits_platform_app ON platform.rate_limits FOR ALL TO platform_app USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON platform.admins TO platform_app;
GRANT SELECT, INSERT ON platform.audit_logs TO platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.rate_limits TO platform_app;
GRANT EXECUTE ON FUNCTION platform.check_rate_limit(text, integer, integer) TO platform_app;
GRANT EXECUTE ON FUNCTION platform.reset_rate_limit(text) TO platform_app;

-- 7. Leitura do `public` (so o que o painel consome; cada fase acrescenta o seu)
--    Fase 0: a lista de espacos mostra so a contagem, para provar a conexao.
GRANT SELECT ON public.organizations TO platform_app;
CREATE POLICY organizations_platform_app_select ON public.organizations FOR SELECT TO platform_app USING (true);

-- 8. O espaco nao aceita e-mail de administrador (o outro sentido da regra do item 3)
CREATE OR REPLACE FUNCTION public.reject_platform_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, platform
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM platform.admins a WHERE lower(a.email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Este e-mail já é de um administrador da plataforma.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.reject_platform_admin_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_reject_platform_admin_email ON public.users;
CREATE TRIGGER users_reject_platform_admin_email
  BEFORE INSERT OR UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.reject_platform_admin_email();
