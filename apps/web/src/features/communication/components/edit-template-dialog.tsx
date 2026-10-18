"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import type { MessageTemplate } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fillMessage, isManualTrigger } from "@/lib/whatsapp";
import { useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { useUpdateTemplate } from "../hooks/use-communication";
import { TRIGGER_META, automationTiming, sampleValues } from "../message-meta";
import { MessageBubble } from "./message-bubble";

/** Nome amigavel de cada variavel (o texto usa a forma {chave}). */
const VARIABLE_LABELS: Record<string, string> = {
  "{aluno}": "Nome do aluno",
  "{empresa}": "Nome do espaço",
  "{valor}": "Valor",
  "{vencimento}": "Vencimento",
  "{link_pagamento}": "Link de pagamento",
  "{link_app}": "Link do app",
  "{referencia}": "O que é cobrado",
  "{pacote}": "Nome do pacote",
  "{restante}": "Aulas e validade",
  "{nivel}": "Novo nível",
};

function EditTemplateForm({
  template,
  official,
  onClose,
}: {
  template: MessageTemplate;
  official: boolean;
  onClose: () => void;
}) {
  const updateMut = useUpdateTemplate();
  const { data: organization } = useOrganization();
  const hasFeature = useHasFeature();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(template.content);
  const [enabled, setEnabled] = useState(template.enabled);
  const [sendHour, setSendHour] = useState(template.sendHour);
  // Modelo so de envio manual: sem envio automatico nem horario.
  const automatic = official && !isManualTrigger(template.trigger);

  // Insere a variavel onde esta o cursor (ou no fim).
  function insertVariable(variable: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${variable}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  async function save() {
    if (!content.trim()) {
      toast.error("Escreva o texto da mensagem.");
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: template.id,
        content,
        ...(automatic ? { enabled, sendHour } : {}),
      });
      toast.success("Mensagem salva.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar a mensagem."));
    }
  }

  const preview = fillMessage(content, sampleValues(organization?.name, hasFeature("online_payments")));

  return (
    <>
      <DialogBody className="space-y-4">
        {automatic ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              Envio automático
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="template-hour" className="text-sm">
                Horário
              </Label>
              <Input
                id="template-hour"
                type="time"
                value={sendHour}
                onChange={(e) => setSendHour(e.target.value)}
                className="h-8 w-28 text-base md:text-sm"
              />
            </div>
            <p className="basis-full text-xs text-muted-foreground">{automationTiming(template)}.</p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="template-content" className="text-sm">
            Texto<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Textarea
            id="template-content"
            ref={textareaRef}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="text-base leading-relaxed md:text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {template.availableVariables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                + {VARIABLE_LABELS[v] ?? v}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Frase com informação que o sistema não tem (como o link de pagamento sem cobrança online) sai da mensagem.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Como o aluno recebe</p>
          <MessageBubble text={preview} />
        </div>
      </DialogBody>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={updateMut.isPending}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void save()} disabled={updateMut.isPending}>
          {updateMut.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </>
  );
}

export function EditTemplateDialog({
  template,
  official,
  open,
  onOpenChange,
}: {
  template: MessageTemplate | null;
  official: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>{template ? TRIGGER_META[template.trigger].label : "Mensagem"}</DialogTitle>
          <DialogDescription>
            {template
              ? official && !isManualTrigger(template.trigger)
                ? automationTiming(template)
                : TRIGGER_META[template.trigger].where
              : ""}
          </DialogDescription>
        </DialogHeader>
        {template ? (
          <EditTemplateForm
            key={template.id}
            template={template}
            official={official}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
