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
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InitialsAvatar,
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  RecordStatusBadge,
  SearchInput,
  StatusFilterSelect,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { userProfileLabel } from "@/lib/labels";
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
    <ListRow
      onClick={() => onEdit(user)}
      canClick={canManage}
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title="Ações do usuário"
            ariaLabel={`Ações de ${user.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <InitialsAvatar name={user.name} />

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
            <RecordStatusBadge status={user.status} />
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
    </ListRow>
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

  // Gerente so enxerga Atendente/Profissional: textos refletem esse recorte
  // (senao "nenhum usuario" mentiria com owners/gerentes cadastrados).
  const limitedView = currentUser.profile !== "owner";

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
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<ShieldCheck className="size-8" />}
            title={
              limitedView
                ? "Nenhum atendente ou profissional cadastrado."
                : "Nenhum usuário cadastrado ainda."
            }
            description={
              limitedView
                ? "Você gerencia os perfis Atendente e Profissional. Cadastre quem pode acessar o sistema."
                : "Cadastre quem pode acessar o sistema e defina o perfil de acesso."
            }
            actionLabel={canManage ? "Cadastrar usuário" : undefined}
            onAction={canManage ? onCreate : undefined}
          />
        }
      />
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
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Buscar por nome ou e-mail..."
          aria-label="Buscar usuário"
        />

        <StatusFilterSelect
          value={status}
          onChange={setStatus}
          gender="male"
        />
      </div>

      {/* Contador / Resumo */}
      {!isPending && !isError && users.length > 0 ? (
        <ListSummaryBar
          count={users.length}
          singularLabel={
            limitedView
              ? "atendente ou profissional cadastrado"
              : "usuário cadastrado"
          }
          pluralLabel={
            limitedView
              ? "atendentes ou profissionais cadastrados"
              : "usuários cadastrados"
          }
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista */}
      <ListContainer emptyState={emptyState}>
        {items}
      </ListContainer>
    </div>
  );
}
