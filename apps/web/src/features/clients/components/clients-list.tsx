"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  Ruler,
  GraduationCap,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Phone,
  Power,
  PowerOff,
  Receipt,
  RotateCw,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InitialsAvatar,
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  PaginationBar,
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
import { BeltBadge } from "@/components/shared/belt-badge";
import { MinorConsentBadge, isMinorConsentPending } from "@/components/shared/minor-consent-badge";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { sharedVocabularyFor, vocabularyForModality } from "@/lib/business-segment-presets";
import { ageAt, isAgedOutOfLevel, resolveModalityTrack, resolveTrackStyle } from "@/lib/progression-tracks";
import { LevelChangeBadge } from "@/components/shared/level-change-badge";
import { whatsappNumber } from "@/lib/whatsapp";
import { formatPhone } from "@gestarahub/core/format";
import type {
  Category,
  Client,
  ClientFilter,
  RecordStatus,
  StudentPackageView,
} from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { useSegmentVocabulary } from "@/features/settings";
import { useCategories } from "@/features/categories";
import {
  canSellPackageTo,
  cancelablePackage,
  useEnrolledModalities,
  useStudentPackages,
} from "@/features/turmas";
import { usePaginatedClients } from "../hooks/use-clients";
import { useUserPreferences } from "@/features/preferences";
import { minorConsentUrl } from "@/lib/minor-consent-link";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Palavras das modalidades do aluno (menu "Graduação"/"Níveis"): as delas
 * quando todas falam igual; aluno em modalidades mistas fica com as da area.
 */
function useClientVocabulary(client: Client, categoryById: Map<string, Category>) {
  const area = useSegmentVocabulary();
  // Tambem as modalidades das turmas dele: aluno de modulos sem nivel salvo
  // ve "Definir módulo", nao a palavra da area.
  const { data: enrolled } = useEnrolledModalities();
  const ids = new Set([
    ...Object.keys(client.progressions ?? {}),
    ...(enrolled ?? []).filter((pair) => pair.studentId === client.id).map((pair) => pair.modalityId),
  ]);
  return sharedVocabularyFor(
    [...ids].map((id) => categoryById.get(id)),
    area,
  );
}

function ClientProgressionBadges({
  client,
  categoryById,
  onOpenGraduation,
}: {
  client: Client;
  categoryById: Map<string, Category>;
  onOpenGraduation?: (client: Client) => void;
}) {
  const vocabulary = useClientVocabulary(client, categoryById);
  const age = ageAt(client.birthDate, dateInSpace());
  const entries = Object.values(client.progressions ?? {});
  const resolvedBadges = entries
    .map((prog) => {
      const cat = categoryById.get(prog.modalityId);
      if (!cat) return null;
      const track = resolveModalityTrack(cat);
      if (!track.enabled) return null;
      const lvl =
        track.levels.find(
          (l) => l.id === prog.levelId || l.name === prog.levelName,
        ) ?? track.levels[0];
      if (!lvl) return null;
      return {
        modalityId: prog.modalityId,
        modalityName: cat.name,
        level: lvl,
        style: resolveTrackStyle(track),
        subLevel: prog.subLevel,
        // Passou da idade do nivel: "Trocar faixa" tambem na lista.
        agedOut: isAgedOutOfLevel(lvl, age),
        levelWord: vocabularyForModality(cat, vocabulary).level,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  // "Definir nível" e aniversário ficam só na ficha: a lista mostra o que pede ação (decisão de 24/10).
  if (resolvedBadges.length === 0) return null;

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1.5"
      onClick={(e) => {
        if (onOpenGraduation) {
          e.stopPropagation();
          onOpenGraduation(client);
        }
      }}
    >
      {resolvedBadges.slice(0, 2).map((b) => (
        <BeltBadge
          key={b.modalityId}
          name={
            resolvedBadges.length > 1
              ? `${b.modalityName.split(" ")[0]} · ${b.level.name}`
              : b.level.name
          }
          color={b.level.color}
          variant={b.style}
          subLevel={b.subLevel}
          maxSubLevels={b.level.maxSubLevels}
          size="xs"
        />
      ))}
      {resolvedBadges.slice(0, 2).map((b) =>
        b.agedOut ? (
          <LevelChangeBadge key={`change-${b.modalityId}`} level={b.level} birthDate={client.birthDate} levelWord={b.levelWord} />
        ) : null,
      )}
    </div>
  );
}

const NO_PACKAGES: StudentPackageView[] = [];

function minorConsentAction(client: Client): ListItemAction | null {
  if (!isMinorConsentPending(client)) return null;

  return {
    key: "minor-consent",
    label: "Enviar autorização (WhatsApp)",
    icon: <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />,
    onSelect: () => {
      const url = minorConsentUrl(client.id);
      const guardian = client.guardians?.find((g) => Boolean(g.phone)) || client.guardians?.[0];
      const targetPhone = guardian?.phone || client.phone;
      const greeting = guardian?.name ? `, ${guardian.name}` : "";
      const msg = `Olá${greeting}! Segue o link de autorização de matrícula e LGPD do aluno(a) ${client.name}:\n\n${url}\n\nPor favor, acesse o link para conferir e confirmar pelo celular. Obrigado!`;

      if (targetPhone) {
        const cleanPhone = targetPhone.replace(/\D/g, "");
        const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, "_blank");
      } else {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          toast.info("Nenhum telefone de contato encontrado. Link copiado para a área de transferência.");
        }
      }
    },
  };
}

