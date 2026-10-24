import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/features/auth/require-permission";
import { StudentProfileView } from "@/features/clients";

/** Ficha do aluno (ou do cliente): resumo e abas. Mesma permissao da lista (e a do professor). */
export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // O professor abre so a ficha dos alunos das turmas dele (sem dinheiro): o service escopa.
  await requirePermission(["clients:view", "clients:view_own"], "/clients");
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
      <StudentProfileView id={id} />
    </Suspense>
  );
}
