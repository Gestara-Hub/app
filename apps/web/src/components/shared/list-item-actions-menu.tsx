"use client";

import { Fragment, type ReactNode } from "react";
import { Loader2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type ListItemAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /**
   * Submenu (09/11/2026): agrupa acoes do mesmo assunto num item com seta,
   * como "Acompanhamento ›" (registros, graduacao, notas, testes). Submenu
   * vazio nao aparece; com uma acao so, ela entra direto no menu.
   */
  children?: ListItemAction[];
};

/** Submenu com uma acao so vira a propria acao; vazio some. */
function flattenActions(actions: ListItemAction[]): ListItemAction[] {
  return actions.flatMap((action) => {
    if (!action.children) return [action];
    if (action.children.length === 0) return [];
    if (action.children.length === 1) return action.children;
    return [action];
  });
}

/**
 * Acao que abre um dialogo: o menu nao devolve o foco ao botao (o foco ficava
 * atras do dialogo aberto). Sem dialogo, segue o padrao do Radix.
 */
export function keepFocusInOpenDialog(event: Event): void {
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
    event.preventDefault();
  }
}

/**
 * Itens do menu. As acoes destrutivas (Inativar, Cancelar, Excluir) ficam no
 * fim de cada lista e ganham uma linha divisoria antes (doc 07 §1.4).
 */
function ActionItems({
  actions,
  kind,
}: {
  actions: ListItemAction[];
  kind: "dropdown" | "context";
}) {
  const Item = kind === "dropdown" ? DropdownMenuItem : ContextMenuItem;
  const Separator = kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator;
  const Sub = kind === "dropdown" ? DropdownMenuSub : ContextMenuSub;
  const SubTrigger = kind === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger;
  const SubContent = kind === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent;

  const items = flattenActions(actions);
  const firstDestructive = items.findIndex((action) => action.destructive);

  return items.map((action, index) => {
    const separator = index > 0 && index === firstDestructive ? <Separator /> : null;

    if (action.children) {
      return (
        <Sub key={action.key}>
          <SubTrigger disabled={action.disabled}>
            {action.icon}
            <span>{action.label}</span>
          </SubTrigger>
          <SubContent className="min-w-44">
            <ActionItems actions={action.children} kind={kind} />
          </SubContent>
        </Sub>
      );
    }

    return (
      <Fragment key={action.key}>
        {separator}
        <Item
          onSelect={() => {
            if (action.disabled) return;
            action.onSelect?.();
          }}
          disabled={action.disabled}
          variant={action.destructive ? "destructive" : "default"}
        >
          {action.icon}
          <span>{action.label}</span>
        </Item>
      </Fragment>
    );
  });
}

export function ListItemActionsMenu({
  actions,
  title,
  ariaLabel,
  variant = "outline",
  isPending = false,
}: {
  actions: ListItemAction[];
  title: string;
  /** Rotulo acessivel com o nome da linha (ex.: "Ações de Ana Clara"); cai no `title`. */
  ariaLabel?: string;
  variant?: "outline" | "ghost";
  /** Mostra indicador de carregamento no gatilho enquanto uma acao direta roda. */
  isPending?: boolean;
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
          aria-busy={isPending || undefined}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48" onCloseAutoFocus={keepFocusInOpenDialog}>
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
      {/* h-full: em grade de cards, o card ocupa a altura da linha (todos iguais) */}
      <ContextMenuTrigger className="block h-full">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48" onCloseAutoFocus={onCloseAutoFocus ?? keepFocusInOpenDialog}>
        <ActionItems actions={actions} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  );
}
