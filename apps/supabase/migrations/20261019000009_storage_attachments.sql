-- =============================================================================
-- Migration: 20261019000009_storage_attachments.sql
-- Description: Configuração do bucket privado de anexos no Supabase Storage e
--              tabela public.attachments para rastreamento de metadados e RLS.
-- =============================================================================

-- 1. Bucket privado de anexos (comprovantes de pagamentos, notas fiscais, logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- 2. Tabela de metadados dos anexos
CREATE TABLE IF NOT EXISTS public.attachments (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_org ON public.attachments (organization_id);

-- 3. Habilita RLS em public.attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_manage_own" ON public.attachments
  TO authenticated
  USING (
    organization_id = current_organization_id() AND
    current_user_profile() = ANY (ARRAY['owner', 'manager', 'receptionist'])
  )
  WITH CHECK (
    organization_id = current_organization_id() AND
    current_user_profile() = ANY (ARRAY['owner', 'manager', 'receptionist'])
  );

CREATE POLICY "attachments_select_own" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    organization_id = current_organization_id()
  );

-- 4. Políticas de acesso aos objetos do Supabase Storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'attachments_objects_manage'
  ) THEN
    CREATE POLICY "attachments_objects_manage" ON storage.objects
      TO authenticated
      USING (
        bucket_id = 'attachments' AND
        (path_tokens[1] = current_organization_id() OR current_organization_id() = 'system')
      )
      WITH CHECK (
        bucket_id = 'attachments' AND
        (path_tokens[1] = current_organization_id() OR current_organization_id() = 'system')
      );
  END IF;
END $$;
