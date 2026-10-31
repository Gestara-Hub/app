import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { can } from "@/lib/permissions";
import { ClassCertificatesView, CourseCertificateLocked } from "@/features/turmas";

/** Certificados de todos os concluidos da turma, para imprimir (Plano Profissional). */
export default async function ClassCertificatesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("classes:view", "/classes");
  const { id } = await params;
  if (!(await sessionHasFeature(user, "certificates"))) {
    return <CourseCertificateLocked classGroupId={id} canManagePlan={can(user, "subscription:manage")} />;
  }
  return <ClassCertificatesView classGroupId={id} />;
}
