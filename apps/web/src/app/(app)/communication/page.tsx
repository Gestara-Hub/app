import { requirePermission } from "@/features/auth/require-permission";
import { CommunicationView } from "@/features/communication";

export default async function CommunicationPage() {
  await requirePermission("communication:view", "/communication");
  return <CommunicationView />;
}
