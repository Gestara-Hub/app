import { requirePermission } from "@/features/auth/require-permission";
import { TurmaDetailView } from "@/features/turmas";

export default async function ClassGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("classes:view");
  const { id } = await params;
  return <TurmaDetailView id={id} />;
}
