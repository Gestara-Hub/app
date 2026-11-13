"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, FileText, GraduationCap } from "lucide-react";
import type { EventRegistrationView, EventView } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { plural } from "@gestarahub/core/format";
import { BeltBadge } from "@/components/shared/belt-badge";
import { ListContainer, ListRow } from "@/components/shared/list";
import { ModuleEmptyGuide } from "@/components/shared/module-empty-guide";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useHasFeature } from "@/features/auth";
import { GraduateManyDrawer, candidateStep, type GraduateManyStudent } from "@/features/clients";
import { useModalityVocabulary } from "@/features/settings";
import { resolveTrackStyle } from "@/lib/progression-tracks";
import { isSupabaseOrganization } from "@/lib/session";
import { cn } from "@/lib/utils";
import { instructorNamesLabel, lastHeldDay, registrationPaymentLabel } from "../event-copy";
import { useEventGraduation } from "../hooks/use-event-graduation";

/**
 * Aba Graduação do evento de graduacao (doc product/30 §4): os inscritos com
 * a faixa ou nivel de hoje, o "Apto" ou o que falta, a presenca e o
 * pagamento; quem ja graduou aqui aparece com o novo nivel. "Graduar" abre o
 * "Graduar vários" com os presentes que faltam, a data do evento e quem
 * conduz como examinador. Quem ainda deve entra, com aviso na confirmacao.
 */
export function EventGraduationTab({ event, registrations }: { event: EventView; registrations: EventRegistrationView[] }) {
  const router = useRouter();
  const hasCertificates = useHasFeature()("certificates");
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const { data, isPending, confirmed, candidates, graduatedHere, graduatedCount } = useEventGraduation(event, registrations);
  const track = data?.modality.progressionTrack;
  const style = resolveTrackStyle(track);
  const vocabulary = useModalityVocabulary(track);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<GraduateManyStudent[]>([]);
  const today = todayISO();

  const byStudent = new Map(candidates.map((c) => [c.studentId, c]));
  const rows = confirmed
    .map((r) => {
      const candidate = byStudent.get(r.studentId);
      const step = candidate && track?.enabled ? candidateStep(track, candidate, today, vocabulary.inLevel) : undefined;
      return { r, candidate, step, graduated: graduatedHere(candidate), present: r.presentCount > 0, pay: registrationPaymentLabel(r) };
    })
    .sort((a, b) => a.r.studentName.localeCompare(b.r.studentName, "pt-BR"));
  const presentCount = rows.filter((row) => row.present).length;
  const toGraduate = rows.filter((row) => row.present && !row.graduated && (row.step?.options.length ?? 0) > 0);
  const payOf = new Map(rows.map((row) => [row.r.studentId, row.pay]));

  if (confirmed.length === 0) {
    return (
      <ModuleEmptyGuide
        icon={<GraduationCap className="size-7" />}
        title="Ninguém inscrito ainda"
        description="Inscreva os alunos aptos e faça a chamada no dia. Depois, a graduação sai daqui."
      />
    );
  }

  return (
    <section className="space-y-3">
      <GraduateManyDrawer
        open={open}
        onOpenChange={setOpen}
        modalityId={event.modalityId ?? ""}
        students={students}
        contextLabel={event.name}
        eventId={event.id}
        defaultDate={lastHeldDay(event, today)}
        defaultExaminer={instructorNamesLabel(event.instructors)}
        extraOf={(studentId) => payOf.get(studentId)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {[
            plural(confirmed.length, "inscrito", "inscritos"),
            plural(presentCount, "presente", "presentes"),
            plural(graduatedCount, "graduado", "graduados"),
          ].join(" · ")}
        </p>
        <div className="flex flex-wrap gap-2">
          {graduatedCount > 0 && hasCertificates && serverDocuments ? (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/documents/certificates/event/${event.id}/graduation`, "_blank", "noopener")}
            >
              <FileText className="size-4" />
              Certificados
            </Button>
          ) : null}
          <Button
            disabled={toGraduate.length === 0}
            onClick={() => {
              setStudents(toGraduate.map((row) => ({ id: row.r.studentId, name: row.r.studentName })));
              setOpen(true);
            }}
          >
            <Award className="size-4" />
            {vocabulary.promoteVerb}
          </Button>
        </div>
      </div>
      {presentCount === 0 ? (
        <p className="text-xs text-muted-foreground">A graduação abre para quem tem presença: faça a chamada do dia.</p>
      ) : null}

      <ListContainer>
        {isPending
          ? confirmed.map((r) => <Skeleton key={r.id} className="h-16 w-full" />)
          : rows.map(({ r, step, graduated, present, pay }) => (
              <ListRow key={r.id} canClick onClick={() => router.push(`/clients/${r.studentId}`)}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">{r.studentName}</p>
                  {graduated ? (
                    <BeltBadge
                      name={graduated.toLevelName}
                      color={graduated.toLevelColor}
                      variant={style}
                      subLevel={graduated.toSubLevel}
                      size="xs"
                    />
                  ) : step?.current ? (
                    <BeltBadge
                      name={step.current.name}
                      color={step.current.color}
                      variant={style}
                      subLevel={step.sub}
                      maxSubLevels={step.current.maxSubLevels}
                      size="xs"
                    />
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                  {graduated ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Graduado neste evento</span>
                  ) : step ? (
                    <span
                      className={cn(
                        "min-w-0 break-words",
                        step.options.length === 0
                          ? ""
                          : step.readiness.ready
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {step.options.length === 0
                        ? "Último nível da trilha"
                        : step.readiness.ready
                          ? vocabulary.readyBadge
                          : step.readiness.gaps.join(" · ") || "Por avaliação do professor"}
                    </span>
                  ) : null}
                  <span>{present ? "Presente" : event.stage === "upcoming" ? "Ainda não começou" : "Sem presença"}</span>
                  <span className={cn("font-medium", pay.tone)}>{pay.text}</span>
                </div>
              </ListRow>
            ))}
      </ListContainer>
    </section>
  );
}
