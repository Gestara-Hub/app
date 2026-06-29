"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ListCard } from "@/components/shared/list-card";
import { ListItemCard } from "@/components/shared/list-item-card";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@/lib/api-error";
import { recordStatusLabel } from "@/lib/labels";
import type { Role } from "@/types";
import {
  useInactivateRole,
  useRoles,
  useUpdateRole,
} from "../hooks/use-roles";

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
}

function StatusPill({ status }: { status: Role["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        statusPillClass(status === "active"),
      )}
    >
      {recordStatusLabel(status)}
    </span>
  );
}

/** Linha em modo edicao: input inline + botoes salvar/cancelar. */
function RoleRowEditor({
  role,
  onCancel,
  onSaved,
}: {
  role: Role;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMut = useUpdateRole();
  const pending = updateMut.isPending;

  // Foca o input ao abrir. Usamos rAF (em vez de `autoFocus`) para rodar DEPOIS
  // do restore de foco do menu — ao fechar, o Radix devolve o foco ao gatilho/
  // elemento anterior, e no context menu (right-click) isso roubava o foco.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do cargo.");
      return;
    }
    if (trimmed === role.name) {
      onCancel();
      return;
    }
    try {
      await updateMut.mutateAsync({ id: role.id, payload: { name: trimmed } });
      toast.success("Cargo atualizado com sucesso.");
      onSaved();
    } catch (err) {
      const nameError = getFieldErrors(err)?.find((f) => f.field === "name");
      if (nameError) {
        setError(nameError.message);
      } else {
        toast.error(getErrorMessage(err, "Não foi possível salvar o cargo."));
      }
    }
  }

  return (
    <ListItemCard isActive disableHover>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          aria-label="Editar nome do cargo"
          aria-invalid={Boolean(error)}
          disabled={pending}
          className="h-8 flex-1"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <Button
          type="button"
          size="icon-sm"
          title="Salvar"
          aria-label="Salvar"
          disabled={pending}
          onClick={() => void save()}
        >
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Cancelar"
          aria-label="Cancelar"
          disabled={pending}
          onClick={onCancel}
        >
          <X className="size-4" />
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : null}
    </ListItemCard>
  );
}

/** Linha em modo exibicao: nome + status + acoes. */
function RoleRow({
  role,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  role: Role;
  onEdit: (r: Role) => void;
  onInactivate: (r: Role) => void;
  onReactivate: (r: Role) => void;
}) {
  const isActive = role.status === "active";

  const actions: ListItemAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: <Pencil className="size-4" />,
      onSelect: () => onEdit(role),
    },
    isActive
      ? {
          key: "inactivate",
          label: "Inativar",
          icon: <PowerOff className="size-4" />,
          onSelect: () => onInactivate(role),
          destructive: true,
        }
      : {
          key: "reactivate",
          label: "Reativar",
          icon: <Power className="size-4" />,
          onSelect: () => onReactivate(role),
        },
  ];

  const content = (
    <ListItemCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-medium">{role.name}</p>
          <StatusPill status={role.status} />
        </div>
        <ListItemActionsMenu actions={actions} title="Ações do cargo" />
      </div>
    </ListItemCard>
  );

  return (
    <ListItemContextMenu
      actions={actions}
      // Editar transforma a linha em input inline; impedir o restore de foco do
      // menu evita que ele roube o foco do input recem-montado.
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {content}
    </ListItemContextMenu>
  );
}

function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  ));
}

export function RolesList() {
  const { data, isPending, isError, refetch } = useRoles();
  const roles = data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const inactivateMut = useInactivateRole();
  const updateMut = useUpdateRole();

  async function inactivate(role: Role) {
    try {
      await inactivateMut.mutateAsync(role.id);
      toast.success("Cargo inativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível inativar o cargo."));
    }
  }

  async function reactivate(role: Role) {
    try {
      await updateMut.mutateAsync({ id: role.id, payload: { status: "active" } });
      toast.success("Cargo reativado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível reativar o cargo."));
    }
  }

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os cargos.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else {
    items = roles.map((role) =>
      role.id === editingId ? (
        <RoleRowEditor
          key={role.id}
          role={role}
          onCancel={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      ) : (
        <RoleRow
          key={role.id}
          role={role}
          onEdit={(r) => setEditingId(r.id)}
          onInactivate={inactivate}
          onReactivate={reactivate}
        />
      ),
    );
    emptyState = (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum cargo cadastrado ainda.
      </p>
    );
  }

  return <ListCard items={items} emptyState={emptyState} />;
}
