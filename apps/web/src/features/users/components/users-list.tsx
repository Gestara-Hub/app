"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Contact,
  Mail,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { cn } from "@/lib/utils";
import { recordStatusLabel, userProfileLabel } from "@/lib/labels";
import { canManageProfile } from "@/lib/permissions";
import type { RecordStatus, UserView } from "@gestarahub/contracts";
import { useCurrentUser } from "@/features/auth";
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
    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border border-border/60 bg-muted/50 text-muted-foreground";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  const content = (
    <div
      onClick={() => {
        if (canManage) onEdit(user);
      }}
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onKeyDown={(e) => {
        if (canManage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit(user);
        }
      }}
      className={cn(
        "group flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 transition-colors duration-150 hover:bg-muted/40",
        canManage && "cursor-pointer",
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Avatar className="size-9 shrink-0 border border-border/50 bg-muted/60 text-xs font-semibold text-foreground/80 select-none">
          <AvatarFallback className="bg-muted/70 text-foreground text-xs font-semibold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {user.name}
            </p>
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {userProfileLabel(user.profile)}
            </span>
            {user.professional ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                <Contact className="size-3" />
                Equipe
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none shrink-0",
                statusPillClass(isActive),
              )}
            >
              {recordStatusLabel(user.status)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Mail className="size-3 text-muted-foreground/60" />
              <span className="truncate">{user.email}</span>
            </span>
            {user.professional ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3 text-muted-foreground/60" />
                <span>{user.professional.name}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do usuário"
            variant="ghost"
          />
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function SkeletonRows({ showAction }: { showAction: boolean }) {
  return Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="space-y-1.5 min-w-0 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      {showAction ? <Skeleton className="size-8 rounded-md shrink-0" /> : null}
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
  // Só exibe usuários que o usuário atual pode gerenciar (Gerente vê apenas
  // Atendente/Profissional; Owner vê todos). Reforça a restrição de perfis-alvo.
  const users = (data ?? []).filter((u) =>
    canManageProfile(currentUser, u.profile),
  );

  const hasSearch = Boolean(filter.search);
  const hasFilters = status !== "all";

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus("all");
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" showAction={canManage} />];
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
  } else if (users.length === 0) {
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
      <div className="py-6">
        <ModuleEmptyGuide
          icon={<ShieldCheck className="size-8" />}
          title="Nenhum usuário cadastrado ainda."
          description="Cadastre quem pode acessar o sistema e defina o perfil de acesso."
          actionLabel={canManage ? "Cadastrar usuário" : undefined}
          onAction={canManage ? onCreate : undefined}
        />
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
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9 pr-8"
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

      {/* Contador / Resumo */}
      {!isPending && !isError && users.length > 0 ? (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {users.length === 1
              ? "1 usuário cadastrado"
              : `${users.length} usuários cadastrados`}
          </span>
          {hasSearch || hasFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-primary hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Container Unificado da Lista */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs shadow-xs">
        {emptyState ? (
          emptyState
        ) : (
          <div className="divide-y divide-border/40">{items}</div>
        )}
      </div>
    </div>
  );
}
