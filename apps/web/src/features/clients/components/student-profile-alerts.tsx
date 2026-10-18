"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, MessageCircle } from "lucide-react";
import type { ChargeView, Id, StudentSummary } from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { formatCents } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { selectEndingPackages } from "@/lib/package-ending";
import { cn } from "@/lib/utils";
import { whatsappNumber } from "@/lib/whatsapp";
import { chargeReference, chargeReminder, packageRemainingText, useWhatsAppSend } from "@/features/communication";
import { useAbsenceStreaks, useChargeActions, useCharges } from "@/features/turmas";

interface StudentAlert {
  key: string;
  title: string;
  detail: string;
  /** Atraso: cartao vermelho. */
  danger?: boolean;
  actions?: ReactNode;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** "Mensalidade de outubro atrasada", "Parcela 2 de 4 do curso Confeitaria atrasada". */
function overdueTitle(charge: ChargeView): string {
  const what =
    charge.kind === "membership" && charge.competence
      ? `mensalidade de ${format(parseISO(`${charge.competence}-01`), "MMMM", { locale: ptBR })}`
      : chargeReference(charge);
  return `${capitalize(what)} atrasada`;
}

/**
 * Topo da ficha: so o que pede acao agora, um cartao por assunto (atraso,
 * faltas seguidas, pacote acabando, aniversario hoje ou amanha). Nada a fazer,
 * nada aparece. As acoes sao as mesmas de Cobrancas e do Dashboard.
 */
export function StudentProfileAlerts({
  summary,
  isClasses,
  canSeeBilling,
  canMessage,
  onOpenCharges,
  onSellPackage,
}: {
  summary: StudentSummary;
  isClasses: boolean;
  canSeeBilling: boolean;
  canMessage: boolean;
  /** Varias cobrancas atrasadas: abre a secao Cobrancas. */
  onOpenCharges: () => void;
  /** Ausente sem permissao de vender pacote. */
  onSellPackage?: (packageId?: Id) => void;
}) {
  const today = todayISO();
  const { student } = summary;
  const whatsapp = useWhatsAppSend();
  const chargeActions = useChargeActions();
  const { data: charges } = useCharges({ studentId: student.id }, canSeeBilling);
  const { data: streaks } = useAbsenceStreaks();
  const canWhatsApp = canMessage && Boolean(whatsappNumber(student.phone)) && whatsapp.ready;
  const recipient = { name: student.name, phone: student.phone, clientId: student.id };
  const alerts: StudentAlert[] = [];

  // Atraso: um so mostra o que e e as acoes; varios levam para Cobrancas.
  const overdue = (charges ?? [])
    .filter((c) => c.status === "overdue")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (overdue.length === 1) {
    const charge = overdue[0];
    const pay = chargeActions.contextActions(charge).find((a) => a.key === "pay");
    const reminder = chargeReminder(charge, today);
    alerts.push({
      key: "overdue",
      danger: true,
      title: overdueTitle(charge),
      detail: `${formatCents(charge.amountCents)} · venceu ${ddmm(charge.dueDate)}`,
      actions: (
        <>
          {pay?.onSelect ? (
            <Button variant="ghost" onClick={pay.onSelect}>
              Marcar pago
            </Button>
          ) : null}
          {canWhatsApp && reminder ? (
            <Button
              variant="outline"
              onClick={() =>
                whatsapp.send({ trigger: reminder.trigger, recipient, values: reminder.values, chargeId: charge.id })
              }
            >
              <MessageCircle className="size-4" />
              Cobrar
            </Button>
          ) : null}
        </>
      ),
    });
  } else if (overdue.length > 1) {
    const total = overdue.reduce((sum, c) => sum + c.amountCents, 0);
    alerts.push({
      key: "overdue",
      danger: true,
      title: `${overdue.length} cobranças atrasadas`,
      detail: `${formatCents(total)} · a mais antiga venceu ${ddmm(overdue[0].dueDate)}`,
      actions: (
        <Button variant="outline" onClick={onOpenCharges}>
          Ver cobranças
        </Button>
      ),
    });
  }

  // Faltas seguidas (a mesma conta do "Sentimos sua falta" do Dashboard).
  const streak = isClasses ? (streaks ?? []).find((s) => s.studentId === student.id) : undefined;
  if (streak) {
    alerts.push({
      key: "absence",
      title: `Faltou nas últimas ${streak.streak} aulas`,
      detail: [`Desde ${ddmm(streak.since)}`, ...streak.classGroupNames].join(" · "),
      actions: canWhatsApp ? (
        <Button variant="outline" onClick={() => whatsapp.send({ trigger: "absence_alert", recipient })}>
          <MessageCircle className="size-4" />
          Mandar mensagem
        </Button>
      ) : null,
    });
  }

  // Pacote acabando (a mesma regra do "Para fazer hoje").
  const ending = isClasses ? selectEndingPackages(summary.packages, today)[0] : undefined;
  if (ending) {
    const restante = packageRemainingText(ending.pkg, today);
    alerts.push({
      key: "package",
      title: `Pacote ${ending.pkg.name}`,
      detail: capitalize(restante),
      actions: (
        <>
          {onSellPackage ? (
            <Button variant="ghost" onClick={() => onSellPackage(ending.pkg.packageId)}>
              Vender pacote
            </Button>
          ) : null}
          {canWhatsApp ? (
            <Button
              variant="outline"
              onClick={() =>
                whatsapp.send({ trigger: "package_ending", recipient, values: { pacote: ending.pkg.name, restante } })
              }
            >
              <MessageCircle className="size-4" />
              Avisar
            </Button>
          ) : null}
        </>
      ),
    });
  }

  // Aniversario hoje ou amanha.
  const days = summary.daysToBirthday;
  if (student.birthDate && days !== null && days <= 1) {
    const turning = days === 0 ? summary.age : summary.age === null ? null : summary.age + 1;
    alerts.push({
      key: "birthday",
      title: days === 0 ? "Faz aniversário hoje" : "Faz aniversário amanhã",
      detail: turning === null ? ddmm(student.birthDate) : `${turning} anos em ${ddmm(student.birthDate)}`,
      actions: canWhatsApp ? (
        <Button variant="outline" onClick={() => whatsapp.send({ trigger: "birthday_greeting", recipient })}>
          <Cake className="size-4" />
          Mandar parabéns
        </Button>
      ) : null,
    });
  }

  return (
    <>
      {alerts.length > 0 ? (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <div
              key={a.key}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                a.danger && "border-red-500/30 bg-red-500/5",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className={cn("text-xs", a.danger ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                  {a.detail}
                </p>
              </div>
              {a.actions ? <div className="flex flex-wrap items-center gap-2">{a.actions}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {chargeActions.dialogs}
    </>
  );
}
