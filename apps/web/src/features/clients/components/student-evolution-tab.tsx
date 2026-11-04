"use client";

import { ArrowUpCircle, ClipboardCheck, GraduationCap, MessageSquarePlus, Ruler, TrendingUp } from "lucide-react";
import { BeltBadge } from "@/components/shared/belt-badge";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { plural } from "@gestarahub/core/format";
import type { Id, StudentSummaryLevel } from "@gestarahub/contracts";
import { RecordItem } from "./student-records-dialog";
import { brDate } from "./student-profile-parts";

/**
 * Aba "Evolução" da ficha: por modalidade, o nivel atual (palavras da trilha
 * dela), os ultimos registros de aula e os atalhos para os dialogos de
 * registros e de graduacao/niveis.
 */
export function StudentEvolutionTab({
  levels,
  canManage,
  onOpenRecords,
  onOpenLevels,
  gradedModalityIds,
  onOpenGrades,
  onOpenMeasurements,
  inAnyClass = false,
}: {
  levels: StudentSummaryLevel[];
  canManage: boolean;
  onOpenRecords: (modalityId: Id) => void;
  onOpenLevels: (modalityId: Id) => void;
  /** Modalidades com avaliacoes ligadas: mostram o atalho "Notas". */
  gradedModalityIds?: ReadonlySet<Id>;
  onOpenGrades?: (modalityId: Id) => void;
  /** Aluno em modalidade com testes e medidas (doc 21 §2.4): o atalho vale mesmo sem trilha. */
  onOpenMeasurements?: () => void;
  /** Esta em alguma turma: entao as modalidades dela nao tem trilha (ALU-27). */
  inAnyClass?: boolean;
}) {
  const measurementsBar = onOpenMeasurements ? (
    <div className="flex justify-end">
      <Button variant="outline" onClick={onOpenMeasurements}>
        <Ruler className="size-4" />
        Testes e medidas
      </Button>
    </div>
  ) : null;

  if (levels.length === 0) {
    return (
      <div className="space-y-3">
        {measurementsBar}
        <div className="rounded-xl border border-border/60 bg-card/40">
          <ModuleEmptyGuide
            icon={<TrendingUp className="size-8" />}
            title="Sem trilha de evolução ainda."
            description={
              inAnyClass
                ? "As turmas deste aluno são de modalidades sem trilha de níveis."
                : "Aparece quando o aluno entra numa turma de modalidade com trilha."
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {measurementsBar}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {levels.map((level) => (
        <section key={level.modalityId} className="flex flex-col rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">{level.modalityName}</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <BeltBadge
                  name={level.levelName}
                  color={level.levelColor}
                  variant={level.trackStyle}
                  subLevel={level.subLevel}
                  maxSubLevels={level.maxSubLevels}
                  size="sm"
                />
                {level.agedOut ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <ArrowUpCircle className="size-3" aria-hidden />
                    Trocar {level.words.level.toLowerCase()}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {[
                  level.promotedAt ? `${level.words.promotion} em ${brDate(level.promotedAt)}` : null,
                  level.openGoals > 0 ? plural(level.openGoals, "meta em aberto", "metas em aberto") : null,
                  level.isEnrolled ? null : "sem turma ativa",
                ]
                  .filter(Boolean)
                  .join(" · ") || `${level.words.level} inicial`}
              </p>
            </div>
            {canManage || (onOpenGrades && gradedModalityIds?.has(level.modalityId)) ? (
              <div className="flex flex-wrap gap-2">
                {onOpenGrades && gradedModalityIds?.has(level.modalityId) ? (
                  <Button variant="outline" onClick={() => onOpenGrades(level.modalityId)}>
                    <ClipboardCheck className="size-4" />
                    Notas
                  </Button>
                ) : null}
                {canManage ? (
                  <>
                    <Button variant="outline" onClick={() => onOpenRecords(level.modalityId)}>
                      <MessageSquarePlus className="size-4" />
                      Registros de aula
                    </Button>
                    <Button variant="outline" onClick={() => onOpenLevels(level.modalityId)}>
                      <GraduationCap className="size-4" />
                      {level.words.levelsTitle}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-border/50 pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {level.recordsCount === 0
                ? "Nenhum registro de aula ainda."
                : level.recordsCount > level.lastRecords.length
                  ? `Últimos registros (${level.lastRecords.length} de ${level.recordsCount})`
                  : "Registros de aula"}
            </p>
            {level.lastRecords.length > 0 ? (
              <ul className="space-y-3">
                {level.lastRecords.map((record) => (
                  <RecordItem key={record.id} record={record} />
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
