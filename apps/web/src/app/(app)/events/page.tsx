import { requirePermission } from "@/features/auth/require-permission";
import { EventsView } from "@/features/events";

export default async function EventsPage() {
  await requirePermission("events:view", "/events");
  return <EventsView />;
}
