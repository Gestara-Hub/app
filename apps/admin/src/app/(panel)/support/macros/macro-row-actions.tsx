"use client";

import { useRef } from "react";
import { MoreVertical } from "lucide-react";
import { ConfirmSubmit } from "@/components/shared/confirm-submit";
import { FormDrawer } from "@/components/shared/form-drawer";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteMacroAction } from "../actions";
import { MacroForm } from "./macro-form";

/** Menu ⋮ da linha: editar (gaveta) e excluir (com confirmação). Os gatilhos ficam escondidos e o menu os aciona. */
export function MacroRowActions({ macro }: { macro: { id: string; title: string; body: string } }) {
  const editRef = useRef<HTMLSpanElement>(null);
  const deleteRef = useRef<HTMLSpanElement>(null);
  const press = (ref: React.RefObject<HTMLSpanElement | null>) => ref.current?.querySelector("button")?.click();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${macro.title}`}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem onSelect={() => setTimeout(() => press(editRef), 0)}>Editar</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => press(deleteRef), 0)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span ref={editRef} className="hidden">
        <FormDrawer
          title="Editar resposta pronta"
          trigger={
            <Button type="button" tabIndex={-1} aria-hidden>
              Editar
            </Button>
          }
        >
          <MacroForm macro={macro} />
        </FormDrawer>
      </span>
      <form action={deleteMacroAction} className="hidden">
        <input type="hidden" name="id" value={macro.id} />
        <span ref={deleteRef}>
          <ConfirmSubmit title="Excluir a resposta pronta?" description={`"${macro.title}" deixa de aparecer na lista de respostas. Isso não pode ser desfeito.`} confirmLabel="Excluir" destructive>
            Excluir
          </ConfirmSubmit>
        </span>
      </form>
    </>
  );
}
