-- Migration: 20261019000010_user_preferences.sql
-- Tabela para armazenar preferências de usuário (tema, visualização, paginação, etc.)

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id text PRIMARY KEY,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at automático
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Habilitar RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Política de leitura e escrita para o usuário autenticado ou via tenant client
CREATE POLICY "Acesso a preferencias de usuario"
  ON public.user_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);
