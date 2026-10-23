import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { can } from "@/lib/permissions";
import { CourseCertificateLocked, CourseCertificateView } from "@/features/turmas";

/** Certificado de conclusao do curso (Plano Profissional): quem ve a turma pode imprimir. */
export default async function CourseCertificatePage({
  params,
}: {
  params: Promise<{ id: string; enrollmentId: string }>;
}) {
  const user = await requirePermission("classes:view", "/classes");
  const { id, enrollmentId } = await params;
  if (!(await sessionHasFeature(user, "certificates"))) {
    return <CourseCertificateLocked classGroupId={id} canManagePlan={can(user, "subscription:manage")} />;
  }
  return <CourseCertificateView classGroupId={id} enrollmentId={enrollmentId} />;
}
