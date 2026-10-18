"use client";

import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ListItemAction } from "./list-item-actions-menu";

/**
 * Menu "mais acoes" do cabecalho de uma tela (⋮): as acoes raras saem da tela
 * e ficam aqui. Mesma altura do botao principal ao lado (`size="icon"`).
 */
export function PageActionsMenu({ label, actions }: { label: string; actions: ListItemAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={label} title={label}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            disabled={action.disabled}
            onSelect={action.onSelect}
            variant={action.destructive ? "destructive" : "default"}
          >
            {action.icon}
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
