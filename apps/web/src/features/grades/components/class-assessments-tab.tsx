"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardCheck, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { AssessmentView, ClassGroupView, ModalityProgressionTrack } from "@gestarahub/contracts";
import { formatAverage, scaleMax, usesPointsSum } from "@gestarahub/core/grades";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { normalizeText } from "@/lib/text";
import { useClassAssessments, useRemoveAssessment } from "../hooks/use-grades";
import { AssessmentFormDialog } from "./assessment-form-dialog";
import { GradeEntryDialog } from "./grade-entry-dialog";
import {
  AverageValue,
  SCALE_LABEL,
  attendanceRuleLabel,
  passingLabel,
  pointsLabel,
  resultWord,
  useCanManageGrades,
  weightLabel,
} from "./grade-ui";

/**
 * Aba "Avaliações" da turma (so quando a modalidade tem avaliacoes): lista com
 * data, peso, media e lancadas; "+ Nova avaliação" no topo da aba; lancar
 * notas, editar e excluir pelo menu da linha.
 */
export function ClassAssessmentsTab({
  turma,
  track,
}: {
  turma: ClassGroupView;
  /** Trilha da modalidade (etapa opcional e palavras). */
  track: ModalityProgressionTrack | null;
}) {
  const { data, isPending, isFetching } = useClassAssessments(turma.id);
  const removeMut = useRemoveAssessment();
  const canManage = useCanManageGrades(turma.instructorId);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentView | undefined>(undefined);
  const [entryId, setEntryId] = useState<string | null>(null);

  const settings = data?.settings;
  const all = useMemo(() => data?.assessments ?? [], [data]);
  const rows = useMemo(() => {
    const term = normalizeText(search);
    return term ? all.filter((a) => normalizeText(a.name).includes(term)) : all;
  }, [all, search]);

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const remove = async (a: AssessmentView) => {
    const recovery = all.find((r) => r.recoveryOf === a.id);
    const ok = await confirm({
      title: "Excluir avaliação?",
      description: recovery
        ? `${a.name}, a recuperação dela e as notas lançadas saem do boletim dos alunos.`
        : `${a.name} e as notas lançadas saem do boletim dos alunos.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    removeMut.mutate(a.id, {
      onSuccess: () => toast.success("Avaliação excluída."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível excluir a avaliação.")),
    });
  };

  return (
    <section role="tabpanel" className="space-y-3">
      {confirmDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder="Buscar avaliação..."
          aria-label="Buscar avaliação"
        />
        {canManage ? (
          <Button className="shrink-0" onClick={openNew}>
            <Plus className="size-4" />
            Nova avaliação
          </Button>
        ) : null}
      </div>

      {settings ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
          <ListSummaryBar
            isLoading={isPending}
            count={rows.length}
            singularLabel="avaliação"
            pluralLabel="avaliações"
            hasFilters={Boolean(search)}
            onClearFilters={() => setSearch("")}
            className="flex items-center gap-3"
          />
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {[SCALE_LABEL[settings.scale], passingLabel(settings), attendanceRuleLabel(settings)].filter(Boolean).join(" · ")} ·{" "}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {resultWord(settings)} da turma
              <AverageValue scale={settings.scale} average={data?.classAverage ?? null} />
            </span>
          </span>
        </div>
      ) : (
        <ListSummaryBar isLoading={isPending} count={rows.length} singularLabel="avaliação" pluralLabel="avaliações" />
      )}

      <ListContainer
        refreshing={isFetching && !isPending}
        emptyState={
          !isPending && rows.length === 0 ? (
            <ListEmptyState
              hasSearch={Boolean(search)}
              hasFilters={false}
              onClearSearch={() => setSearch("")}
              onClearFilters={() => setSearch("")}
              emptyGuide={
                <ModuleEmptyGuide
                  icon={<ClipboardList className="size-8" />}
                  title="Nenhuma avaliação ainda."
                  description="Crie provas e trabalhos para lançar as notas."
                  actionLabel={canManage ? "Nova avaliação" : undefined}
                  onAction={canManage ? openNew : undefined}
                />
              }
            />
          ) : null
        }
      >
        {isPending
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-md" />
              </div>
            ))
          : rows.map((a) => {
          const actions: ListItemAction[] = canManage
            ? [
                {
                  key: "grades",
                  label: "Lançar notas",
                  icon: <ClipboardCheck className="size-4" />,
                  onSelect: () => setEntryId(a.id),
                },
                {
                  key: "edit",
                  label: "Editar",
                  icon: <Pencil className="size-4" />,
                  onSelect: () => {
                    setEditing(a);
                    setFormOpen(true);
                  },
                },
                {
                  key: "delete",
                  label: "Excluir",
                  icon: <Trash2 className="size-4" />,
                  destructive: true,
                  disabled: removeMut.isPending,
                  onSelect: () => void remove(a),
                },
              ]
            : [];
          // Soma dos pontos ligada depois da avaliacao criada: sem pontos, ela vale o total
          // da escala sozinha. A linha avisa para editar e dizer quanto vale.
          const missingPoints = Boolean(settings && usesPointsSum(settings) && !a.recoveryOf && a.points === undefined);
          const amount = a.recoveryOf
            ? `Recuperação de ${a.recoveryOfName ?? "outra avaliação"}`
            : settings && usesPointsSum(settings)
              ? missingPoints
                ? null
                : pointsLabel(a.points ?? scaleMax(settings.scale) ?? 0)
              : weightLabel(a.weight);
          const meta = [format(parseISO(a.date), "dd/MM/yyyy"), amount, a.levelName].filter(Boolean).join(" · ");
          const row = (
            <ListRow
              key={a.id}
              onClick={canManage ? () => setEntryId(a.id) : undefined}
              canClick={canManage}
              actions={
                actions.length > 0 ? (
                  <ListItemActionsMenu actions={actions} title={`Ações de ${a.name}`} variant="ghost" />
                ) : null
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta}
                    {missingPoints ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400"> · Defina quanto vale</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {a.gradedCount} de {a.enrolledCount} lançadas
                  </span>
                  {settings ? (
                    <span title={a.average ? `Média ${formatAverage(settings.scale, a.average)}` : undefined}>
                      <AverageValue scale={settings.scale} average={a.average} />
                    </span>
                  ) : null}
                </div>
              </div>
            </ListRow>
          );
          if (actions.length === 0) return row;
          return (
            <ListItemContextMenu key={a.id} actions={actions}>
              {row}
            </ListItemContextMenu>
          );
        })}
      </ListContainer>

      <AssessmentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        classGroupId={turma.id}
        classGroupName={turma.name}
        assessment={editing}
        track={track}
        settings={settings}
        classAssessments={all}
      />
      <GradeEntryDialog
        assessmentId={entryId}
        onOpenChange={(open) => {
          if (!open) setEntryId(null);
        }}
      />
    </section>
  );
}
