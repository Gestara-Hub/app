import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { can } from "@/lib/permissions";
import { GraduationCertificateLocked, GraduationCertificateView } from "@/features/clients";

/** Certificado de graduacao (doc 21 §1.6, Plano Profissional): quem ve a ficha do aluno. */
export default async function GraduationCertificatePage({
  params,
}: {
  params: Promise<{ id: string; promotionId: string }>;
}) {
  const user = await requirePermission(["clients:view", "clients:view_own"], "/clients");
  const { id, promotionId } = await params;
  if (!(await sessionHasFeature(user, "certificates"))) {
    return <GraduationCertificateLocked studentId={id} canManagePlan={can(user, "subscription:manage")} />;
  }
  return <GraduationCertificateView studentId={id} promotionId={promotionId} />;
}
