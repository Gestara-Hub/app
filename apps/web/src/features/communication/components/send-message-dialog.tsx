"use client";

import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Check } from "lucide-react";
import type { WhatsAppConsentStatus } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatPhone, plural } from "@gestarahub/core/format";
import { MultiSelectField, TextArea } from "@/components/form";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH, personalizeMessage, whatsappNumber } from "@/lib/whatsapp";
import { charCount } from "@/lib/text";
import { useOrganization } from "@/features/settings";
import {
  useMessageComposerContext,
  useMessageSuggestions,
  useWhatsAppSend,
} from "../hooks/use-communication";
import type { ReminderGroup } from "../reminders";
import { ReminderSequenceDialog } from "./reminder-sequence-dialog";
import type { MessageSuggestion } from "../message-suggestions";

const schema = z.object({
  clientIds: z.array(z.string()).min(1, "Selecione ao menos um aluno."),
  content: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem.")
    .refine(
      (v) => charCount(v) <= MESSAGE_MAX_LENGTH,
      `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.`,
    ),
});
type FormValues = z.infer<typeof schema>;

/** Aluno fixo (ficha do aluno): o campo de aluno nao aparece. */
export interface MessageRecipient {
  id: string;
  name: string;
  phone?: string;
  whatsappConsentStatus?: WhatsAppConsentStatus;
}

