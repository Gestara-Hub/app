import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/features/auth/require-permission";
import { TurmaDetailView } from "@/features/turmas";

export default async function ClassGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("classes:view");
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
      <TurmaDetailView id={id} />
    </Suspense>
  );
}
