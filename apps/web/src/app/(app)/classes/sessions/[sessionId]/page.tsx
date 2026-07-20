import { requirePermission } from "@/features/auth/require-permission";
import { SessionDetailView } from "@/features/turmas";

export default async function ClassSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requirePermission("classes:view");
  const { sessionId } = await params;
  return <SessionDetailView sessionId={decodeURIComponent(sessionId)} />;
}
