"use client";

import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type ListItemAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function ActionItems({
  actions,
  kind,
}: {
  actions: ListItemAction[];
  kind: "dropdown" | "context";
}) {
  return actions.map((action) => {
    const handleSelect = () => {
      if (action.disabled) return;
      action.onSelect?.();
    };

    if (kind === "dropdown") {
      return (
        <DropdownMenuItem
          key={action.key}
          onSelect={handleSelect}
          disabled={action.disabled}
          variant={action.destructive ? "destructive" : "default"}
        >
          {action.icon}
          <span>{action.label}</span>
        </DropdownMenuItem>
      );
    }

    return (
      <ContextMenuItem
        key={action.key}
        onSelect={handleSelect}
        disabled={action.disabled}
        variant={action.destructive ? "destructive" : "default"}
      >
        {action.icon}
        <span>{action.label}</span>
      </ContextMenuItem>
    );
  });
}

export function ListItemActionsMenu({
  actions,
  title,
  ariaLabel,
  variant = "outline",
}: {
  actions: ListItemAction[];
  title: string;
  /** Rotulo acessivel com o nome da linha (ex.: "Ações de Ana Clara"); cai no `title`. */
  ariaLabel?: string;
  variant?: "outline" | "ghost";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant={variant}
          size="icon-sm"
          title={title}
          aria-label={ariaLabel ?? title}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <ActionItems actions={actions} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ListItemContextMenu({
  actions,
  children,
  onCloseAutoFocus,
}: {
  actions: ListItemAction[];
  children: ReactNode;
  /**
   * Repassado ao conteudo do menu. Util quando a acao transforma a propria
   * linha (ex.: edicao inline) e o restore de foco do Radix roubaria o foco do
   * novo input — passe `(e) => e.preventDefault()`.
   */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48" onCloseAutoFocus={onCloseAutoFocus}>
        <ActionItems actions={actions} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  );
}
