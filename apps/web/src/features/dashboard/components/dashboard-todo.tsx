"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpCircle,
  ClipboardList,
  ArrowUpRight,
  Award,
  BellOff,
  Cake,
  CalendarClock,
  ChevronDown,
  Clock,
  HandCoins,
  HeartHandshake,
  FileText,
  MessageCircle,
  Receipt,
  Ticket,
  TicketPlus,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import type { Client } from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { InitialsAvatar } from "@/components/shared/list";
import { ListItemActionsMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SectionBar } from "@/components/form";
import { sharedVocabularyFor, vocabularyForTrack } from "@/lib/business-segment-presets";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { StudentGraduationDialog } from "@/features/clients";
import { ReminderSequenceDialog, useReminders, useWhatsAppSend, type ReminderGroup, type ReminderItem } from "@/features/communication";
import { useSegmentVocabulary } from "@/features/settings";
import { SellPackageDialog } from "@/features/turmas";
import type { BellAlert } from "../bell-alerts";
import { useLevelChangePending } from "./use-level-change-pending";

/** Ate 3 nomes e "e mais N". */
function namesLine(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} e mais ${names.length - 3}` : shown;
}

/** Linha de pendencia: quantidade, quem e a acao (link ou abrir a lista ali mesmo). */
function TodoRow({
  icon,
  tone,
  title,
  detail,
  action,
  href,
  toolbar,
  footer,
  defaultOpen = false,
  hideDetailWhenOpen = false,
  children,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  detail: string;
  action: string;
  href?: string;
  /** Acima da lista aberta (ex.: "Enviar em sequência"). */
  toolbar?: ReactNode;
  /** Abaixo da lista aberta (ex.: "e mais N", link da tela completa). */
  footer?: ReactNode;
  /** Comeca aberto (o primeiro grupo da gaveta do sino). */
  defaultOpen?: boolean;
  /** O `detail` repete a lista (nomes): aparece so com o grupo fechado. */
  hideDetailWhenOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showDetail = Boolean(detail) && !(open && hideDetailWhenOpen && children);
  const lead = (
    <>
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {showDetail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </>
  );
  if (href) {
    return (
      <li>
        <div className="flex items-center gap-3 px-4 py-2.5">
          {lead}
          <Button variant="outline" className="shrink-0 gap-1 text-xs" asChild>
            <Link href={href}>
              {action}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </li>
    );
  }
  // Abre e fecha como as secoes da ficha do aluno (doc 07 §1.8, 10/11/2026): a
  // linha inteira e o botao, so a seta a direita; aberta, ganha fundo e a barra
  // fina a esquerda, e a lista desliza.
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <li
        className={cn(
          "relative transition-colors duration-300",
          open && "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] dark:bg-[color-mix(in_oklab,var(--muted)_25%,var(--card))]",
        )}
      >
        <SectionBar visible={open} />
        <button
          type="button"
          className={cn(
            // Foco so com fundo (10/11/2026): o anel desenhava uma caixa em volta do
            // cabecalho quando o foco voltava de um dialogo, mesmo apos clique.
            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:bg-muted/60 focus-visible:outline-none",
            open ? "hover:bg-muted/60" : "hover:bg-muted/40",
          )}
          aria-expanded={open}
          aria-label={`${open ? "Fechar" : action} ${title}`}
          onClick={() => setOpen((v) => !v)}
        >
          {lead}
          <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden>
            <ChevronDown
              className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180 text-foreground")}
            />
          </span>
        </button>
        {children ? (
          <CollapsibleContent>
            <div className="space-y-2.5 px-4 pt-1 pb-3">
              {toolbar}
              <ul className="space-y-2.5">{children}</ul>
              {footer}
            </div>
          </CollapsibleContent>
        ) : null}
      </li>
    </Collapsible>
  );
}

function StudentLine({
  name,
  detail,
  done,
  doneToday = false,
  children,
}: {
  name: string;
  detail: string;
  /** Ja feito (ex.: "Avisado hoje", "Boas-vindas enviadas em 07/11"). */
  done?: string;
  /** Feito hoje: confirmacao em verde. Feito antes: a linha fica apagada, no fim do grupo. */
  doneToday?: boolean;
  children: ReactNode;
}) {
  const faded = Boolean(done) && !doneToday;
  return (
    <li className={cn("flex items-center gap-3", faded && "opacity-60 transition-opacity hover:opacity-100")}>
      <InitialsAvatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        {/* Feito antes: o aviso vai embaixo do nome, discreto. */}
        {faded ? <p className="text-xs text-muted-foreground">{done}</p> : null}
      </div>
      {done && doneToday ? <span className="shrink-0 text-[11px] text-emerald-700 dark:text-emerald-400">{done}</span> : null}
      {children}
    </li>
  );
}

/** Itens abertos por grupo antes do "Ver mais". */
const ITEMS_PREVIEW = 5;

/** Grupos cujo resumo e uma lista de nomes (some com o grupo aberto); cobrancas mostram valor. */
function detailRepeatsList(group: ReminderGroup): boolean {
  return group.category !== "billing" && group.key !== "payment_received";
}

/** Subtitulo do item na lista: o feito antes fica sob "Já feitos". */
function sectionOf(item: ReminderItem): string | undefined {
  if (item.done && !item.doneToday) return "Já feitos";
  return item.section;
}

function WhatsAppButton({ label, done, disabled, onClick }: { label: string; done: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(done && "text-emerald-700 dark:text-emerald-400")}
      onClick={onClick}
    >
      <MessageCircle className="size-4" />
    </Button>
  );
}

const GROUP_LOOK: Record<ReminderGroup["key"], { icon: ReactNode; tone: string }> = {
  overdue: { icon: <AlertCircle className="size-4" />, tone: "bg-destructive/15 text-destructive" },
  due_today: { icon: <CalendarClock className="size-4" />, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  due_soon: { icon: <CalendarClock className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  packages: { icon: <Ticket className="size-4" />, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  absence: { icon: <HeartHandshake className="size-4" />, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  birthday: { icon: <Cake className="size-4" />, tone: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  level_up: { icon: <Award className="size-4" />, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  welcome: { icon: <UserPlus className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  trial_follow_up: { icon: <UserRoundSearch className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  payment_received: { icon: <HandCoins className="size-4" />, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  schedule_change: { icon: <CalendarClock className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  broadcast: { icon: <MessageCircle className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  // Resolver no sistema (doc product/25): tarefas internas, abrem uma tela.
  event_tomorrow: { icon: <Ticket className="size-4" />, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  visitor_follow_up: { icon: <UserRoundSearch className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  course_ending: { icon: <CalendarClock className="size-4" />, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  roll_call: { icon: <ClipboardList className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  documents: { icon: <FileText className="size-4" />, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  event_certificates: { icon: <Award className="size-4" />, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

const ALERT_TONE: Record<BellAlert["tone"], string> = {
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/15 text-destructive",
};

/** Rotulo do botao do WhatsApp pelo tipo de lembrete. */
function whatsAppLabel(item: ReminderItem): string {
  if (item.trigger === "birthday_greeting") return `Mandar parabéns para ${item.studentName} no WhatsApp`;
  if (item.trigger === "package_ending") return `Avisar ${item.studentName} no WhatsApp`;
  if (item.trigger === "payment_received") return `Agradecer ${item.studentName} no WhatsApp`;
  if (item.trigger === "level_up") return `Parabenizar ${item.studentName} pelo avanço no WhatsApp`;
  if (item.trigger === "welcome_student") return `Dar boas-vindas a ${item.studentName} no WhatsApp`;
  if (item.trigger === "trial_follow_up") return `Chamar ${item.studentName} de volta no WhatsApp`;
  if (item.trigger === "event_reminder") return `Avisar ${item.studentName} do evento de amanhã no WhatsApp`;
  if (item.chargeId) return `Cobrar ${item.studentName} no WhatsApp`;
  return `Mandar mensagem para ${item.studentName} no WhatsApp`;
}

/**
 * "Lembretes" (doc product/25): o que lembrar hoje, do motor de lembretes, do
 * mais importante para o menos (atraso, vence hoje, vence logo, pacote
 * acabando, faltas seguidas, aniversario), mais a troca de nivel pela idade.
 * Cada aluno: WhatsApp com o modelo pronto e, no menu, adiar ou nao lembrar.
 * O ja avisado aparece marcado e nao conta como pendencia.
 */
export function DashboardTodo({
  today,
  bare = false,
  alerts = [],
}: {
  today: string;
  /** Sem o cartao (no painel do sino). */
  bare?: boolean;
  /** Avisos do espaco (plano, franquia), so no sino, antes dos lembretes. */
  alerts?: BellAlert[];
}) {
  const areaVocabulary = useSegmentVocabulary();
  const whatsapp = useWhatsAppSend();
  const can = useCan();
  const reminders = useReminders(today);
  const levelPending = useLevelChangePending(today, can("clients:view"));
  const [graduating, setGraduating] = useState<{ client: Client; modalityId: string } | null>(null);
  const canSellPackage = can("billing:manage");
  // O professor ve os lembretes dos alunos dele, mas nao manda mensagem: abre a ficha.
  const canMessage = can("communication:view");
  const [selling, setSelling] = useState<{ id: string; name: string } | null>(null);
  const [sequence, setSequence] = useState<ReminderGroup | null>(null);
  // Grupos com a lista inteira aberta ("Ver mais").
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const expand = (key: string) => setExpanded((prev) => new Set(prev).add(key));

  // Titulo do bloco: a palavra das modalidades listadas quando todas falam
  // igual, senao a da area. O botao de cada aluno segue a modalidade dele.
  const levelWord = sharedVocabularyFor(
    levelPending.map((p) => p.track),
    areaVocabulary,
  ).level.toLowerCase();
  const count = alerts.length + reminders.pending + levelPending.length;

  function itemActions(item: ReminderItem): ListItemAction[] {
    return [
      { key: "snooze", label: "Lembrar amanhã", icon: <Clock className="size-4" />, onSelect: () => reminders.snooze(item.key) },
      { key: "ignore", label: "Não lembrar deste", icon: <BellOff className="size-4" />, onSelect: () => reminders.ignore(item.key) },
    ];
  }

  const list = (
    <ul className="divide-y divide-border/60">
      {alerts.map((alert) => (
        <TodoRow
          key={alert.key}
          icon={
            alert.kind === "plan" ? (
              <Receipt className="size-4" />
            ) : alert.kind === "documents" ? (
              <FileText className="size-4" />
            ) : (
              <MessageCircle className="size-4" />
            )
          }
          tone={ALERT_TONE[alert.tone]}
          title={alert.title}
          detail={alert.text}
          action={alert.action}
          href={alert.href}
        />
      ))}

      {reminders.groups.map((group, index) => {
        const showAll = expanded.has(group.key);
        const visible = showAll ? group.items : group.items.slice(0, ITEMS_PREVIEW);
        const more = group.items.length - visible.length;
        return (
          <TodoRow
            key={group.key}
            icon={GROUP_LOOK[group.key].icon}
            tone={GROUP_LOOK[group.key].tone}
            title={group.title}
            detail={group.detail}
            action="Ver"
            // Na gaveta do sino, o grupo mais importante ja abre (10/11/2026).
            defaultOpen={bare && index === 0 && alerts.length === 0}
            hideDetailWhenOpen={detailRepeatsList(group)}
            toolbar={
              group.category !== "task" && group.pending >= 2 && canMessage ? (
                <Button type="button" variant="outline" className="text-xs" disabled={!whatsapp.ready} onClick={() => setSequence(group)}>
                  <MessageCircle className="size-3.5" />
                  Enviar em sequência ({group.pending})
                </Button>
              ) : undefined
            }
            footer={
              more > 0 || group.hidden > 0 || group.href ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {more > 0 ? (
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => expand(group.key)}>
                      Ver mais {more}
                    </button>
                  ) : group.hidden > 0 ? (
                    <span>e mais {group.hidden}</span>
                  ) : null}
                  {group.href ? (
                    <Link href={group.href} className="inline-flex items-center gap-1 font-medium text-primary">
                      Abrir em Cobranças
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {visible.map((item, i) => {
              const section = sectionOf(item);
              const showSection = Boolean(section) && section !== (i > 0 ? sectionOf(visible[i - 1]) : undefined);
              return (
                <Fragment key={item.key}>
                  {showSection ? (
                    <li className="pt-1 text-[11px] font-medium text-muted-foreground" aria-hidden>
                      {section}
                    </li>
                  ) : null}
                  <StudentLine name={item.studentName} detail={item.detail} done={item.done} doneToday={item.doneToday}>
                    {item.href ? (
                      <Button asChild variant="outline" className="shrink-0 text-xs">
                        <Link href={item.href}>
                          {group.key === "roll_call" ? "Fazer chamada" : group.key === "event_certificates" ? "Emitir" : "Abrir"}
                        </Link>
                      </Button>
                    ) : canMessage ? (
                      <WhatsAppButton
                        label={whatsAppLabel(item)}
                        done={Boolean(item.done)}
                        disabled={!whatsapp.ready}
                        onClick={() =>
                          whatsapp.send({
                            trigger: item.trigger,
                            recipient: {
                              name: item.recipientName ?? item.studentName,
                              phone: item.phone,
                              clientId: item.studentId,
                              aboutStudent: item.aboutStudent,
                            },
                            values: item.values,
                            ...(item.chargeId ? { chargeId: item.chargeId } : {}),
                          })
                        }
                      />
                    ) : (
                      <Button asChild variant="outline" className="shrink-0 text-xs">
                        <Link href={`/clients/${item.studentId}`}>Abrir ficha</Link>
                      </Button>
                    )}
                    {group.key === "packages" && canSellPackage ? (
                      // So o icone, no ritmo do WhatsApp das outras linhas.
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={`Vender pacote para ${item.studentName}`}
                        aria-label={`Vender pacote para ${item.studentName}`}
                        onClick={() => setSelling({ id: item.studentId, name: item.studentName })}
                      >
                        <TicketPlus className="size-4" />
                      </Button>
                    ) : null}
                    <ListItemActionsMenu
                      actions={itemActions(item)}
                      title="Mais ações"
                      ariaLabel={`Mais ações de ${item.studentName}`}
                      variant="ghost"
                    />
                  </StudentLine>
                </Fragment>
              );
            })}
          </TodoRow>
        );
      })}

      {levelPending.length > 0 ? (
        <TodoRow
          icon={<ArrowUpCircle className="size-4" />}
          tone="bg-amber-500/15 text-amber-700 dark:text-amber-400"
          title={`${plural(levelPending.length, "aluno precisa", "alunos precisam")} trocar de ${levelWord} pela idade`}
          detail={namesLine(levelPending.map((p) => p.client.name))}
          action="Ver"
        >
          {levelPending.map((p) => (
            <StudentLine key={p.key} name={p.client.name} detail={`${p.levelName} · ${p.modalityName} · passou da idade`}>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-xs"
                onClick={() => setGraduating({ client: p.client, modalityId: p.modalityId })}
              >
                {vocabularyForTrack(p.track, areaVocabulary).promoteVerb}
              </Button>
            </StudentLine>
          ))}
        </TodoRow>
      ) : null}
    </ul>
  );

  return (
    <>
      {bare ? (
        count > 0 ? (
          list
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nada para lembrar agora.</p>
        )
      ) : count > 0 ? (
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <p className="text-sm font-semibold text-foreground">Lembretes</p>
            <span className="text-xs text-muted-foreground">{plural(count, "pendência", "pendências")}</span>
          </div>
          {list}
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
      <ReminderSequenceDialog
        group={sequence}
        open={sequence !== null}
        onOpenChange={(open) => {
          if (!open) setSequence(null);
        }}
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

/**
 * Pendencias dos lembretes mais a troca de nivel pela idade (o numero do sino).
 * A troca de nivel vem contada dos lembretes (11/11/2026): antes o sino baixava
 * a lista inteira de alunos em toda tela so para contar.
 */
export function useReminderCount(today: string): number {
  const can = useCan();
  const reminders = useReminders(today);
  return reminders.pending + (can("clients:view") ? reminders.levelChanges : 0);
}
