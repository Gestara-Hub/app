-- Migration: 20261021000019_attendance_with_package_usage.
-- Chamada e gasto da aula do pacote na mesma transacao (doc 06, fatia 4).
-- Antes eram duas chamadas do cliente: se a segunda falhasse, a presenca ficava
-- gravada sem o desconto do pacote (ou o inverso, ao desmarcar).

CREATE OR REPLACE FUNCTION public.apply_attendance_with_packages(
  p_organization_id text,
  p_session_id text,
  p_student_id text,
  p_attendance jsonb,
  p_packages jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg jsonb;
BEGIN
  -- Mesmas regras das policies de attendances: so o proprio espaco e os
  -- perfis que fazem chamada. O service role (sem auth.uid()) passa direto.
  IF auth.uid() IS NOT NULL THEN
    IF public.current_organization_id() IS DISTINCT FROM p_organization_id THEN
      RAISE EXCEPTION 'organização inválida' USING ERRCODE = '42501';
    END IF;
    IF public.current_user_profile() NOT IN ('owner', 'manager', 'attendant', 'professional') THEN
      RAISE EXCEPTION 'perfil sem permissão para a chamada' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- p_attendance nulo = desmarcar (volta a "a marcar").
  IF p_attendance IS NULL OR p_attendance = 'null'::jsonb THEN
    DELETE FROM public.attendances
    WHERE organization_id = p_organization_id
      AND session_id = p_session_id
      AND student_id = p_student_id;
  ELSE
    INSERT INTO public.attendances (id, organization_id, session_id, student_id, status, marked_at)
    VALUES (
      COALESCE(p_attendance->>'id', gen_random_uuid()::text),
      p_organization_id,
      p_session_id,
      p_student_id,
      p_attendance->>'status',
      COALESCE((p_attendance->>'marked_at')::timestamptz, now())
    )
    ON CONFLICT (organization_id, session_id, student_id) DO UPDATE
      SET status = EXCLUDED.status,
          marked_at = EXCLUDED.marked_at;
  END IF;

  -- Pacotes do aluno ja com o saldo e os usos recalculados pelo service.
  FOR v_pkg IN SELECT * FROM jsonb_array_elements(COALESCE(p_packages, '[]'::jsonb))
  LOOP
    IF (v_pkg->>'organization_id') IS DISTINCT FROM p_organization_id
       OR (v_pkg->>'student_id') IS DISTINCT FROM p_student_id THEN
      RAISE EXCEPTION 'pacote de outro aluno ou espaço' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.student_packages (
      id, organization_id, unit_id, student_id, package_id, name,
      lessons_total, lessons_used, purchased_at, expires_at,
      class_group_ids, modality_ids, absence_consumes, status,
      carried_over_lessons, carried_from, renewed_from_id, renewed_into_id,
      charge_ids, usages
    ) VALUES (
      v_pkg->>'id',
      p_organization_id,
      v_pkg->>'unit_id',
      p_student_id,
      v_pkg->>'package_id',
      v_pkg->>'name',
      (v_pkg->>'lessons_total')::integer,
      (v_pkg->>'lessons_used')::integer,
      (v_pkg->>'purchased_at')::date,
      (v_pkg->>'expires_at')::date,
      v_pkg->'class_group_ids',
      COALESCE(v_pkg->'modality_ids', '[]'::jsonb),
      COALESCE((v_pkg->>'absence_consumes')::boolean, true),
      v_pkg->>'status',
      (v_pkg->>'carried_over_lessons')::integer,
      COALESCE(v_pkg->'carried_from', '[]'::jsonb),
      v_pkg->>'renewed_from_id',
      v_pkg->>'renewed_into_id',
      COALESCE(v_pkg->'charge_ids', '[]'::jsonb),
      COALESCE(v_pkg->'usages', '[]'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE
      SET lessons_used = EXCLUDED.lessons_used,
          usages = EXCLUDED.usages,
          status = EXCLUDED.status,
          expires_at = EXCLUDED.expires_at,
          carried_over_lessons = EXCLUDED.carried_over_lessons,
          carried_from = EXCLUDED.carried_from,
          renewed_from_id = EXCLUDED.renewed_from_id,
          renewed_into_id = EXCLUDED.renewed_into_id,
          charge_ids = EXCLUDED.charge_ids;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_attendance_with_packages(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_attendance_with_packages(text, text, text, jsonb, jsonb) TO authenticated, service_role;
