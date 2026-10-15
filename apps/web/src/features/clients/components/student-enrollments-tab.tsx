"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, ExternalLink, GraduationCap, Lock } from "lucide-react";
import {
  ListContainer,
  ListEmptyState,
  ListRow,
  ListSummaryBar,
  SearchInput,
} from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeText } from "@/lib/text";
import { formatCents, plural } from "@gestarahub/core/format";
import type { StudentEnrollmentState, StudentSummaryEnrollment } from "@gestarahub/contracts";
import { useHasFeature } from "@/features/auth";
import { brDate, EnrollmentStateBadge } from "./student-profile-parts";

type StateFilter = "all" | StudentEnrollmentState;

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "paused", label: "Trancadas" },
  { value: "completed", label: "Concluídas" },
  { value: "canceled", label: "Canceladas" },
];

const MODE_LABEL = { course: "Curso", package: "Pacote de aulas", free: "Sem cobrança" } as const;

/** "Curso R$ 600,00 em 3x · 1 de 3 pagas · R$ 400,00 em aberto (1 atrasada)". */
function courseSummary(e: StudentSummaryEnrollment): string | null {
  const c = e.course;
  if (!c) return null;
  return [
    `${formatCents(c.priceCents)}${c.installments > 1 ? ` em ${c.installments}x` : " à vista"}`,
    `${c.paid} de ${c.installments} ${c.installments === 1 ? "parcela paga" : "parcelas pagas"}`,
    c.openCents > 0
      ? `${formatCents(c.openCents)} em aberto${c.overdue > 0 ? ` (${plural(c.overdue, "atrasada", "atrasadas")})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function facts(e: StudentSummaryEnrollment): string {
  const rate = e.attendanceRate === null ? null : `frequência ${Math.round(e.attendanceRate * 100)}%`;
  return [
    e.modalityName,
    e.instructorName ? `com ${e.instructorName}` : null,
    `desde ${brDate(e.enrolledAt)}`,
    e.state === "canceled" && e.canceledAt ? `saiu em ${brDate(e.canceledAt)}` : null,
    e.billingMode === "course" && e.endDate && e.state !== "canceled" ? `termina ${brDate(e.endDate)}` : null,
    rate,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Aba "Turmas e cursos" da ficha: matriculas de todas as situacoes. */
export function StudentEnrollmentsTab({ enrollments }: { enrollments: StudentSummaryEnrollment[] }) {
  const router = useRouter();
  // Certificado de conclusao: Plano Pro; no gratis o item abre o aviso do plano (como na turma).
  const hasCertificates = useHasFeature()("certificates");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const query = normalizeText(search);
  const rows = enrollments.filter(
    (e) =>
      (state === "all" || e.state === state) &&
      (query === "" ||
        normalizeText(e.className).includes(query) ||
        normalizeText(e.modalityName ?? "").includes(query)),
  );
  const hasFilters = state !== "all";

  const actionsFor = (e: StudentSummaryEnrollment): ListItemAction[] => [
    {
      key: "open",
      label: "Abrir turma",
      icon: <ExternalLink className="size-4" />,
      onSelect: () => router.push(`/classes/${e.classGroupId}`),
    },
    ...(e.state === "completed"
      ? [
          {
            key: "certificate",
            label: hasCertificates ? "Certificado" : "Certificado (Plano Pro)",
            icon: hasCertificates ? <Award className="size-4" /> : <Lock className="size-4" />,
            onSelect: () => router.push(`/classes/${e.classGroupId}/certificate/${e.id}`),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar turma ou modalidade..."
          aria-label="Buscar turma"
        />
        <Select value={state} onValueChange={(v) => setState(v as StateFilter)}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por situação">
            <SelectValue>{STATE_FILTERS.find((f) => f.value === state)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ListSummaryBar
        count={rows.length}
        singularLabel="matrícula"
        pluralLabel="matrículas"
        hasFilters={hasFilters || query !== ""}
        onClearFilters={() => {
          setSearch("");
          setState("all");
        }}
      />

      <ListContainer
        emptyState={
          rows.length === 0 ? (
            <ListEmptyState
              hasSearch={query !== ""}
              hasFilters={hasFilters}
              onClearSearch={() => setSearch("")}
              onClearFilters={() => setState("all")}
              searchEmptyMessage="Nenhuma turma para esta busca."
              filtersEmptyMessage="Nenhuma matrícula nesta situação."
              emptyGuide={
                <ModuleEmptyGuide
                  icon={<GraduationCap className="size-8" />}
                  title="Sem turmas ainda."
                  description="Matricule o aluno pela tela da turma."
                />
              }
            />
          ) : undefined
        }
      >
        {rows.map((e) => {
          const actions = actionsFor(e);
          const course = courseSummary(e);
          const mode = e.billingMode === "membership" ? null : MODE_LABEL[e.billingMode];
          return (
            <ListItemContextMenu key={e.id} actions={actions}>
              <ListRow
                onClick={() => router.push(`/classes/${e.classGroupId}`)}
                aria-label={`Abrir turma ${e.className}`}
                actions={
                  <ListItemActionsMenu
                    actions={actions}
                    title="Ações da matrícula"
                    ariaLabel={`Ações da matrícula em ${e.className}`}
                    variant="ghost"
                  />
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/classes/${e.classGroupId}`}
                    onClick={(event) => event.stopPropagation()}
                    className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {e.className}
                  </Link>
                  <EnrollmentStateBadge state={e.state} />
                  {mode ? (
                    <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {mode}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{facts(e)}</p>
                {course ? <p className="mt-0.5 text-xs text-muted-foreground">{course}</p> : null}
              </ListRow>
            </ListItemContextMenu>
          );
        })}
      </ListContainer>
    </div>
  );
}
