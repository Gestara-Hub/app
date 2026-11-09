import { requirePermission } from "@/features/auth/require-permission";
import { EventSessionView } from "@/features/events";

export default async function EventSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requirePermission("events:view", "/events");
  const { sessionId } = await params;
  return <EventSessionView sessionId={decodeURIComponent(sessionId)} />;
}
