"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Contact,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListCard } from "@/components/shared/list-card";
import { ListItemCard } from "@/components/shared/list-item-card";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import { recordStatusLabel, userProfileLabel } from "@/lib/labels";
import type { RecordStatus, UserView } from "@/types";
import { useCurrentUser } from "@/features/auth/session-provider";
import { useUsers } from "../hooks/use-users";

interface UsersListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (user: UserView) => void;
  onInactivate: (user: UserView) => void;
  onReactivate: (user: UserView) => void;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
}

function UserRow({
  user,
  canManage,
  isSelf,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  user: UserView;
  canManage: boolean;
  isSelf: boolean;
  onEdit: (u: UserView) => void;
  onInactivate: (u: UserView) => void;
  onReactivate: (u: UserView) => void;
}) {
  const isActive = user.status === "active";

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "edit",
          label: "Editar",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(user),
        },
        isActive
          ? {
              key: "inactivate",
              label: isSelf ? "Inativar (você)" : "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(user),
              destructive: true,
              disabled: isSelf,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(user),
            },
      ]
    : [];

  const meta = [
    user.email,
    user.professional ? `Profissional: ${user.professional.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <ListItemCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{user.name}</p>
            <span className="inline-flex rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {userProfileLabel(user.profile)}
            </span>
            {user.professional ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
                <Contact className="size-3" />
                Equipe
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(user.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        </div>
        {canManage ? (
          <ListItemActionsMenu actions={actions} title="Ações do usuário" />
        ) : null}
      </div>
    </ListItemCard>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  ));
}

export function UsersList({
  canManage,
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: UsersListProps) {
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>("all");

  const filter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useUsers(filter);
  const users = data ?? [];

  const hasSearch = Boolean(filter.search);
  const hasFilters = Boolean(filter.status);

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os usuários. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else {
    items = users.map((user) => (
      <UserRow
        key={user.id}
        user={user}
        canManage={canManage}
        isSelf={user.id === currentUser.id}
        onEdit={onEdit}
        onInactivate={onInactivate}
        onReactivate={onReactivate}
      />
    ));
    emptyState = hasSearch ? (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum resultado para esta busca.
        </p>
        <Button variant="outline" size="sm" onClick={clearSearch}>
          Limpar busca
        </Button>
      </div>
    ) : hasFilters ? (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum resultado para os filtros aplicados.
        </p>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Limpar filtros
        </Button>
      </div>
    ) : (
      <ModuleEmptyGuide
        icon={<ShieldCheck className="size-8" />}
        title="Nenhum usuário cadastrado ainda."
        description="Cadastre quem pode acessar o sistema e defina o perfil de acesso."
        actionLabel={canManage ? "Cadastrar usuário" : undefined}
        onAction={canManage ? onCreate : undefined}
      />
    );
  }

  return (
    <ListCard
      items={items}
      emptyState={emptyState}
      filters={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="px-8"
              autoComplete="off"
              aria-label="Buscar usuário"
            />
            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "all" | RecordStatus)}
          >
            <SelectTrigger className="sm:w-36" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