function SendMessageForm({
  onDone,
  onSequence,
  fixed,
}: {
  onDone: () => void;
  /** Varios alunos: o envio segue em sequencia (um toque por aluno), fora desta janela. */
  onSequence: (group: ReminderGroup) => void;
  fixed?: MessageRecipient;
}) {
  const { data: composerContext } = useMessageComposerContext(!fixed);
  const clients: MessageRecipient[] = fixed ? [fixed] : (composerContext?.recipients ?? []);
  const classGroups = fixed ? [] : (composerContext?.classGroups ?? []);
  const whatsapp = useWhatsAppSend();
  const official = whatsapp.mode === "official";
  const { data: organization } = useOrganization();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientIds: fixed ? [fixed.id] : [], content: "" },
  });
  const clientIds =
    useWatch({ control: form.control, name: "clientIds" }) ?? [];
  const contentLength = charCount(
    useWatch({ control: form.control, name: "content" }) ?? "",
  );
  const picked = clients.filter((c) => clientIds.includes(c.id));
  // Modelos e sugestoes valem para um aluno so; com varios, a mensagem e a mesma para todos.
  const recipient = picked.length === 1 ? picked[0] : undefined;
  const many = picked.length > 1;
  const noPhone = Boolean(recipient && !whatsappNumber(recipient.phone));
  const withoutPhone = picked.filter((c) => !whatsappNumber(c.phone)).length;
  const hasOfficialConsent = (c: MessageRecipient) =>
    !official || c.whatsappConsentStatus === undefined || c.whatsappConsentStatus === "granted";
  const unauthorizedPicked = official
    ? picked.filter((c) => c.whatsappConsentStatus !== undefined && c.whatsappConsentStatus !== "granted")
    : [];
  const eligiblePicked = picked.filter((c) => Boolean(whatsappNumber(c.phone)) && hasOfficialConsent(c));
  const quotaInfo = whatsapp.connection?.monthlyQuota;
  const remainingQuota = quotaInfo ? Math.max(0, quotaInfo.included - quotaInfo.used) : Infinity;

  const suggestions = useMessageSuggestions(recipient?.id);
  // Modelo escolhido (o envio leva o tipo dele e a cobranca ligada).
  const [chosen, setChosen] = useState<MessageSuggestion | null>(null);
  // Texto que o modelo montou: trocar o aluno com ele intacto limpa o campo.
  const chosenText = useRef<string | null>(null);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const batchSending = batchProgress !== null;

  useEffect(
    () =>
      form.subscribe({
        name: ["clientIds", "content"],
        formState: { values: true },
        callback: ({ values, name }) => {
          setConfirmingBatch(false);
          const switchedStudent = name === "clientIds";
          if (!switchedStudent && values.content?.trim()) return;
          if (
            switchedStudent &&
            chosenText.current !== null &&
            values.content === chosenText.current
          ) {
            form.setValue("content", "");
          }
          // Campo apagado ou outro aluno: volta a ser mensagem avulsa.
          chosenText.current = null;
          setChosen(null);
        },
      }),
    [form],
  );

  // So os modelos que existem (o texto sai do modelo salvo em Comunicacao).
  const templates = recipient
    ? suggestions.flatMap((suggestion) => {
        const text = whatsapp.compose(
          suggestion.trigger,
          suggestion.values,
          recipient.name,
        );
        return text ? [{ suggestion, text }] : [];
      })
    : [];

  function applyTemplate(item: {
    suggestion: MessageSuggestion;
    text: string;
  }) {
    form.setValue("content", item.text, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    chosenText.current = item.text;
    setChosen(item.suggestion);
    // No toque, sem foco automatico (o teclado cobriria a tela).
    if (!window.matchMedia("(pointer: coarse)").matches)
      form.setFocus("content");
  }

  function applyClientSelection(nextIds: string[]) {
    form.setValue("clientIds", nextIds, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  }

  function selectAllEligible() {
    const withPhone = clients.filter((c) => Boolean(whatsappNumber(c.phone)));
    const eligible = withPhone.filter(hasOfficialConsent);
    if (eligible.length === 0) {
      if (official && withPhone.length > 0) {
        toast.info("Nenhum aluno com WhatsApp tem autorização para envio oficial.");
      }
      return;
    }
    applyClientSelection(eligible.map((c) => c.id));
    if (official && withPhone.length > eligible.length) {
      const skipped = withPhone.length - eligible.length;
      toast.info(
        `${plural(skipped, "aluno sem autorização ficou de fora", "alunos sem autorização ficaram de fora")}.`,
      );
    }
  }

  function selectByClassGroup(classGroupId: string) {
    const group = classGroups.find((g) => g.id === classGroupId);
    if (!group) return;
    const inGroup = new Set(group.studentIds);
    const groupClients = clients.filter((c) => inGroup.has(c.id) && Boolean(whatsappNumber(c.phone)));
    const eligible = groupClients.filter(hasOfficialConsent);
    if (eligible.length === 0) {
      toast.info("Nenhum aluno desta turma tem autorização e WhatsApp para envio oficial.");
      return;
    }
    applyClientSelection(Array.from(new Set([...clientIds, ...eligible.map((c) => c.id)])));
    if (official && groupClients.length > eligible.length) {
      const skipped = groupClients.length - eligible.length;
      toast.info(
        `${plural(skipped, "aluno da turma sem autorização ficou de fora", "alunos da turma sem autorização ficaram de fora")}.`,
      );
    }
  }

  const options = clients.map((c) => {
    const base = c.phone ? `${c.name} · ${formatPhone(c.phone)}` : `${c.name} · sem telefone`;
    const missingConsent = official && c.whatsappConsentStatus !== undefined && c.whatsappConsentStatus !== "granted";
    return {
      value: c.id,
      label: missingConsent ? `${base} (sem autorização)` : base,
    };
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const chosenClients = clients.filter((c) =>
      values.clientIds.includes(c.id),
    );
    if (chosenClients.length === 0) return;
    if (chosenClients.length > 1) {
      if (official) {
        const toSend = chosenClients.filter((c) => Boolean(whatsappNumber(c.phone)) && hasOfficialConsent(c));
        if (toSend.length === 0) {
          form.setError("clientIds", {
            message: "Nenhum aluno selecionado tem autorização para envio oficial.",
          });
          return;
        }
        if (remainingQuota <= 0) {
          toast.error("Franquia mensal do WhatsApp oficial esgotada.");
          return;
        }
        if (!confirmingBatch) {
          setConfirmingBatch(true);
          return;
        }
        const capped = Number.isFinite(remainingQuota) ? toSend.slice(0, remainingQuota) : toSend;
        let sentCount = 0;
        let queuedCount = 0;
        let failedCount = 0;
        let lastError = "";
        for (let i = 0; i < capped.length; i += 1) {
          setBatchProgress({ done: i, total: capped.length });
          const c = capped[i];
          const phone = whatsappNumber(c.phone);
          if (!phone) continue;
          try {
            const log = await whatsapp.sendOfficialDirect({
              trigger: "manual_broadcast",
              recipientName: c.name,
              recipientPhone: phone,
              content: personalizeMessage(values.content, c.name, organization?.name),
              clientId: c.id,
            });
            if (log.status === "queued") queuedCount += 1;
            else sentCount += 1;
          } catch (err) {
            failedCount += 1;
            lastError = getErrorMessage(err, "Falha ao enviar");
            if (lastError.toLowerCase().includes("franquia")) break;
          }
        }
        setBatchProgress(null);
        setConfirmingBatch(false);
        const totalOk = sentCount + queuedCount;
        if (failedCount === 0) {
          toast.success(
            `${plural(totalOk, "mensagem enviada", "mensagens enviadas")}${queuedCount > 0 ? ` (${queuedCount} na fila)` : ""}.`,
          );
        } else if (totalOk > 0) {
          toast.info(`${totalOk} enviada(s) e ${failedCount} falha(s). Confira os detalhes em Histórico.`);
        } else {
          toast.error(lastError || "Não foi possível enviar as mensagens.");
        }
        onDone();
        return;
      }

      // Assistido: em sequencia, um toque por aluno (o navegador nao abre varias abas sozinho).
      onSequence({
        key: "broadcast",
        category: "notice",
        level: "info",
        title: `Mensagem para ${plural(chosenClients.length, "aluno", "alunos")}`,
        detail: "Mensagem avulsa",
        items: chosenClients.map((c) => ({
          key: `broadcast:${c.id}`,
          studentId: c.id,
          studentName: c.name,
          ...(c.phone ? { phone: c.phone } : {}),
          trigger: "manual_broadcast" as const,
          values: {},
          content: personalizeMessage(
            values.content,
            c.name,
            organization?.name,
          ),
          detail: c.phone ? formatPhone(c.phone) : "Sem telefone",
        })),
        hidden: 0,
        pending: chosenClients.length,
      });
      onDone();
      return;
    }
    const client = chosenClients[0];
    if (!whatsappNumber(client.phone)) {
      form.setError("clientIds", {
        message: "Este aluno não tem WhatsApp com DDD no cadastro.",
      });
      return;
    }
    if (!hasOfficialConsent(client)) {
      form.setError("clientIds", {
        message: "Este aluno ainda não autorizou mensagens pelo WhatsApp oficial.",
      });
      return;
    }
    whatsapp.send({
      trigger: chosen?.trigger ?? "manual_broadcast",
      recipient: {
        name: client.name,
        phone: client.phone,
        clientId: client.id,
      },
      content: personalizeMessage(
        values.content,
        client.name,
        organization?.name,
      ),
      chargeId: chosen?.chargeId,
      // Valores do modelo escolhido: com o texto intacto, o oficial usa o modelo aprovado.
      values: chosen?.values,
      reviewed: true,
    });
    onDone();
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DialogBody className="space-y-4">
          {fixed ? (
            noPhone ? (
              <p className="text-sm text-destructive">
                Este aluno não tem WhatsApp com DDD no cadastro.
              </p>
            ) : null
          ) : (
            <div className="space-y-1.5">
              <MultiSelectField<FormValues>
                name="clientIds"
                label="Alunos"
                placeholder="Selecione um ou mais alunos"
                searchPlaceholder="Buscar aluno..."
                emptyMessage="Nenhum aluno encontrado."
                options={options}
                maxVisible={3}
                required
                hint={
                  noPhone
                    ? "Este aluno não tem WhatsApp com DDD no cadastro."
                    : many && withoutPhone > 0
                      ? `${plural(withoutPhone, "aluno sem WhatsApp com DDD será pulado", "alunos sem WhatsApp com DDD serão pulados")}.`
                      : many
                        ? official
                          ? "A mensagem vai automaticamente para cada aluno autorizado. Use {aluno} para o nome."
                          : "A mensagem vai para cada aluno, em sequência. Use {aluno} para o nome."
                        : undefined
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={selectAllEligible}
                >
                  Selecionar todos com WhatsApp
                </Button>
                {classGroups.length > 0 ? (
                  <Select value="" onValueChange={selectByClassGroup}>
                    <SelectTrigger className="h-7 w-auto min-w-36 text-xs" aria-label="Adicionar por turma">
                      <SelectValue placeholder="Por turma..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.studentIds.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {clientIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      applyClientSelection([]);
                      setConfirmingBatch(false);
                    }}
                  >
                    Limpar ({clientIds.length})
                  </Button>
                ) : null}
              </div>
              {official && unauthorizedPicked.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {picked.length === 1
                      ? "Este aluno ainda não autorizou mensagens pelo WhatsApp oficial. Registre a autorização na ficha do aluno."
                      : `${plural(unauthorizedPicked.length, "aluno selecionado não autorizou o envio oficial e será pulado", "alunos selecionados não autorizaram o envio oficial e serão pulados")}.`}
                  </span>
                </div>
              ) : null}
            </div>
          )}
          <div className="space-y-1">
            <TextArea<FormValues>
              name="content"
              label="Mensagem"
              placeholder="Escreva a mensagem ou use um modelo"
              rows={5}
              required
            />
            {/* Contador como a pessoa ve: emoji conta 1 (ALU-38). */}
            <p
              className={cn(
                "text-right text-[11px] tabular-nums",
                contentLength > MESSAGE_MAX_LENGTH
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {contentLength} de {MESSAGE_MAX_LENGTH}
            </p>
          </div>
          {templates.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Modelos</p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((item) => {
                  const active = chosen?.key === item.suggestion.key;
                  return (
                    <button
                      key={item.suggestion.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyTemplate(item)}
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 font-medium text-foreground"
                          : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                      {item.suggestion.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {confirmingBatch && official && many ? (
            <div className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
              <p className="font-semibold">
                Confirmar envio oficial para {plural(Math.min(eligiblePicked.length, remainingQuota), "aluno", "alunos")}?
              </p>
              {quotaInfo ? (
                <p className="text-muted-foreground">
                  {remainingQuota < eligiblePicked.length
                    ? `Sua franquia restante (${remainingQuota}) comporta apenas ${remainingQuota} de ${eligiblePicked.length} envios; os demais não serão disparados.`
                    : `Consome ${eligiblePicked.length} de ${remainingQuota} mensagens restantes na franquia do ciclo.`}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter saving={whatsapp.isSending || batchSending} className="shrink-0 border-t border-border/40 px-6 py-4">
          {confirmingBatch && !batchSending ? (
            <Button type="button" variant="outline" onClick={() => setConfirmingBatch(false)}>
              Voltar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onDone} disabled={batchSending}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              noPhone ||
              whatsapp.isSending ||
              batchSending ||
              (official && eligiblePicked.length === 0 && picked.length > 0)
            }
          >
            {batchSending
              ? `Enviando (${batchProgress.done}/${batchProgress.total})...`
              : many
                ? official
                  ? confirmingBatch
                    ? `Confirmar envio (${Math.min(eligiblePicked.length, remainingQuota)})`
                    : `Enviar para ${eligiblePicked.length}`
                  : `Começar o envio (${picked.length})`
                : official
                  ? whatsapp.isSending
                    ? "Enviando..."
                    : "Enviar"
                  : "Abrir no WhatsApp"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

/** Mensagem avulsa para um aluno, pelo WhatsApp do proprio espaco. */
export function SendMessageDialog({
  open,
  onOpenChange,
  recipient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aluno fixo (ficha do aluno). */
  recipient?: MessageRecipient;
}) {
  const whatsapp = useWhatsAppSend();
  const present = useDialogPresence(open);
  const [sequence, setSequence] = useState<ReminderGroup | null>(null);
  return (
    <>
      <ReminderSequenceDialog
        group={sequence}
        open={sequence !== null}
        onOpenChange={(next) => {
          if (!next) setSequence(null);
        }}
      />
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
            <SheetTitle className="text-lg font-semibold text-foreground">
              {recipient ? `Mensagem para ${recipient.name}` : "Nova mensagem"}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {whatsapp.mode === "official"
                ? "Sai pelo WhatsApp oficial do espaço."
                : "Abre o WhatsApp deste aparelho com a mensagem pronta."}
            </SheetDescription>
          </SheetHeader>
          {present ? (
            <SendMessageForm
              onDone={() => onOpenChange(false)}
              onSequence={setSequence}
              fixed={recipient}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
