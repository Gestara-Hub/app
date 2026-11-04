"use client";

import { useTeamWords } from "@/features/settings";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  Contact,
  Mail,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Send,
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
  ViewModeSkeleton,
  ViewModeToggle,
  useViewMode,
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

/** Padrao: so ativos (o dia a dia); inativos ficam a um clique no filtro (01/11/2026). */
const DEFAULT_STATUS: "all" | RecordStatus = "active";

interface UsersListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (user: UserView) => void;
  onInactivate: (user: UserView) => void;
  onReactivate: (user: UserView) => void;
  onResendInvite?: (user: UserView) => void;
}

interface UserItemProps {
  user: UserView;
  canManage: boolean;
  isSelf: boolean;
  onEdit: (u: UserView) => void;
  onInactivate: (u: UserView) => void;
  onReactivate: (u: UserView) => void;
  onResendInvite?: (u: UserView) => void;
}

/** Acoes do usuario (menu ⋮ e botao direito), iguais na linha e no cartao. */
function userActions({ user, canManage, isSelf, onEdit, onInactivate, onReactivate, onResendInvite }: UserItemProps): ListItemAction[] {
  const isActive = user.status === "active";
  return canManage
    ? [
        ...(user.pendingInvite && onResendInvite
          ? [
              {
                key: "resend-invite",
                label: "Reenviar convite",
                icon: <Send className="size-4" />,
                onSelect: () => onResendInvite(user),
              },
            ]
          : []),
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
}

/** Etiquetas do usuario: perfil, equipe, convite pendente e situacao. */
function UserTags({ user }: { user: UserView }) {
  const team = useTeamWords();
  return (
    <>
      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {userProfileLabel(user.profile, team.title)}
      </span>
      {user.professional ? (
        <span
          title={`Vinculado a ${user.professional.name}`}
          className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400"
        >
          <Contact className="size-3" />
          Equipe
        </span>
      ) : null}
      {user.pendingInvite ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          <Clock className="size-3" />
          Convite pendente
        </span>
      ) : null}
      <RecordStatusBadge status={user.status} />
    </>
  );
}

function UserRow(props: UserItemProps) {
  const { user, canManage, onEdit } = props;
  const actions = userActions(props);

  const content = (
    <ListRow
      onClick={canManage ? () => onEdit(user) : undefined}
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
            <p className="min-w-0 font-medium text-sm text-foreground break-words group-hover:text-primary transition-colors">
              {user.name}
            </p>
            <UserTags user={user} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="size-3 text-muted-foreground/60" />
              <span className="break-all">{user.email}</span>
            </span>
            {user.professional &&
            user.professional.name.trim().toLowerCase() !==
              user.name.trim().toLowerCase() ? (
              <span className="inline-flex items-center gap-1.5" title={`Profissional: ${user.professional.name}`}>
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

/** Cartao do modo "Cartões" (01/11/2026), com os mesmos dados e acoes da linha. */
function UserCard(props: UserItemProps) {
  const { user, canManage, onEdit } = props;
  const actions = userActions(props);
  const card = (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={canManage ? () => onEdit(user) : undefined}
      onKeyDown={(e) => {
        if (canManage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onEdit(user);
        }
      }}
      className={`group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-colors ${canManage ? "cursor-pointer hover:border-primary/40 hover:bg-muted/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <InitialsAvatar name={user.name} />
          <div className="min-w-0">
            <p className="min-w-0 break-words text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{user.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <UserTags user={user} />
            </div>
          </div>
        </div>
        {canManage ? (
          <div className="-mr-2 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <ListItemActionsMenu actions={actions} title="Ações do usuário" ariaLabel={`Ações de ${user.name}`} variant="ghost" />
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-1 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="size-3.5 text-muted-foreground/60" />
          <span className="break-all">{user.email}</span>
        </span>
        {user.professional &&
        user.professional.name.trim().toLowerCase() !==
          user.name.trim().toLowerCase() ? (
          <span className="inline-flex items-center gap-1.5" title={`Profissional: ${user.professional.name}`}>
            <User className="size-3.5 text-muted-foreground/60" />
            <span>{user.professional.name}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function UserSkeletonCards({ showAction }: { showAction: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            {showAction ? <Skeleton className="size-8 shrink-0 rounded-md" /> : null}
          </div>
          <div className="mt-4 border-t border-border/50 pt-3">
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
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
  onResendInvite,
}: UsersListProps) {
  const team = useTeamWords();
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RecordStatus>(DEFAULT_STATUS);
  const [viewMode, setViewMode] = useViewMode("users", "list");

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
  // O padrao (ativos) nao conta como filtro aplicado; limpar volta para ele.
  const hasFilters = status !== DEFAULT_STATUS;

  const clearSearch = () => setSearch("");
  const clearAll = () => {
    setSearch("");
    setStatus(DEFAULT_STATUS);
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os usuários. Tente novamente.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
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
                ? `Nenhum atendente ou ${team.lower} cadastrado.`
                : "Nenhum usuário cadastrado ainda."
            }
            description={
              limitedView
                ? `Você gerencia os perfis Atendente e ${team.title}. Cadastre quem pode acessar o sistema.`
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
        onResendInvite={onResendInvite}
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

        <div className="flex items-center gap-2">
          <StatusFilterSelect
            value={status}
            onChange={setStatus}
            gender="male"
          />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Contador / Resumo */}
      {!isError ? (
        <ListSummaryBar
          isLoading={isPending}
          count={users.length}
          singularLabel={
            limitedView
              ? `atendente ou ${team.lower} cadastrado`
              : "usuário cadastrado"
          }
          pluralLabel={
            limitedView
              ? `atendentes ou ${team.lowerPlural} cadastrados`
              : "usuários cadastrados"
          }
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Lista ou grade de cartoes */}
      {isPending ? (
        <ViewModeSkeleton
          storageKey="users"
          mode={viewMode}
          list={
            <ListContainer>
              <SkeletonRows showAction={canManage} />
            </ListContainer>
          }
          grid={<UserSkeletonCards showAction={canManage} />}
        />
      ) : !isError && users.length > 0 && viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              canManage={canManage}
              isSelf={user.id === currentUser.id}
              onEdit={onEdit}
              onInactivate={onInactivate}
              onReactivate={onReactivate}
              onResendInvite={onResendInvite}
            />
          ))}
        </div>
      ) : (
        <ListContainer emptyState={emptyState}>
          {items}
        </ListContainer>
      )}
    </div>
  );
}
