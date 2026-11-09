import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { can } from "@/lib/permissions";
import { EventCertificateLocked, EventCertificateView } from "@/features/events";

/** Certificado de participacao no evento (Plano Profissional): quem ve o evento pode imprimir. */
export default async function EventCertificatePage({ params }: { params: Promise<{ id: string; registrationId: string }> }) {
  const user = await requirePermission("events:view", "/events");
  const { id, registrationId } = await params;
  if (!(await sessionHasFeature(user, "certificates"))) {
    return <EventCertificateLocked eventId={id} canManagePlan={can(user, "subscription:manage")} />;
  }
  return <EventCertificateView eventId={id} registrationId={registrationId} />;
}
