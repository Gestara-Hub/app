import { requirePermission } from "@/features/auth/require-permission";
import { sessionHasFeature } from "@/features/auth/get-subscription-tier";
import { can } from "@/lib/permissions";
import { EventCertificateLocked, EventCertificatesView } from "@/features/events";

/** Certificados de todos os presentes do evento, para imprimir (Plano Profissional). */
export default async function EventCertificatesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("events:view", "/events");
  const { id } = await params;
  if (!(await sessionHasFeature(user, "certificates"))) {
    return <EventCertificateLocked eventId={id} canManagePlan={can(user, "subscription:manage")} />;
  }
  return <EventCertificatesView eventId={id} />;
}
