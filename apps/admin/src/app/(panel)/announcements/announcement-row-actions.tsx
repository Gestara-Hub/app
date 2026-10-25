"use client";

import { useRef } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { ConfirmSubmit } from "@/components/shared/confirm-submit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { archiveAnnouncementAction } from "./actions";

/** Menu ⋮ da linha: editar e arquivar/restaurar (com confirmação). */
export function AnnouncementRowActions({ id, title, archived }: { id: string; title: string; archived: boolean }) {
  const archiveRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={`Ações de ${title}`}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/announcements/${id}`}>Editar</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => archiveRef.current?.querySelector("button")?.click(), 0)}>{archived ? "Restaurar" : "Arquivar"}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form action={archiveAnnouncementAction} className="hidden">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archive" value={archived ? "0" : "1"} />
        <span ref={archiveRef}>
          <ConfirmSubmit
            title={archived ? "Restaurar o comunicado?" : "Arquivar o comunicado?"}
            description={archived ? `"${title}" volta a valer no período definido.` : `"${title}" deixa de aparecer para os clientes. Você pode restaurar depois.`}
            confirmLabel={archived ? "Restaurar" : "Arquivar"}
          >
            {archived ? "Restaurar" : "Arquivar"}
          </ConfirmSubmit>
        </span>
      </form>
    </>
  );
}
