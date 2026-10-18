"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowUpCircle,
  ArrowUpRight,
  Cake,
  ChevronDown,
  HeartHandshake,
  MessageCircle,
  Ticket,
} from "lucide-react";
import type { Client } from "@gestarahub/contracts";
import { relativeDateLabel } from "@gestarahub/core/date";
import { formatCents, plural } from "@gestarahub/core/format";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sharedVocabularyFor, vocabularyForTrack } from "@/lib/business-segment-presets";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { StudentGraduationDialog, useClients } from "@/features/clients";
import { packageRemainingText, useMessageLogs, useWhatsAppSend } from "@/features/communication";
import { useSegmentVocabulary } from "@/features/settings";
import { SellPackageDialog, useAbsenceStreaks, useCharges, useStudentPackages } from "@/features/turmas";
import { selectEndingPackages } from "../package-ending";
import { useMonthBirthdays } from "./birthdays-card";
import { useLevelChangePending } from "./use-level-change-pending";

/** Ate 3 nomes e "e mais N". */
function namesLine(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} e mais ${names.length - 3}` : shown;
}

/** Dia (local) em que cada aluno recebeu a ultima mensagem do tipo. */
function lastMessageDay(logs: { clientId?: string; sentAt: string }[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const log of logs) {
    if (!log.clientId) continue;
    const day = format(parseISO(log.sentAt), "yyyy-MM-dd");
    if ((last.get(log.clientId) ?? "") < day) last.set(log.clientId, day);
  }
  return last;
}

/** Linha de pendencia: quantidade, quem e a acao (link ou abrir a lista ali mesmo). */
function TodoRow({
  icon,
  tone,
  title,
  detail,
  action,
  href,
  children,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  detail: string;
  action: string;
  href?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        {href ? (
          <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-xs" asChild>
            <Link href={href}>
              {action}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {action}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </Button>
        )}
      </div>
      {children && open ? (
        <ul className="space-y-2.5 border-t border-border/60 bg-muted/20 px-4 py-3">{children}</ul>
      ) : null}
    </li>
  );
}

function StudentLine({
  name,
  detail,
  done,
  children,
}: {
  name: string;
  detail: string;
  /** Ja feito hoje (ex.: "Avisado hoje"). */
  done?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <InitialsAvatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {done ? <span className="shrink-0 text-[11px] text-emerald-700 dark:text-emerald-400">{done}</span> : null}
      {children}
    </li>
  );
}

function WhatsAppButton({
  label,
  done,
  disabled,
  onClick,
}: {
  label: string;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(done && "text-emerald-600 dark:text-emerald-400")}
      onClick={onClick}
    >
      <MessageCircle className="size-4" />
    </Button>
  );
}

/**
 * "Para fazer hoje": as pendencias do Dashboard num bloco so, no topo (sem
 * precisar rolar). Uma linha por pendencia, so as que tem algo: cobrancas em
 * atraso (de todos os meses e tipos: a divida nao some na virada do mes), pacotes acabando, alunos com 3 faltas seguidas, aniversariantes
 * do dia e troca de faixa pela idade. As listas abrem na propria linha, com a acao.
 */
export function DashboardTodo({ today }: { today: string }) {
  const areaVocabulary = useSegmentVocabulary();
  const whatsapp = useWhatsAppSend();
  const { data: streaks = [] } = useAbsenceStreaks();
  const { data: absenceLogs = [] } = useMessageLogs({ trigger: "absence_alert" });
  const { data: greetingLogs = [] } = useMessageLogs({ trigger: "birthday_greeting" });
  const { birthdays } = useMonthBirthdays(today);
  const levelPending = useLevelChangePending(today);
  const [graduating, setGraduating] = useState<{ client: Client; modalityId: string } | null>(null);
  const can = useCan();
  const canSellPackage = can("billing:manage");
  const { data: studentPackages = [] } = useStudentPackages();
  const { data: activeClients = [] } = useClients({ status: "active" });
  const { data: packageLogs = [] } = useMessageLogs({ trigger: "package_ending" });
  const [selling, setSelling] = useState<{ id: string; name: string } | null>(null);
  const { data: overdueCharges = [] } = useCharges({ status: "overdue" });
  const overdueCount = overdueCharges.length;
  const overdueCents = overdueCharges.reduce((sum, c) => sum + c.amountCents, 0);
  const overdueMonths = new Set(overdueCharges.map((c) => c.competence ?? c.dueDate.slice(0, 7))).size;

  const birthdaysToday = birthdays.filter((b) => b.isToday);
  const lastAbsenceMessage = lastMessageDay(absenceLogs);
  const lastGreeting = lastMessageDay(greetingLogs);
  const lastPackageMessage = lastMessageDay(packageLogs);
  // So aluno ativo (o telefone vem do cadastro).
  const clientById = new Map(activeClients.map((c) => [c.id, c]));
  const packagesEnding = selectEndingPackages(studentPackages, today).filter((p) => clientById.has(p.pkg.studentId));
  // Titulo do bloco: a palavra das modalidades listadas quando todas falam
  // igual, senao a da area. O botao de cada aluno segue a modalidade dele.
  const levelWord = sharedVocabularyFor(
    levelPending.map((p) => p.track),
    areaVocabulary,
  ).level.toLowerCase();
  const count =
    (overdueCount > 0 ? 1 : 0) +
    (packagesEnding.length > 0 ? 1 : 0) +
    (streaks.length > 0 ? 1 : 0) +
    (birthdaysToday.length > 0 ? 1 : 0) +
    (levelPending.length > 0 ? 1 : 0);

  return (
    <>
      {count > 0 ? (
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <p className="text-sm font-semibold text-foreground">Para fazer hoje</p>
            <span className="text-xs text-muted-foreground">{plural(count, "pendência", "pendências")}</span>
          </div>
          <ul className="divide-y divide-border/60">
            {overdueCount > 0 ? (
              <TodoRow
                icon={<AlertCircle className="size-4" />}
                tone="bg-destructive/15 text-destructive"
                title={plural(overdueCount, "cobrança em atraso", "cobranças em atraso")}
                detail={
                  overdueMonths > 1
                    ? `${formatCents(overdueCents)} até hoje, de ${overdueMonths} meses`
                    : `${formatCents(overdueCents)} até hoje`
                }
                action="Cobrar"
                href="/classes/billing?overdue=all"
              />
            ) : null}

            {packagesEnding.length > 0 ? (
              <TodoRow
                icon={<Ticket className="size-4" />}
                tone="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                title={plural(packagesEnding.length, "pacote acabando", "pacotes acabando")}
                detail={namesLine(packagesEnding.map((p) => p.pkg.studentName))}
                action="Ver"
              >
                {packagesEnding.map(({ pkg }) => {
                  const client = clientById.get(pkg.studentId);
                  const messagedOn = lastPackageMessage.get(pkg.studentId);
                  const messaged = Boolean(messagedOn && messagedOn >= pkg.purchasedAt);
                  const remaining = packageRemainingText(pkg, today);
                  return (
                    <StudentLine
                      key={pkg.id}
                      name={pkg.studentName}
                      detail={`${pkg.name} · ${remaining}`}
                      done={messaged && messagedOn ? `Avisado ${relativeDateLabel(messagedOn)}` : undefined}
                    >
                      <WhatsAppButton
                        label={`Avisar ${pkg.studentName} no WhatsApp`}
                        done={messaged}
                        disabled={!whatsapp.ready}
                        onClick={() =>
                          whatsapp.send({
                            trigger: "package_ending",
                            recipient: { name: pkg.studentName, phone: client?.phone, clientId: pkg.studentId },
                            values: { pacote: pkg.name, restante: remaining },
                          })
                        }
                      />
                      {canSellPackage ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 text-xs"
                          onClick={() => setSelling({ id: pkg.studentId, name: pkg.studentName })}
                        >
                          Vender pacote
                        </Button>
                      ) : null}
                    </StudentLine>
                  );
                })}
              </TodoRow>
            ) : null}

            {streaks.length > 0 ? (
              <TodoRow
                icon={<HeartHandshake className="size-4" />}
                tone="bg-violet-500/15 text-violet-700 dark:text-violet-300"
                title={plural(streaks.length, "aluno com 3 faltas seguidas", "alunos com 3 faltas seguidas")}
                detail={namesLine(streaks.map((s) => s.studentName))}
                action="Ver"
              >
                {streaks.map((s) => {
                  const messagedOn = lastAbsenceMessage.get(s.studentId);
                  const messaged = Boolean(messagedOn && messagedOn >= s.since);
                  return (
                    <StudentLine
                      key={s.studentId}
                      name={s.studentName}
                      detail={`${s.streak} faltas seguidas · desde ${relativeDateLabel(s.since)}${s.classGroupNames.length ? ` · ${s.classGroupNames.join(", ")}` : ""}`}
                      done={messaged && messagedOn ? `Avisado ${relativeDateLabel(messagedOn)}` : undefined}
                    >
                      <WhatsAppButton
                        label={`Mandar mensagem para ${s.studentName} no WhatsApp`}
                        done={messaged}
                        disabled={!whatsapp.ready}
                        onClick={() =>
                          whatsapp.send({
                            trigger: "absence_alert",
                            recipient: { name: s.studentName, phone: s.phone, clientId: s.studentId },
                          })
                        }
                      />
                    </StudentLine>
                  );
                })}
              </TodoRow>
            ) : null}

            {birthdaysToday.length > 0 ? (
              <TodoRow
                icon={<Cake className="size-4" />}
                tone="bg-pink-500/15 text-pink-700 dark:text-pink-300"
                title={plural(birthdaysToday.length, "aniversariante hoje", "aniversariantes hoje")}
                detail={namesLine(birthdaysToday.map((b) => b.item.name))}
                action="Ver"
              >
                {birthdaysToday.map(({ item, ageTurning }) => {
                  const greeted = lastGreeting.get(item.id) === today;
                  return (
                    <StudentLine
                      key={item.id}
                      name={item.name}
                      detail={ageTurning > 0 ? `Faz ${ageTurning} anos` : "Aniversário"}
                      done={greeted ? "Parabéns enviado" : undefined}
                    >
                      <WhatsAppButton
                        label={`Mandar parabéns para ${item.name} no WhatsApp`}
                        done={greeted}
                        disabled={!whatsapp.ready}
                        onClick={() =>
                          whatsapp.send({
                            trigger: "birthday_greeting",
                            recipient: { name: item.name, phone: item.phone, clientId: item.id },
                          })
                        }
                      />
                    </StudentLine>
                  );
                })}
              </TodoRow>
            ) : null}

            {levelPending.length > 0 ? (
              <TodoRow
                icon={<ArrowUpCircle className="size-4" />}
                tone="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                title={`${plural(levelPending.length, "aluno precisa", "alunos precisam")} trocar de ${levelWord} pela idade`}
                detail={namesLine(levelPending.map((p) => p.client.name))}
                action="Ver"
              >
                {levelPending.map((p) => (
                  <StudentLine
                    key={p.key}
                    name={p.client.name}
                    detail={`${p.levelName} · ${p.modalityName} · passou da idade`}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => setGraduating({ client: p.client, modalityId: p.modalityId })}
                    >
                      {vocabularyForTrack(p.track, areaVocabulary).promoteVerb}
                    </Button>
                  </StudentLine>
                ))}
              </TodoRow>
            ) : null}
          </ul>
        </Card>
      ) : null}

      <StudentGraduationDialog
        client={graduating?.client ?? null}
        open={graduating !== null}
        onOpenChange={(open) => {
          if (!open) setGraduating(null);
        }}
        initialModalityId={graduating?.modalityId}
      />
      <SellPackageDialog
        open={selling !== null}
        onOpenChange={(open) => {
          if (!open) setSelling(null);
        }}
        student={selling}
      />
    </>
  );
}