interface ClientsListProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  /** Mensagem no WhatsApp (so com permissao de comunicacao). */
  onSendMessage?: (client: Client) => void;
  onOpenGraduation?: (client: Client) => void;
  onOpenRecords?: (client: Client) => void;
  /** Boletim "Notas" (so quando alguma modalidade tem avaliacoes). */
  onOpenGrades?: (client: Client) => void;
  /** "Testes e medidas" (so quando alguma modalidade tem medidas). */
  onOpenMeasurements?: (client: Client) => void;
  /** Nova cobranca avulsa (so com permissao de cobranca). */
  onNewCharge?: (client: Client) => void;
  /** Venda e cancelamento de pacote de aulas (mesma permissao). */
  onSellPackage?: (client: Client) => void;
  onCancelPackage?: (pkg: StudentPackageView) => void;
  onInactivate: (client: Client) => void;
  onReactivate: (client: Client) => void;
}

function ClientRow({
  client,
  categoryById,
  canManage,
  isClasses,
  onEdit,
  onSendMessage,
  onOpenGraduation,
  onOpenRecords,
  onOpenGrades,
  onOpenMeasurements,
  onNewCharge,
  onSellPackage,
  onCancelPackage,
  packages,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  categoryById: Map<string, Category>;
  canManage: boolean;
  isClasses: boolean;
  onEdit: (c: Client) => void;
  onSendMessage?: (c: Client) => void;
  onOpenGraduation?: (c: Client) => void;
  onOpenRecords?: (c: Client) => void;
  onOpenGrades?: (c: Client) => void;
  onOpenMeasurements?: (c: Client) => void;
  onNewCharge?: (c: Client) => void;
  onSellPackage?: (c: Client) => void;
  onCancelPackage?: (pkg: StudentPackageView) => void;
  packages: StudentPackageView[];
  onInactivate: (c: Client) => void;
  onReactivate: (c: Client) => void;
}) {
  const vocabulary = useClientVocabulary(client, categoryById);
  const isActive = client.status === "active";
  const cancelable = cancelablePackage(packages);
  const router = useRouter();
  const openProfile = () => router.push(`/clients/${client.id}`);

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "profile",
          label: "Abrir ficha",
          icon: <UserRound className="size-4" />,
          onSelect: openProfile,
        },
        ...(onSendMessage && whatsappNumber(client.phone)
          ? [
              {
                key: "whatsapp",
                label: "Enviar WhatsApp",
                icon: <MessageCircle className="size-4" />,
                onSelect: () => onSendMessage(client),
              },
            ]
          : []),
        ...(minorConsentAction(client) ? [minorConsentAction(client)!] : []),
        ...(isClasses && onOpenRecords
          ? [
              {
                key: "records",
                label: "Registros de aula",
                icon: <MessageSquarePlus className="size-4" />,
                onSelect: () => onOpenRecords(client),
              },
            ]
          : []),
        ...(isClasses && onOpenGraduation
          ? [
              {
                key: "graduation",
                label: vocabulary.levelsTitle,
                icon: <GraduationCap className="size-4" />,
                onSelect: () => onOpenGraduation(client),
              },
            ]
          : []),
        ...(isClasses && onOpenGrades
          ? [
              {
                key: "grades",
                label: "Notas",
                icon: <ClipboardList className="size-4" />,
                onSelect: () => onOpenGrades(client),
              },
            ]
          : []),
        ...(isClasses && onOpenMeasurements
          ? [
              {
                key: "measurements",
                label: "Testes e medidas",
                icon: <Ruler className="size-4" />,
                onSelect: () => onOpenMeasurements(client),
              },
            ]
          : []),
        ...(isClasses && onNewCharge && isActive
          ? [
              {
                key: "new-charge",
                label: "Nova cobrança",
                icon: <Receipt className="size-4" />,
                onSelect: () => onNewCharge(client),
              },
            ]
          : []),
        ...(isClasses && onSellPackage && canSellPackageTo(client)
          ? [
              {
                key: "sell-package",
                label: "Vender pacote",
                icon: <Ticket className="size-4" />,
                onSelect: () => onSellPackage(client),
              },
            ]
          : []),
        ...(isClasses && onCancelPackage && cancelable
          ? [
              {
                key: "cancel-package",
                label: "Cancelar pacote",
                icon: <Ban className="size-4" />,
                destructive: true,
                onSelect: () => onCancelPackage(cancelable),
              },
            ]
          : []),
        {
          key: "edit",
          label: "Editar cadastro",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(client),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(client),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(client),
            },
      ]
    : [];

  const content = (
    <ListRow
      onClick={openProfile}
      mouseOnly
      actions={
        canManage ? (
          <ListItemActionsMenu
            actions={actions}
            title={isClasses ? "Ações do aluno" : "Ações do cliente"}
            ariaLabel={`Ações de ${client.name}`}
            variant="ghost"
          />
        ) : null
      }
    >
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <InitialsAvatar name={client.name} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/clients/${client.id}`}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 inline-flex min-h-6 items-center font-medium text-sm text-foreground break-words group-hover:text-primary transition-colors"
              >
                {client.name}
              </Link>
              {client.status !== "active" ? <RecordStatusBadge status={client.status} /> : null}
              <MinorConsentBadge client={client} compact />
              {isClasses ? (
                <ClientProgressionBadges
                  client={client}
                  categoryById={categoryById}
                  onOpenGraduation={onOpenGraduation}
                />
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
              {client.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3 text-muted-foreground/60" />
                  <span>{formatPhone(client.phone)}</span>
                </span>
              ) : null}
              {client.email ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3 text-muted-foreground/60" />
                  <span className="break-all">{client.email}</span>
                </span>
              ) : null}
            </div>

          </div>
        </div>

      </div>
    </ListRow>
  );

  if (!canManage) return content;
  return <ListItemContextMenu actions={actions}>{content}</ListItemContextMenu>;
}

function ClientCard({
  client,
  categoryById,
  canManage,
  isClasses,
  onEdit,
  onSendMessage,
  onOpenGraduation,
  onOpenRecords,
  onOpenGrades,
  onOpenMeasurements,
  onNewCharge,
  onSellPackage,
  onCancelPackage,
  packages,
  onInactivate,
  onReactivate,
}: {
  client: Client;
  categoryById: Map<string, Category>;
  canManage: boolean;
  isClasses: boolean;
  onEdit: (c: Client) => void;
  onSendMessage?: (c: Client) => void;
  onOpenGraduation?: (c: Client) => void;
  onOpenRecords?: (c: Client) => void;
  onOpenGrades?: (c: Client) => void;
  onOpenMeasurements?: (c: Client) => void;
  onNewCharge?: (c: Client) => void;
  onSellPackage?: (c: Client) => void;
  onCancelPackage?: (pkg: StudentPackageView) => void;
  packages: StudentPackageView[];
  onInactivate: (c: Client) => void;
  onReactivate: (c: Client) => void;
}) {
  const vocabulary = useClientVocabulary(client, categoryById);
  const isActive = client.status === "active";
  const cancelable = cancelablePackage(packages);
  const router = useRouter();
  const openProfile = () => router.push(`/clients/${client.id}`);

  const actions: ListItemAction[] = canManage
    ? [
        {
          key: "profile",
          label: "Abrir ficha",
          icon: <UserRound className="size-4" />,
          onSelect: openProfile,
        },
        ...(onSendMessage && whatsappNumber(client.phone)
          ? [
              {
                key: "whatsapp",
                label: "Enviar WhatsApp",
                icon: <MessageCircle className="size-4" />,
                onSelect: () => onSendMessage(client),
              },
            ]
          : []),
        ...(minorConsentAction(client) ? [minorConsentAction(client)!] : []),
        ...(isClasses && onOpenRecords
          ? [
              {
                key: "records",
                label: "Registros de aula",
                icon: <MessageSquarePlus className="size-4" />,
                onSelect: () => onOpenRecords(client),
              },
            ]
          : []),
        ...(isClasses && onOpenGraduation
          ? [
              {
                key: "graduation",
                label: vocabulary.levelsTitle,
                icon: <GraduationCap className="size-4" />,
                onSelect: () => onOpenGraduation(client),
              },
            ]
          : []),
        ...(isClasses && onOpenGrades
          ? [
              {
                key: "grades",
                label: "Notas",
                icon: <ClipboardList className="size-4" />,
                onSelect: () => onOpenGrades(client),
              },
            ]
          : []),
        ...(isClasses && onOpenMeasurements
          ? [
              {
                key: "measurements",
                label: "Testes e medidas",
                icon: <Ruler className="size-4" />,
                onSelect: () => onOpenMeasurements(client),
              },
            ]
          : []),
        ...(isClasses && onNewCharge && isActive
          ? [
              {
                key: "new-charge",
                label: "Nova cobrança",
                icon: <Receipt className="size-4" />,
                onSelect: () => onNewCharge(client),
              },
            ]
          : []),
        ...(isClasses && onSellPackage && canSellPackageTo(client)
          ? [
              {
                key: "sell-package",
                label: "Vender pacote",
                icon: <Ticket className="size-4" />,
                onSelect: () => onSellPackage(client),
              },
            ]
          : []),
        ...(isClasses && onCancelPackage && cancelable
          ? [
              {
                key: "cancel-package",
                label: "Cancelar pacote",
                icon: <Ban className="size-4" />,
                destructive: true,
                onSelect: () => onCancelPackage(cancelable),
              },
            ]
          : []),
        {
          key: "edit",
          label: "Editar cadastro",
          icon: <Pencil className="size-4" />,
          onSelect: () => onEdit(client),
        },
        isActive
          ? {
              key: "inactivate",
              label: "Inativar",
              icon: <PowerOff className="size-4" />,
              onSelect: () => onInactivate(client),
              destructive: true,
            }
          : {
              key: "reactivate",
              label: "Reativar",
              icon: <Power className="size-4" />,
              onSelect: () => onReactivate(client),
            },
      ]
    : [];

  const card = (
    <div
      onClick={openProfile}
      className="group flex h-full cursor-pointer flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar name={client.name} />
            <div className="min-w-0">
              <Link
                href={`/clients/${client.id}`}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 inline-flex min-h-6 items-center break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
              >
                {client.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {client.status !== "active" ? <RecordStatusBadge status={client.status} /> : null}
                <MinorConsentBadge client={client} compact />
                {isClasses ? (
                  <ClientProgressionBadges
                    client={client}
                    categoryById={categoryById}
                    onOpenGraduation={onOpenGraduation}
                  />
                ) : null}
              </div>
            </div>
          </div>

          {canManage ? (
            <div
              className="-mr-2 -mt-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ListItemActionsMenu
                actions={actions}
                title={isClasses ? "Ações do aluno" : "Ações do cliente"}
                ariaLabel={`Ações de ${client.name}`}
                variant="ghost"
              />
            </div>
          ) : null}
        </div>

      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        {client.phone ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Phone className="size-3.5 text-muted-foreground/60" />
            <span>{formatPhone(client.phone)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">Sem telefone</span>
        )}
        {client.email ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="break-all">{client.email}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!canManage) return card;
  return <ListItemContextMenu actions={actions}>{card}</ListItemContextMenu>;
}

function SkeletonRows({
  showAction,
  isClasses,
}: {
  showAction: boolean;
  isClasses: boolean;
}) {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="space-y-1.5 min-w-0 flex-1">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-28 max-w-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isClasses ? (
          <Skeleton className="hidden h-5 w-44 rounded-full sm:block" />
        ) : null}
        {showAction ? (
          <div className="flex size-8 shrink-0 items-center justify-center">
            <Skeleton className="h-4 w-1.5 rounded-full" />
          </div>
        ) : null}
      </div>
    </div>
  ));
}

function ClientSkeletonCards({
  showAction,
  isClasses,
}: {
  showAction: boolean;
  isClasses: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </div>
              {showAction ? (
                <div className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center">
                  <Skeleton className="h-4 w-1.5 rounded-full" />
                </div>
              ) : null}
            </div>
            {isClasses ? (
              <Skeleton className="h-5 w-48 max-w-full rounded-full" />
            ) : null}
          </div>
          <div className="mt-4 border-t border-border/50 pt-3">
            <Skeleton className="h-3.5 w-28 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_STATUS: "all" | RecordStatus = "active";

export function ClientsList({
  canManage,
  onEdit,
  onSendMessage,
  onOpenGraduation,
  onOpenRecords,
  onOpenGrades,
  onOpenMeasurements,
  onNewCharge,
  onSellPackage,
  onCancelPackage,
  onInactivate,
  onReactivate,
}: ClientsListProps) {
  const isClasses = useModel() === "classes";
  const [search, setSearch] = useState("");
  // Padrao: so ativos (o dia a dia); inativos ficam a um clique no filtro.
  const [status, setStatus] = useState<"all" | RecordStatus>(DEFAULT_STATUS);
  const [viewMode, setViewMode] = useViewMode("clients", "list");
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () => preferences.pageSizes?.clients ?? preferences.defaultPageSize ?? 20,
  );

  const filter: ClientFilter = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    page,
    pageSize,
  };

  const { data: paginatedData, isPending, isError, refetch } = usePaginatedClients(filter);
  const { data: categories } = useCategories();
  const { data: studentPackages } = useStudentPackages(undefined, isClasses);
  const clients = paginatedData?.items ?? [];
  const total = paginatedData?.total ?? 0;
  const totalPages = paginatedData?.totalPages ?? 1;

  const packagesByStudent = useMemo(() => {
    const map = new Map<string, StudentPackageView[]>();
    for (const p of studentPackages ?? []) {
      map.set(p.studentId, [...(map.get(p.studentId) ?? []), p]);
    }
    return map;
  }, [studentPackages]);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  // "Notas" no menu so quando alguma modalidade ativa tem avaliacoes.
  const gradesAction = (categories ?? []).some((c) => c.status === "active" && c.assessments?.enabled)
    ? onOpenGrades
    : undefined;
  // "Testes e medidas" so quando alguma modalidade ativa tem medidas.
  const measurementsAction = (categories ?? []).some((c) => c.status === "active" && c.measurements?.enabled)
    ? onOpenMeasurements
    : undefined;

  const hasSearch = Boolean(filter.search);
  // O padrao (ativos) nao conta como filtro aplicado; limpar volta para ele.
  const hasFilters = status !== DEFAULT_STATUS;

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };
  const clearAll = () => {
    setSearch("");
    setStatus(DEFAULT_STATUS);
    setPage(1);
  };

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [
      <SkeletonRows
        key="skeleton"
        showAction={canManage}
        isClasses={isClasses}
      />,
    ];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isClasses
            ? "Não foi possível carregar os alunos. Tente novamente."
            : "Não foi possível carregar os clientes. Tente novamente."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else if (clients.length === 0) {
    emptyState = (
      <ListEmptyState
        hasSearch={hasSearch}
        hasFilters={hasFilters}
        onClearSearch={clearSearch}
        onClearFilters={clearAll}
        emptyGuide={
          <ModuleEmptyGuide
            icon={<Users className="size-8" />}
            title={
              isClasses
                ? "Nenhum aluno cadastrado ainda."
                : "Nenhum cliente cadastrado ainda."
            }
            description={
              isClasses
                ? "Cadastre seus alunos para matriculá-los em turmas e acompanhar mensalidades."
                : "Cadastre seus clientes para agendá-los e acompanhar o histórico."
            }
          />
        }
      />
    );
  } else {
    items = clients.map((client) => (
      <ClientRow
        key={client.id}
        client={client}
        categoryById={categoryById}
        canManage={canManage}
        isClasses={isClasses}
        onEdit={onEdit}
        onSendMessage={onSendMessage}
        onOpenGraduation={onOpenGraduation}
        onOpenRecords={onOpenRecords}
        onOpenGrades={gradesAction}
        onOpenMeasurements={measurementsAction}
        onNewCharge={onNewCharge}
        onSellPackage={onSellPackage}
        onCancelPackage={onCancelPackage}
        packages={packagesByStudent.get(client.id) ?? NO_PACKAGES}
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
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onClear={clearSearch}
          placeholder="Buscar por nome ou telefone..."
          aria-label={isClasses ? "Buscar aluno" : "Buscar cliente"}
        />
        <div className="flex items-center gap-2">
          <StatusFilterSelect
            value={status}
            onChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
          />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Contador / Resumo */}
      {!isError ? (
        <ListSummaryBar
          isLoading={isPending}
          count={total}
          singularLabel={isClasses ? "aluno cadastrado" : "cliente cadastrado"}
          pluralLabel={isClasses ? "alunos cadastrados" : "clientes cadastrados"}
          hasFilters={hasSearch || hasFilters}
          onClearFilters={clearAll}
        />
      ) : null}

      {/* Container Unificado da Lista ou Grade de Cards */}
      {isPending ? (
        <ViewModeSkeleton
          storageKey="clients"
          mode={viewMode}
          list={
            <ListContainer>
              <SkeletonRows showAction={canManage} isClasses={isClasses} />
            </ListContainer>
          }
          grid={
            <ClientSkeletonCards
              showAction={canManage}
              isClasses={isClasses}
            />
          }
        />
      ) : !isError && clients.length > 0 && viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              categoryById={categoryById}
              canManage={canManage}
              isClasses={isClasses}
              onEdit={onEdit}
              onSendMessage={onSendMessage}
              onOpenGraduation={onOpenGraduation}
              onOpenRecords={onOpenRecords}
              onOpenGrades={gradesAction}
              onOpenMeasurements={measurementsAction}
              onNewCharge={onNewCharge}
              onSellPackage={onSellPackage}
              onCancelPackage={onCancelPackage}
              packages={packagesByStudent.get(client.id) ?? NO_PACKAGES}
              onInactivate={onInactivate}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      ) : (
        <ListContainer emptyState={emptyState}>{items}</ListContainer>
      )}

      {/* Paginação */}
      {!isError && total > 0 ? (
        <PaginationBar
          screenKey="clients"
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemLabel={isClasses ? "alunos" : "clientes"}
        />
      ) : null}
    </div>
  );
}

