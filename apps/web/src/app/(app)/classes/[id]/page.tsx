import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/features/auth/require-permission";
import { ClassDetailScreen } from "./class-detail-screen";

export default async function ClassGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("classes:view", "/classes");
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
      <ClassDetailScreen id={id} />
    </Suspense>
  );
}
