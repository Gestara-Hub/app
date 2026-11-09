import { requirePermission } from "@/features/auth/require-permission";
import { EventDetailView } from "@/features/events";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("events:view", "/events");
  const { id } = await params;
  return <EventDetailView id={id} />;
}
