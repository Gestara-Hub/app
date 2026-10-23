"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, ExternalLink, GraduationCap, Lock } from "lucide-react";
import { ListContainer, ListRow } from "@/components/shared/list";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { StudentSummaryEnrollment } from "@gestarahub/contracts";
import { useHasFeature } from "@/features/auth";
import { brDate } from "./student-profile-parts";

/** Abaixo de 75% de presenca a linha avisa "Presença baixa" (como na turma). */
const LOW_ATTENDANCE = 0.75;

/**
 * Uma linha curta: modalidade (quando o nome da turma nao diz), professor e a
 * cobranca so quando nao e mensalidade ("Curso até 18/12"). Valores e parcelas
 * ficam em Cobrancas.
 */
function detailOf(e: StudentSummaryEnrollment): string {
  const modalityInName = normalizeText(e.className).includes(normalizeText(e.modalityName ?? ""));
  const billing =
    e.billingMode === "course"
      ? e.endDate
        ? `Curso até ${brDate(e.endDate).slice(0, 5)}`
        : "Curso"
      : e.billingMode === "package"
        ? "Pacote de aulas"
        : e.billingMode === "free"
          ? "Sem cobrança"
          : null;
  return [modalityInName ? null : e.modalityName, e.instructorName, billing].filter(Boolean).join(" · ");
}

/** A direita: a situacao quando nao e ativa; ativa mostra a presenca. */
function StatusText({ e }: { e: StudentSummaryEnrollment }) {
  if (e.state === "paused") return <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Trancada</span>;
  if (e.state === "completed") return <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Concluído</span>;
  if (e.state === "canceled") {
    return (
      <span className="text-xs text-muted-foreground">
        {e.canceledAt ? `Saiu em ${brDate(e.canceledAt).slice(0, 5)}` : "Cancelada"}
      </span>
    );
  }
  if (e.attendanceRate === null) return null;
  const low = e.attendanceRate < LOW_ATTENDANCE;
  return (
    <span
      title="Presença na turma"
      className={cn("text-xs tabular-nums", low ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}
    >
      {low ? "Presença baixa" : `${Math.round(e.attendanceRate * 100)}%`}
    </span>
  );
}

/**
 * Turmas da ficha: as matriculas em andamento (ativas e trancadas); as
 * encerradas (concluidas e canceladas) ficam atras de "Mostrar encerradas".
 */
export function StudentEnrollmentsTab({ enrollments }: { enrollments: StudentSummaryEnrollment[] }) {
  const router = useRouter();
  // Certificado de conclusao: Plano Profissional; no gratis o item abre o aviso do plano (como na turma).
  const hasCertificates = useHasFeature()("certificates");
  const [showEnded, setShowEnded] = useState(false);
  const current = enrollments.filter((e) => e.state === "active" || e.state === "paused");
  const ended = enrollments.filter((e) => e.state === "completed" || e.state === "canceled");
  const rows = showEnded ? [...current, ...ended] : current;

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
            label: hasCertificates ? "Certificado" : "Certificado (Plano Profissional)",
            icon: hasCertificates ? <Award className="size-4" /> : <Lock className="size-4" />,
            onSelect: () => router.push(`/classes/${e.classGroupId}/certificate/${e.id}`),
          },
        ]
      : []),
  ];

  if (enrollments.length === 0) {
    return (
      <div className="rounded-lg border">
        <ModuleEmptyGuide
          icon={<GraduationCap className="size-8" />}
          title="Sem turmas ainda."
          description="Matricule o aluno pela tela da turma."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <ListContainer>
          {rows.map((e) => {
            const actions = actionsFor(e);
            const detail = detailOf(e);
            return (
              <ListItemContextMenu key={e.id} actions={actions}>
                <ListRow
                  onClick={() => router.push(`/classes/${e.classGroupId}`)}
                  aria-label={`Abrir turma ${e.className}`}
                  actions={
                    <>
                      <StatusText e={e} />
                      <ListItemActionsMenu
                        actions={actions}
                        title="Ações da matrícula"
                        ariaLabel={`Ações da matrícula em ${e.className}`}
                        variant="ghost"
                      />
                    </>
                  }
                >
                  <p className="text-sm font-medium text-foreground">{e.className}</p>
                  {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
                </ListRow>
              </ListItemContextMenu>
            );
          })}
        </ListContainer>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma turma em andamento.
        </p>
      )}
      {ended.length > 0 ? (
        <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => setShowEnded((v) => !v)}>
          {showEnded ? "Ocultar encerradas" : `Mostrar encerradas (${ended.length})`}
        </Button>
      ) : null}
    </div>
  );
}
