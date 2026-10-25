"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Menu "⋮" da linha de um espaço: atalhos para as abas mais usadas. */
export function SpaceRowMenu({ id, name, hasErrors }: { id: string; name: string; hasErrors: boolean }) {
  const items: [string, string][] = [
    ["Abrir o espaço", `/spaces/${id}`],
    ["Assinatura", `/spaces/${id}?tab=assinatura`],
    [hasErrors ? "Ver os erros" : "Saúde", `/spaces/${id}?tab=saude`],
    ["Suporte e notas", `/spaces/${id}?tab=suporte`],
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${name}`}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(([label, href]) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>{label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
