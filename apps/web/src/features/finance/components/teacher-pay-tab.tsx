"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, RotateCw, Settings2, Users, Wallet } from "lucide-react";
import type { TeacherPayoutView } from "@gestarahub/contracts";
import { isRuleEffective } from "@gestarahub/core/finance";
import { formatCents, plural } from "@gestarahub/core/format";
import {
  InitialsAvatar,
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/features/auth";
import type { TeacherPayTeacher } from "@/services/teacherPayService";
import { useTeacherPayTeachers, useTeacherPayouts } from "../hooks/use-teacher-pay";
import { competenceLabel } from "../lib";
import { TeacherPayRuleDialog } from "./teacher-pay-rule-dialog";
import { TeacherPayoutDetailDialog } from "./teacher-payout-detail-dialog";
import { TeacherPayoutStatusBadge } from "./teacher-payout-status-badge";

const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

/** Por que o professor nao entra no mes (sem regra, inativa ou vigencia futura). */
function noRuleReason(teacher: TeacherPayTeacher): string {
  const rule = teacher.rule;
  if (!rule) return "Pagamento não configurado";
  if (rule.status !== "active") return "Regra de pagamento desativada";
  return `Regra vale a partir de ${competenceLabel(rule.startCompetence).toLowerCase()}`;
}

/**
 * Aba Professores do Financeiro: valor do mes de cada professor com regra
 * (previa, fechado ou pago), detalhe com fechamento/pagamento e configuracao da
 * regra. Acoes que mexem em dinheiro so com `finance:manage`.
 */
export function TeacherPayTab({ competence }: { competence: string }) {
  const can = useCan();
  const canManage = can("finance:manage");

  const teachersQuery = useTeacherPayTeachers();
  const payoutsQuery = useTeacherPayouts(competence);
  const isLoading = teachersQuery.isLoading || payoutsQuery.isLoading;
  const isError = teachersQuery.isError || payoutsQuery.isError;

  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<TeacherPayTeacher | null>(null);

  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const payouts = useMemo(() => payoutsQuery.data ?? [], [payoutsQuery.data]);
  const normalizedQuery = search.trim().toLowerCase();

  const filteredPayouts = useMemo(
    () =>
      normalizedQuery
        ? payouts.filter((p) => p.professionalName.toLowerCase().includes(normalizedQuery))
        : payouts,
    [payouts, normalizedQuery],
  );

  const withPayout = new Set(payouts.map((p) => p.professionalId));
  // Professores ativos fora do mes: sem regra, regra inativa ou vigencia futura.
  const withoutRule = teachers.filter(
    (t) =>
      t.status === "active" &&
      !withPayout.has(t.professionalId) &&
      !(t.rule && isRuleEffective(t.rule, competence)) &&
      (!normalizedQuery || t.name.toLowerCase().includes(normalizedQuery)),
  );

  const totalCents = filteredPayouts.reduce((sum, p) => sum + p.totalCents, 0);
  const paidCount = filteredPayouts.filter((p) => p.status === "paid").length;
  const closedCount = filteredPayouts.filter((p) => p.status === "closed").length;

  const openConfigure = (professionalId: string) => {
    const teacher = teachers.find((t) => t.professionalId === professionalId);
    if (!teacher) return;
    setDetailId(null);
    setConfiguring(teacher);
  };

  const retry = () => {
    void teachersQuery.refetch();
    void payoutsQuery.refetch();
  };

  if (isLoading) return <TeacherPaySkeleton />;

  if (isError) {
    return (
      <ListContainer
        emptyState={
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar o pagamento dos professores. Tente novamente.
            </p>
            <Button variant="outline" size="sm" onClick={retry}>
              <RotateCw className="size-4" />
              Tentar novamente
            </Button>
          </div>
        }
      />
    );
  }

  if (teachers.length === 0 && payouts.length === 0) {
    return (
      <ListContainer
        emptyState={
          <ModuleEmptyGuide
            icon={<Users className="size-7" />}
            title="Nenhum professor cadastrado"
            description="Cadastre os professores em Profissionais para configurar o pagamento de cada um."
          />
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar professor..."
          aria-label="Buscar professor"
        />
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <ListSummaryBar
            count={filteredPayouts.length}
            singularLabel="professor com pagamento"
            pluralLabel="professores com pagamento"
            isLoading={false}
            hasFilters={false}
          />
          {filteredPayouts.length > 0 ? (
            <span>
              {closedCount > 0 ? `${plural(closedCount, "fechado", "fechados")} · ` : ""}
              {paidCount > 0 ? `${plural(paidCount, "pago", "pagos")} · ` : ""}
              Total do mês:{" "}
              <strong className="font-semibold tabular-nums text-foreground">{formatCents(totalCents)}</strong>
            </span>
          ) : null}
        </div>

        <ListContainer
          emptyState={
            filteredPayouts.length === 0 ? (
              <ListEmptyState
                hasSearch={Boolean(normalizedQuery)}
                hasFilters={false}
                onClearSearch={() => setSearch("")}
                onClearFilters={() => {}}
                emptyGuide={
                  <ModuleEmptyGuide
                    icon={<Wallet className="size-7" />}
                    title="Nenhum professor com pagamento neste mês"
                    description={
                      canManage
                        ? "Use Configurar pagamento abaixo para definir como cada professor recebe (fixo, por aula, por aluno ou % das mensalidades)."
                        : "Ainda não há regra de pagamento vigente neste mês."
                    }
                  />
                }
              />
            ) : undefined
          }
        >
          {filteredPayouts.map((p) => (
            <PayoutRow
              key={p.professionalId}
              payout={p}
              canManage={canManage}
              onOpen={() => setDetailId(p.professionalId)}
              onConfigure={() => openConfigure(p.professionalId)}
            />
          ))}
        </ListContainer>
      </section>

      {withoutRule.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-foreground">Sem pagamento neste mês</h2>
          <ListContainer>
            {withoutRule.map((t) => (
              <ListRow
                key={t.professionalId}
                actions={
                  canManage ? (
                    <Button variant="outline" size="sm" onClick={() => setConfiguring(t)}>
                      <Settings2 className="size-4" />
                      {t.rule ? "Editar pagamento" : "Configurar pagamento"}
                    </Button>
                  ) : undefined
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <InitialsAvatar name={t.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {noRuleReason(t)}
                      {t.ruleSummary ? ` · ${t.ruleSummary}` : ""}
                    </p>
                  </div>
                </div>
              </ListRow>
            ))}
          </ListContainer>
        </section>
      ) : null}

      <TeacherPayoutDetailDialog
        professionalId={detailId}
        competence={competence}
        canManage={canManage}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onConfigure={openConfigure}
      />
      <TeacherPayRuleDialog
        teacher={configuring}
        competence={competence}
        onOpenChange={(open) => {
          if (!open) setConfiguring(null);
        }}
      />
    </div>
  );
}

function PayoutRow({
  payout,
  canManage,
  onOpen,
  onConfigure,
}: {
  payout: TeacherPayoutView;
  canManage: boolean;
  onOpen: () => void;
  onConfigure: () => void;
}) {
  const inactive = payout.professionalStatus !== "active";
  const dateInfo =
    payout.status === "paid" && payout.payout?.paidAt
      ? `pago em ${shortDate(payout.payout.paidAt)}`
      : `vence ${shortDate(payout.dueDate)}`;

  return (
    <ListRow
      onClick={onOpen}
      aria-label={`Ver pagamento de ${payout.professionalName}`}
      actions={
        canManage && payout.rule ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar pagamento de ${payout.professionalName}`}
            title="Editar pagamento"
            onClick={onConfigure}
          >
            <Settings2 className="size-4" />
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={payout.professionalName} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <span className="truncate">{payout.professionalName}</span>
              <TeacherPayoutStatusBadge status={payout.status} />
              {inactive ? (
                <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
                  Inativo
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {payout.ruleSummary ?? "Regra removida"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{formatCents(payout.totalCents)}</p>
          <p className="text-xs text-muted-foreground">{dateInfo}</p>
        </div>
      </div>
    </ListRow>
  );
}

function TeacherPaySkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando professores">
      <Skeleton className="ml-1 h-4 w-48 rounded-sm" />
      <div className="overflow-hidden rounded-xl border border-border/60">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-border/40 px-4 py-3.5 last:border-b-0 sm:px-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="ml-auto h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
