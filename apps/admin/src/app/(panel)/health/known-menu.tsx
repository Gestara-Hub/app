"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markKnownAction, unmarkKnownAction } from "./actions";

/** Menu ⋮ de um erro da lista: abrir o detalhe e marcar (ou desmarcar) como conhecido. */
export function ErrorRowMenu({ id, fingerprint, known, event }: { id: string; fingerprint: string; known: boolean; event: string }) {
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const data = new FormData();
    data.set("fingerprint", fingerprint);
    startTransition(async () => {
      await (known ? unmarkKnownAction : markKnownAction)(data);
      toast.success(known ? "Marca de conhecido removida." : "Erro marcado como conhecido.");
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações do erro ${event}`} disabled={pending}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/health/errors/${id}`}>Ver detalhes</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggle}>{known ? "Desmarcar conhecido" : "Marcar conhecido"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
