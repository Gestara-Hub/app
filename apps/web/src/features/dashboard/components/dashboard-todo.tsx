"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpCircle,
  ArrowUpRight,
  Award,
  BellOff,
  Cake,
  CalendarClock,
  ChevronDown,
  Clock,
  HandCoins,
  HeartHandshake,
  MessageCircle,
  Ticket,
  UserPlus,
} from "lucide-react";
import type { Client } from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { InitialsAvatar } from "@/components/shared/list";
import { ListItemActionsMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sharedVocabularyFor, vocabularyForTrack } from "@/lib/business-segment-presets";
import { cn } from "@/lib/utils";
import { useCan } from "@/features/auth";
import { StudentGraduationDialog } from "@/features/clients";
import {
  ReminderSequenceDialog,
  useReminders,
  useWhatsAppSend,
  type ReminderGroup,
  type ReminderItem,
} from "@/features/communication";
import { useSegmentVocabulary } from "@/features/settings";
import { SellPackageDialog } from "@/features/turmas";
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
          <Button variant="outline" className="shrink-0 gap-1 text-xs" asChild>
            <Link href={href}>
              {action}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {action}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </Button>
        )}
      </div>
      {children && open ? (
        <div className="space-y-2.5 border-t border-border/60 bg-muted/20 px-4 py-3">
          {toolbar}
          <ul className="space-y-2.5">{children}</ul>
          {footer}
        </div>
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
  payment_received: { icon: <HandCoins className="size-4" />, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  schedule_change: { icon: <CalendarClock className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  broadcast: { icon: <MessageCircle className="size-4" />, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

/** Rotulo do botao do WhatsApp pelo tipo de lembrete. */
function whatsAppLabel(item: ReminderItem): string {
  if (item.trigger === "birthday_greeting") return `Mandar parabéns para ${item.studentName} no WhatsApp`;
  if (item.trigger === "package_ending") return `Avisar ${item.studentName} no WhatsApp`;
  if (item.trigger === "payment_received") return `Agradecer ${item.studentName} no WhatsApp`;
  if (item.trigger === "level_up") return `Parabenizar ${item.studentName} pelo avanço no WhatsApp`;
  if (item.trigger === "welcome_student") return `Dar boas-vindas a ${item.studentName} no WhatsApp`;
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
export function DashboardTodo({ today, bare = false }: { today: string; /** Sem o cartao (no painel do sino). */ bare?: boolean }) {
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

  // Titulo do bloco: a palavra das modalidades listadas quando todas falam
  // igual, senao a da area. O botao de cada aluno segue a modalidade dele.
  const levelWord = sharedVocabularyFor(
    levelPending.map((p) => p.track),
    areaVocabulary,
  ).level.toLowerCase();
  const count = reminders.pending + levelPending.length;

  function itemActions(item: ReminderItem): ListItemAction[] {
    return [
      { key: "snooze", label: "Lembrar amanhã", icon: <Clock className="size-4" />, onSelect: () => reminders.snooze(item.key) },
      { key: "ignore", label: "Não lembrar deste", icon: <BellOff className="size-4" />, onSelect: () => reminders.ignore(item.key) },
    ];
  }

  const list = (
    <ul className="divide-y divide-border/60">
      {reminders.groups.map((group) => (
        <TodoRow
          key={group.key}
          icon={GROUP_LOOK[group.key].icon}
          tone={GROUP_LOOK[group.key].tone}
          title={group.title}
          detail={group.detail}
          action="Ver"
          toolbar={
            group.pending >= 2 && canMessage ? (
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                disabled={!whatsapp.ready}
                onClick={() => setSequence(group)}
              >
                <MessageCircle className="size-3.5" />
                Enviar em sequência ({group.pending})
              </Button>
            ) : undefined
          }
          footer={
            group.hidden > 0 || group.href ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {group.hidden > 0 ? <span>e mais {group.hidden}</span> : null}
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
          {group.items.map((item) => (
            <StudentLine key={item.key} name={item.studentName} detail={item.detail} done={item.done}>
              {canMessage ? (
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
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 text-xs"
                  onClick={() => setSelling({ id: item.studentId, name: item.studentName })}
                >
                  Vender pacote
                </Button>
              ) : null}
              <ListItemActionsMenu
                actions={itemActions(item)}
                title="Mais ações"
                ariaLabel={`Mais ações de ${item.studentName}`}
                variant="ghost"
              />
            </StudentLine>
          ))}
        </TodoRow>
      ))}

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

/** Pendencias dos lembretes mais a troca de nivel pela idade (o numero do sino). */
export function useReminderCount(today: string): number {
  const can = useCan();
  const reminders = useReminders(today);
  const levelPending = useLevelChangePending(today, can("clients:view"));
  return reminders.pending + levelPending.length;
}
