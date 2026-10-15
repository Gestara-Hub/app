import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/features/auth/require-permission";
import { StudentProfileView } from "@/features/clients";

/** Ficha do aluno (ou do cliente): resumo e abas. Mesma permissao da lista. */
export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("clients:view", "/clients");
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
      <StudentProfileView id={id} />
    </Suspense>
  );
}
