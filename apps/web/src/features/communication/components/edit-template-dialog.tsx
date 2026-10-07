"use client";

import { useState } from "react";
import type { MessageTemplate } from "@gestarahub/contracts";
import { Check, Clock, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUpdateTemplate } from "../hooks/use-communication";

interface EditTemplateDialogProps {
  template: MessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditTemplateForm({
  template,
  onClose,
}: {
  template: MessageTemplate;
  onClose: () => void;
}) {
  const updateMutation = useUpdateTemplate();

  const [enabled, setEnabled] = useState(template.enabled);
  const [sendHour, setSendHour] = useState(template.sendHour);
  const [content, setContent] = useState(template.content);
  const daysOffset = template.daysOffset;

  const insertVariable = (variable: string) => {
    setContent((prev) => `${prev} ${variable} `);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("O conteúdo da mensagem não pode ficar vazio.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: template.id,
        enabled,
        sendHour,
        daysOffset,
        content: content.trim(),
      });

      toast.success(`As configurações de "${template.title}" foram salvas.`);
      onClose();
    } catch {
      toast.error("Não foi possível atualizar a regra. Tente novamente.");
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {template.category === "billing" ? "Cobrança" : "Relacionamento"}
          </Badge>
          <DialogTitle className="text-lg">{template.title}</DialogTitle>
        </div>
        <DialogDescription>{template.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        {/* Status e Horário */}
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="template-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="template-enabled" className="cursor-pointer font-medium">
              {enabled ? "Disparo Automático Ativo" : "Disparo Pausado"}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <Label htmlFor="send-hour" className="text-xs text-muted-foreground whitespace-nowrap">
              Horário de Envio:
            </Label>
            <Input
              id="send-hour"
              type="time"
              value={sendHour}
              onChange={(e) => setSendHour(e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
        </div>

        {/* Variáveis Dinâmicas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Variáveis Dinâmicas Disponíveis
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Clique para inserir no texto
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {template.availableVariables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-mono text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="size-3" />
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Editor de Texto */}
        <div className="space-y-2">
          <Label htmlFor="template-content" className="font-medium">
            Texto da Mensagem no WhatsApp
          </Label>
          <Textarea
            id="template-content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite o texto da mensagem..."
            className="font-sans leading-relaxed resize-y"
          />
          <p className="text-[11px] text-muted-foreground">
            Emojis e quebras de linha são suportados e enviados com fidelidade pelo WhatsApp.
          </p>
        </div>

        {/* Prévia do Balão de WhatsApp */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            Prévia Visual do Aluno
          </Label>
          <div className="rounded-xl border bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
            <div className="max-w-md rounded-2xl rounded-tl-none bg-white p-3.5 text-sm shadow-xs border border-emerald-100/80 dark:border-emerald-900/50 dark:bg-zinc-900">
              <p className="whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                {content
                  .replace("{aluno}", "Gabriel Silva")
                  .replace("{valor}", "R$ 180,00")
                  .replace("{vencimento}", "10/10/2026")
                  .replace("{empresa}", "Gestara Academy")
                  .replace("{link_pagamento}", "https://pay.gestarahub.com/c/demo")
                  .replace("{link_app}", "https://app.gestarahub.com/login")}
              </p>
              <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                <span>{sendHour}</span>
                <div className="flex text-emerald-500">
                  <Check className="size-3" />
                  <Check className="-ml-1.5 size-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditTemplateDialog({
  template,
  open,
  onOpenChange,
}: EditTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        {template ? (
          <EditTemplateForm
            key={template.id}
            template={template}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
