"use client";

import { useAfterDialogClose } from "@/lib/use-dialog-presence";
import { cancelOpenCodeNote, chargeAccessibleLabel } from "../charge-label";
import { useState, type ReactElement, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { Ban, CheckCircle2, FileText, Info, Lock, MessageCircle, Paperclip, QrCode, RotateCcw } from "lucide-react";
import {
  ConfirmActionDialog,
  useConfirmAction,
} from "@/components/shared/confirm-action-dialog";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentMethodLabel } from "@/lib/labels";
import { useRetainedValue } from "@/lib/use-retained-value";
import { chargeInvoiceUrl, paymentPageUrl } from "@/lib/payment-page";
import { isSupabaseOrganization } from "@/lib/session";
import { cn } from "@/lib/utils";
import { formatCents } from "@gestarahub/core/format";
import { whatsappDigits } from "@gestarahub/core/phone";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { ChargeView } from "@gestarahub/contracts";
import { useCan, useCurrentUser, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { chargeReminder, useWhatsAppSend } from "@/features/communication";
import { competenceLabel, openFileAttachment } from "@/features/finance";
import {
  useActiveRecurringAuthorizations,
  useAwaitingOnlinePayments,
  useCancelCharge,
  useMarkChargePaid,
  useMarkChargePending,
  useRevertCharge,
} from "../hooks/use-billing";
import type { PaymentDialogResult } from "@/components/shared/payment-dialog";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { OnlineChargeDialog } from "./online-charge-dialog";
import {
  CANCEL_REASON_SUGGESTIONS,
  EXTRA_CANCEL_REASON_SUGGESTIONS,
  OnlineSettlementPopover,
  PAID_RECURRING_HINT,
  getCycleTitle,
  isInstallmentKind,
  isPaidOnline,
  isReplaced,
  isSystemCanceled,
} from "./charge-parts";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Acoes de uma cobranca (marcar pago, lembrar no WhatsApp, cobrar online,
 * cancelar, desfazer pagamento, reverter cancelamento) com os dialogos delas.
 * As mesmas em Cobrancas e no extrato da ficha do aluno: renderize `dialogs`
 * uma vez na tela.
 */
export function useChargeActions(options: { describeCharge?: boolean } = {}) {
  // Na ficha do aluno todas as cobrancas sao dele: o nome acessivel diz qual cobranca (achado 46).
  // Nas listas de Cobrancas fica so o nome do aluno.
  const nameOf = (c: ChargeView) => (options.describeCharge ? `${c.studentName}: ${chargeAccessibleLabel(c)}` : c.studentName);
  const [chargeToCancel, setChargeToCancel] = useState<ChargeView | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // O motivo limpa depois que a confirmacao fechou (evita o campo piscar vazio).
  useAfterDialogClose(chargeToCancel !== null, () => setCancelReason(""));
  // Conteudo do confirm com o ultimo valor: nao some durante a animacao de saida.
  const shownChargeToCancel = useRetainedValue(chargeToCancel);
  const [chargeToPay, setChargeToPay] = useState<ChargeView | null>(null);
  const [chargeToCollect, setChargeToCollect] = useState<ChargeView | null>(null);

  const paidMut = useMarkChargePaid();
  const pendingMut = useMarkChargePending();
  const cancelMut = useCancelCharge();
  const revertMut = useRevertCharge();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  const can = useCan();
  const canManage = can("billing:manage");
  // Recibo em PDF: gerado no servidor (conta real).
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);

  // Cobrar online: billing:manage + recurso do plano + opcao ligada.
  const hasOnlineFeature = useHasFeature()("online_payments");
  const { data: org, isPending: isOrgPending } = useOrganization();
  // Lembrete pelo WhatsApp do proprio espaco (assistido no gratis, oficial no Pro).
  const whatsapp = useWhatsAppSend();
  const onlineEnabled = Boolean(org?.settings?.onlinePayments?.enabled);
  const onlineBlockedReason = !hasOnlineFeature
    ? "Plano Profissional"
    : !onlineEnabled
      ? "ative em Recebimentos online"
      : null;

  // Codigo em aberto da cobranca (Pix ou link): o lembrete manda o link junto.
  const { data: awaitingOnline } = useAwaitingOnlinePayments(hasOnlineFeature && onlineEnabled && can("billing:view"));
  const reminderValues = (c: ChargeView, values: Record<string, string>): Record<string, string> => {
    const open = awaitingOnline?.find((p) => p.chargeId === c.id);
    const link = open?.publicCode
      ? paymentPageUrl(open.publicCode)
      : open?.linkUrl ?? (hasOnlineFeature && onlineEnabled ? chargeInvoiceUrl(c.id) : undefined);
    return link ? { ...values, link_pagamento: link } : values;
  };

  // Cancelar uma cobranca com Pix ou link em aberto invalida o codigo ja enviado (achado 64).
  const openCodeNote = cancelOpenCodeNote(
    Boolean(shownChargeToCancel && awaitingOnline?.some((p) => p.chargeId === shownChargeToCancel.id)),
  );

  // Limite do Pix Automatico por aluno (so autorizacoes ativas).
  const { data: activeRecurring } = useActiveRecurringAuthorizations(hasOnlineFeature);
  const recurringLimit = new Map((activeRecurring ?? []).map((a) => [a.studentId, a.maxAmountCents]));
  const overRecurringLimit = (c: ChargeView): number | undefined => {
    if (c.kind !== "membership" || (c.status !== "pending" && c.status !== "overdue")) return undefined;
    const limit = recurringLimit.get(c.studentId);
    return limit !== undefined && c.amountCents > limit ? limit : undefined;
  };

  const pay = (c: ChargeView, { method, paidOn, receipts }: PaymentDialogResult) =>
    paidMut.mutate(
      { id: c.id, method, paidOn, receipts },
      {
        onSuccess: () => {
          toast.success(`Pagamento registrado (${paymentMethodLabel(method)}).`);
          setChargeToPay(null);
        },
        onError: (err) => toast.error(getErrorMessage(err, "Não foi possível registrar o pagamento.")),
      },
    );

  const undoPayment = async (c: ChargeView) => {
    const ok = await confirmAction({
      title: "Desfazer pagamento?",
      description: `A cobrança de ${c.studentName} (${formatCents(c.amountCents)}) volta a ficar em aberto${c.method ? ` e o registro via ${paymentMethodLabel(c.method)} é apagado` : ""}.${c.teacherPayClosedIn ? ` Ela já entrou no pagamento do professor de ${competenceLabel(c.teacherPayClosedIn)}, que está fechado: o valor fechado não muda.` : ""}`,
      confirmLabel: "Desfazer pagamento",
      variant: "destructive",
    });
    if (!ok) return;
    pendingMut.mutate(c.id, {
      onSuccess: () => toast.success("Pagamento desfeito."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível desfazer o pagamento.")),
    });
  };

  const revertCancel = async (c: ChargeView) => {
    const ok = await confirmAction({
      title: "Reabrir cobrança?",
      description: `A cobrança de ${c.studentName} (${formatCents(c.amountCents)}) volta a compor o total a receber.`,
      confirmLabel: "Reabrir cobrança",
    });
    if (!ok) return;
    revertMut.mutate(c.id, {
      onSuccess: () => toast.success("Cobrança reaberta."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível reabrir a cobrança.")),
    });
  };

  // Acoes de cobranca em aberto: as mesmas no menu (⋮) e no clique direito.
  const openChargeActions = (c: ChargeView): ListItemAction[] => [
    {
      key: "pay",
      label: "Marcar pago",
      icon: <CheckCircle2 className="size-4" />,
      onSelect: () => setChargeToPay(c),
    },
    // Mensalidade: lembrete pela situacao; avulsa, curso e pacote: "Lembrete de cobrança".
    // Sem telefone valido o lembrete nao aparece (antes dava erro ao tocar).
    ...(c.kind !== "dropin" && whatsappDigits(c.guardianContact?.phone ?? c.studentPhone)
      ? [
          {
            key: "whatsapp",
            label: "Lembrar no WhatsApp",
            icon: <MessageCircle className="size-4" />,
            disabled: !whatsapp.ready,
            onSelect: () => {
              const reminder = chargeReminder(c, dateInSpace());
              if (!reminder) return;
              whatsapp.send({
                trigger: reminder.trigger,
                recipient: {
                  name: c.guardianContact?.name ?? c.studentName,
                  phone: c.guardianContact?.phone ?? c.studentPhone,
                  clientId: c.studentId,
                  aboutStudent: c.guardianContact ? c.studentName : undefined,
                },
                values: reminderValues(c, reminder.values),
                chargeId: c.id,
              });
            },
          },
        ]
      : []),
    {
      key: "online",
      label: onlineBlockedReason ? `Cobrar online (${onlineBlockedReason})` : "Cobrar online",
      icon: onlineBlockedReason ? <Lock className="size-4" /> : <QrCode className="size-4" />,
      disabled: Boolean(onlineBlockedReason),
      onSelect: () => setChargeToCollect(c),
    },
    {
      key: "cancel",
      label: "Cancelar cobrança",
      icon: <Ban className="size-4" />,
      destructive: true,
      onSelect: () => setChargeToCancel(c),
    },
  ];

  // Recibo do espaco e comprovantes anexados ao registrar o pagamento.
  const receiptActions = (c: ChargeView): ListItemAction[] => {
    const files = c.attachments ?? [];
    const receipt: ListItemAction[] = serverDocuments
      ? [
          {
            key: "receipt-pdf",
            label: "Baixar recibo",
            icon: <FileText className="size-4" />,
            onSelect: () => window.open(`/api/documents/charges/${c.id}/receipt`, "_blank", "noopener"),
          },
        ]
      : [];
    return [...receipt, ...files.map((file, i) => ({
      key: `receipt-${file.id}`,
      label: files.length > 1 ? `Ver comprovante ${i + 1}` : "Ver comprovante",
      icon: <Paperclip className="size-4" />,
      onSelect: () =>
        void openFileAttachment(file.id).then((ok) => {
          if (!ok) toast.error("Não foi possível abrir o arquivo.");
        }),
    }))];
  };

  // Clique direito: espelha o que a linha oferece (menu, desfazer ou reverter).
  const contextActions = (c: ChargeView): ListItemAction[] => {
    if (!canManage || c.status === "waived" || isReplaced(c)) return [];
    if (c.status === "canceled") {
      if (isSystemCanceled(c)) return [];
      return [
        {
          key: "revert",
          label: "Reverter cancelamento",
          icon: <RotateCcw className="size-4" />,
          disabled: revertMut.isPending,
          onSelect: () => revertCancel(c),
        },
      ];
    }
    if (c.status === "paid") {
      if (isPaidOnline(c)) return [];
      return [
        ...receiptActions(c),
        {
          key: "undo-payment",
          label: "Desfazer pagamento",
          icon: <RotateCcw className="size-4" />,
          onSelect: () => undoPayment(c),
        },
      ];
    }
    return openChargeActions(c);
  };

  // Sem acao (isenta, substituida, paga online): a linha fica sem menu de clique direito.
  const withContextMenu = (c: ChargeView, row: ReactElement) => {
    const actions = contextActions(c);
    if (actions.length === 0) return row;
    return (
      <ListItemContextMenu key={row.key ?? undefined} actions={actions}>
        {row}
      </ListItemContextMenu>
    );
  };

  // Acoes da linha (compact = sub-parcela dentro do painel expandido).
  const renderActions = (c: ChargeView, compact: boolean): ReactNode => {
    if (!canManage) return null;
    const iconCls = compact ? "size-3.5" : "size-4";

    // Isento (bolsa integral): nada a pagar, cobrar ou cancelar.
    if (c.status === "waived") return null;

    // Substituida ou encerrada pelo sistema: nao reabre; nada a fazer nela.
    if (isReplaced(c) || (c.status === "canceled" && isSystemCanceled(c))) return null;

    if (c.status === "canceled") {
      return (
        <Button
          variant="outline"
          disabled={revertMut.isPending}
          onClick={() => revertCancel(c)}
          title="Reverter cancelamento"
        >
          <RotateCcw className={iconCls} />
          Reverter
        </Button>
      );
    }

    if (c.status === "paid") {
      if (isPaidOnline(c)) {
        // Pago online: o (i) abre o mesmo quadro do selo (quando pagou, valores, saque, comprovante).
        if (c.paidVia === "online") {
          return (
            <OnlineSettlementPopover charge={c}>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Ver detalhes do pagamento online"
                aria-label={`Ver detalhes do pagamento online de ${c.studentName}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Info className={iconCls} />
              </Button>
            </OnlineSettlementPopover>
          );
        }
        const hint = PAID_RECURRING_HINT;
        return (
          <span
            title={hint}
            aria-label={hint}
            role="img"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground",
              compact ? "size-7" : "size-8",
            )}
          >
            <Info className={iconCls} />
          </span>
        );
      }
      if (c.attachments?.length) {
        return (
          <ListItemActionsMenu
            title="Mais opções"
            ariaLabel={`Ações de ${nameOf(c)}`}
            variant="ghost"
            actions={contextActions(c)}
          />
        );
      }
      const undoButton = (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Desfazer pagamento"
          onClick={() => undoPayment(c)}
        >
          <RotateCcw className={iconCls} />
        </Button>
      );
      if (!serverDocuments) return undoButton;
      return (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" asChild>
            <a
              href={`/api/documents/charges/${c.id}/receipt`}
              target="_blank"
              rel="noopener"
              title="Baixar recibo"
              aria-label={`Baixar recibo de ${nameOf(c)}`}
              onClick={(event) => event.stopPropagation()}
            >
              <FileText className={iconCls} />
            </a>
          </Button>
          {undoButton}
        </div>
      );
    }

    return (
      <ListItemActionsMenu
        title="Mais opções"
        ariaLabel={`Ações de ${nameOf(c)}`}
        variant="ghost"
        actions={openChargeActions(c)}
      />
    );
  };

  const dialogs = (
    <>
      {confirmDialog}
      <OnlineChargeDialog
        charge={chargeToCollect}
        onOpenChange={(open) => {
          if (!open) setChargeToCollect(null);
        }}
      />
      <RegisterPaymentDialog
        charge={chargeToPay}
        isPending={paidMut.isPending}
        onOpenChange={(open) => {
          if (!open) setChargeToPay(null);
        }}
        onConfirm={(payment) => chargeToPay && pay(chargeToPay, payment)}
      />

      {/* Confirmação de cancelamento da cobrança */}
      <ConfirmActionDialog
        open={chargeToCancel !== null}
        onOpenChange={(open) => {
          if (!open) setChargeToCancel(null);
        }}
        title="Cancelar a cobrança?"
        description={
          shownChargeToCancel ? (
            <>
              A cobrança de{" "}
              <strong className="text-foreground">{shownChargeToCancel.studentName}</strong>
              {getCycleTitle(shownChargeToCancel) !== "Mensalidade" ? (
                <> ({getCycleTitle(shownChargeToCancel)})</>
              ) : null}{" "}
              de <strong className="text-foreground">{formatCents(shownChargeToCancel.amountCents)}</strong> sai
              do total a receber. Fica no histórico e dá para reverter.
              {openCodeNote ? (
                <>
                  <br />
                  <br />
                  <strong className="text-foreground">{openCodeNote}</strong>
                </>
              ) : null}
            </>
          ) : null
        }
        confirmLabel="Cancelar cobrança"
        cancelLabel="Voltar"
        variant="destructive"
        isPending={cancelMut.isPending}
        onConfirm={async () => {
          if (!chargeToCancel) return;
          try {
            await cancelMut.mutateAsync({ id: chargeToCancel.id, reason: cancelReason });
            toast.success("Cobrança cancelada com sucesso.");
            setChargeToCancel(null);
            setCancelReason("");
          } catch (err) {
            toast.error(getErrorMessage(err, "Não foi possível cancelar a cobrança."));
          }
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
            Motivo (opcional)
          </label>
          <Input
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Informe o motivo do cancelamento"
            maxLength={120}
            disabled={cancelMut.isPending}
            className="text-base md:text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {(shownChargeToCancel && isInstallmentKind(shownChargeToCancel)
              ? EXTRA_CANCEL_REASON_SUGGESTIONS
              : CANCEL_REASON_SUGGESTIONS
            ).map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={cancelMut.isPending}
                onClick={() => setCancelReason(reason)}
                className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                + {reason}
              </button>
            ))}
          </div>
        </div>
      </ConfirmActionDialog>
    </>
  );

  return { canManage, isOrgPending, overRecurringLimit, contextActions, withContextMenu, renderActions, dialogs, reminderValues };
}
