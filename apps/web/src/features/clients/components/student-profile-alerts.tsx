"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, Copy, FileText, MessageCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ChargeView, Id, MessageTrigger, PersonDocumentView, StudentSummary } from "@gestarahub/contracts";
import { todayISO, dateInSpace, timeInSpace } from "@gestarahub/core/date";
import { formatCents, formatDate } from "@gestarahub/core/format";
import { documentExpiryGroupKey, documentExpiryText } from "@gestarahub/core/person-documents";
import { Button } from "@/components/ui/button";
import { nextBirthdayLabel } from "@/lib/birthdays";
import { selectEndingPackages } from "@/lib/package-ending";
import { cn } from "@/lib/utils";
import { whatsappNumber } from "@/lib/whatsapp";
import {
  chargeReference,
  chargeReminder,
  packageRemainingText,
  useMessageLogs,
  useWhatsAppSend,
} from "@/features/communication";
import { useAbsenceStreaks, useChargeActions, useCharges } from "@/features/turmas";
import { withKind } from "@/lib/text";
import { minorConsentUrl } from "@/lib/minor-consent-link";
import { minorConsentAlertDetail } from "../minor-consent";

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
  documents,
  onOpenDocuments,
}: {
  summary: StudentSummary;
  isClasses: boolean;
  canSeeBilling: boolean;
  canMessage: boolean;
  /** Varias cobrancas atrasadas: abre a secao Cobrancas. */
  onOpenCharges: () => void;
  /** Ausente sem permissao de vender pacote. */
  onSellPackage?: (packageId?: Id) => void;
  /** Documentos da ficha (doc product/28): vencido ou vencendo vira aviso. */
  documents?: PersonDocumentView[];
  onOpenDocuments?: () => void;
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

  // Ja mandou hoje (a mao ou no automatico do oficial): o aviso diz quando, em
  // vez de oferecer mandar de novo.
  const { data: logs } = useMessageLogs({ clientId: student.id }, canMessage);
  const sentTodayAt = (trigger: MessageTrigger, chargeId?: Id): string | null => {
    const log = (logs ?? []).find(
      (l) =>
        l.trigger === trigger &&
        l.status !== "failed" &&
        (!chargeId || l.chargeId === chargeId) &&
        dateInSpace(l.sentAt) === today,
    );
    return log ? timeInSpace(log.sentAt) : null;
  };
  const sentNote = (time: string) => (
    <span className="text-xs text-muted-foreground">Enviado hoje às {time}</span>
  );
  /** Botao de WhatsApp do aviso, ou "Enviado hoje as HH:mm". */
  const whatsAppAction = (trigger: MessageTrigger, button: ReactNode, chargeId?: Id): ReactNode => {
    if (!canWhatsApp) return null;
    const time = sentTodayAt(trigger, chargeId);
    return time ? sentNote(time) : button;
  };

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
            <Button variant="outline" onClick={pay.onSelect}>
              Marcar pago
            </Button>
          ) : null}
          {reminder
            ? whatsAppAction(
                reminder.trigger,
                <Button
                  variant="outline"
                  onClick={() =>
                    whatsapp.send({
                      trigger: reminder.trigger,
                      recipient,
                      values: chargeActions.reminderValues(charge, reminder.values),
                      chargeId: charge.id,
                    })
                  }
                >
                  <MessageCircle className="size-4" />
                  Cobrar
                </Button>,
                charge.id,
              )
            : null}
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
      actions: whatsAppAction(
        "absence_alert",
        <Button variant="outline" onClick={() => whatsapp.send({ trigger: "absence_alert", recipient })}>
          <MessageCircle className="size-4" />
          Mandar mensagem
        </Button>,
      ),
    });
  }

  // Pacote acabando (a mesma regra do "Para fazer hoje").
  const ending = isClasses ? selectEndingPackages(summary.packages, today)[0] : undefined;
  if (ending) {
    const restante = packageRemainingText(ending.pkg, today);
    alerts.push({
      key: "package",
      title: withKind("Pacote", ending.pkg.name),
      detail: capitalize(restante),
      actions: (
        <>
          {onSellPackage ? (
            <Button variant="outline" onClick={() => onSellPackage(ending.pkg.packageId)}>
              Vender pacote
            </Button>
          ) : null}
          {whatsAppAction(
            "package_ending",
            <Button
              variant="outline"
              onClick={() =>
                whatsapp.send({ trigger: "package_ending", recipient, values: { pacote: ending.pkg.name, restante } })
              }
            >
              <MessageCircle className="size-4" />
              Avisar
            </Button>,
          )}
        </>
      ),
    });
  }

  // Aniversario hoje ou amanha. Os parabens so no dia (a mensagem diz "seu dia").
  const days = summary.daysToBirthday;
  if (student.birthDate && days !== null && days <= 1) {
    const turning = days === 0 ? summary.age : summary.age === null ? null : summary.age + 1;
    const when = nextBirthdayLabel(student.birthDate, today);
    alerts.push({
      key: "birthday",
      title: days === 0 ? "Faz aniversário hoje" : "Faz aniversário amanhã",
      detail: turning === null ? when : `${turning} anos em ${when}`,
      actions: days !== 0 ? null : whatsAppAction(
        "birthday_greeting",
        <Button variant="outline" onClick={() => whatsapp.send({ trigger: "birthday_greeting", recipient })}>
          <Cake className="size-4" />
          Mandar parabéns
        </Button>,
      ),
    });
  }

  // Documento vencido ou vencendo (atestado): por tipo vale o de validade mais
  // longa, entao o atestado renovado tira o aviso (doc product/28).
  const latestByKind = new Map<string, PersonDocumentView>();
  for (const doc of documents ?? []) {
    if (!doc.expiresOn) continue;
    const key = documentExpiryGroupKey("client", doc.kind, doc.title);
    const current = latestByKind.get(key);
    if (!current || (current.expiresOn ?? "") < doc.expiresOn) latestByKind.set(key, doc);
  }
  for (const doc of latestByKind.values()) {
    if (doc.expiry !== "expired" && doc.expiry !== "expiring") continue;
    alerts.push({
      key: `document:${doc.id}`,
      title: doc.expiry === "expired" ? `${doc.label} vencido` : `${doc.label} vence em breve`,
      detail: `${documentExpiryText(doc.daysToExpire) ?? ""} (${formatDate(doc.expiresOn ?? "")}).`,
      danger: doc.expiry === "expired",
      actions: onOpenDocuments ? (
        <Button variant="outline" onClick={onOpenDocuments}>
          <FileText className="size-4" />
          Ver documentos
        </Button>
      ) : null,
    });
  }

  // Autorização de menor pendente (Art. 14 LGPD): se menor de 18 anos e termo pendente.
  const minorConsentDetail = minorConsentAlertDetail(student);
  if (minorConsentDetail) {
    const guardianWithPhone = student.guardians?.find((g) => Boolean(g.phone));
    const targetPhone = guardianWithPhone?.phone || student.phone;
    const targetName = guardianWithPhone?.name || "Responsável legal";

    alerts.push({
      key: "minor_consent",
      title: "Autorização de menor pendente (LGPD)",
      detail: minorConsentDetail,
      actions: (
        <>
          <Button
            variant="outline"
            onClick={() => {
              const url = minorConsentUrl(student.id);
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                toast.success("Link copiado para a área de transferência.");
              }
            }}
          >
            <Copy className="size-4" />
            Copiar link
          </Button>
          {targetPhone ? (
            <Button
              variant="outline"
              onClick={() => {
                const url = minorConsentUrl(student.id);
                const msg = `Olá, ${targetName}! Segue o link de autorização de matrícula e LGPD do aluno(a) ${student.name}: ${url}\n\nPor favor, confirme no link acima.`;
                const cleanPhone = targetPhone.replace(/\D/g, "");
                const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, "_blank");
              }}
            >
              <MessageCircle className="size-4 text-emerald-600" />
              Enviar por WhatsApp
            </Button>
          ) : null}
        </>
      ),
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
                <p className={cn("text-xs", a.danger ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
                  {a.detail}
                </p>
              </div>
              {/* Mesmo arranjo em todos os avisos: no celular os botoes dividem a linha. */}
              {a.actions ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                  {a.actions}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {chargeActions.dialogs}
    </>
  );
}
