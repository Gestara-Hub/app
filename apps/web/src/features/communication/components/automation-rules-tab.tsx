"use client";

import { useState } from "react";
import type { MessageTemplate } from "@gestarahub/contracts";
import {
  AlertCircle,
  BellRing,
  CalendarCheck,
  Check,
  Clock,
  HeartHandshake,
  MessageCircle,
  Pencil,
  ShieldAlert,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMessageTemplates, useUpdateTemplate } from "../hooks/use-communication";
import { EditTemplateDialog } from "./edit-template-dialog";

export function AutomationRulesTab() {
  const { data: templates = [], isLoading } = useMessageTemplates();
  const updateMutation = useUpdateTemplate();
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const handleToggle = async (template: MessageTemplate, nextEnabled: boolean) => {
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        enabled: nextEnabled,
      });
      toast.success(
        nextEnabled
          ? `Regra "${template.title}" ativada.`
          : `Regra "${template.title}" pausada.`,
      );
    } catch {
      toast.error("Não foi possível alterar o status da automação.");
    }
  };

  const billingTemplates = templates.filter((t) => t.category === "billing");
  const retentionTemplates = templates.filter((t) => t.category === "retention");

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case "billing_before_due":
        return <BellRing className="size-4 text-sky-500" />;
      case "billing_due_date":
        return <CalendarCheck className="size-4 text-emerald-500" />;
      case "billing_after_due":
        return <AlertCircle className="size-4 text-amber-500" />;
      case "billing_critical":
        return <ShieldAlert className="size-4 text-rose-500" />;
      case "welcome_student":
        return <UserPlus className="size-4 text-indigo-500" />;
      case "absence_alert":
        return <HeartHandshake className="size-4 text-purple-500" />;
      case "birthday_greeting":
        return <Sparkles className="size-4 text-amber-500" />;
      default:
        return <MessageCircle className="size-4 text-primary" />;
    }
  };

  const getOffsetLabel = (offset: number, trigger: string) => {
    if (trigger === "welcome_student") return "Imediato na matrícula";
    if (trigger === "birthday_greeting") return "No dia do aniversário";
    if (offset < 0) return `${Math.abs(offset)} dias antes do vencimento`;
    if (offset === 0) return "No dia do vencimento";
    if (trigger === "absence_alert") return `${offset} dias sem treinar`;
    return `${offset} dias após o vencimento`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted/30" />
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Bloco 1: Régua de Cobrança Automática */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <BellRing className="size-4 text-primary" />
              Régua de Cobrança Automática
            </h3>
            <p className="text-xs text-muted-foreground">
              Reduza a inadimplência com lembretes inteligentes antes, no dia e após o vencimento com Pix Copia e Cola.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit text-xs font-normal">
            {billingTemplates.filter((t) => t.enabled).length} de {billingTemplates.length} ativas
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {billingTemplates.map((template) => (
            <Card
              key={template.id}
              className={`transition-all duration-200 ${
                template.enabled
                  ? "border-primary/20 shadow-xs"
                  : "opacity-75 bg-muted/20"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-lg border bg-background p-1.5 shadow-2xs">
                      {getTriggerIcon(template.trigger)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {template.title}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-1 mt-0.5">
                        {getOffsetLabel(template.daysOffset, template.trigger)}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={template.enabled}
                    onCheckedChange={(checked) => handleToggle(template, checked)}
                    aria-label={`Ativar ou desativar ${template.title}`}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Visual WhatsApp Bubble Preview */}
                <div className="rounded-lg border bg-emerald-50/40 p-3 text-xs dark:bg-emerald-950/15">
                  <div className="rounded-lg rounded-tl-none border border-emerald-100/80 bg-white p-2.5 shadow-2xs dark:border-emerald-900/40 dark:bg-zinc-900">
                    <p className="line-clamp-3 whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
                      {template.content
                        .replace("{aluno}", "Gabriel Silva")
                        .replace("{valor}", "R$ 180,00")
                        .replace("{vencimento}", "10/10/2026")
                        .replace("{empresa}", "Gestara Academy")
                        .replace("{link_pagamento}", "https://pay.gestarahub.com/c/...")}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-zinc-400">
                      <span>{template.sendHour}</span>
                      <div className="flex text-emerald-500">
                        <Check className="size-2.5" />
                        <Check className="-ml-1 size-2.5" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Envio às {template.sendHour}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Pencil className="size-3" />
                    Personalizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bloco 2: Retenção & Relacionamento */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HeartHandshake className="size-4 text-purple-500" />
              Retenção, Boas-Vindas & Anti-Evasão
            </h3>
            <p className="text-xs text-muted-foreground">
              Acolha novos alunos, recupere alunos que pararam de frequentar e fortaleça o vínculo com o tatame.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit text-xs font-normal">
            {retentionTemplates.filter((t) => t.enabled).length} de {retentionTemplates.length} ativas
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {retentionTemplates.map((template) => (
            <Card
              key={template.id}
              className={`transition-all duration-200 ${
                template.enabled
                  ? "border-primary/20 shadow-xs"
                  : "opacity-75 bg-muted/20"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-lg border bg-background p-1.5 shadow-2xs">
                      {getTriggerIcon(template.trigger)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {template.title}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-1 mt-0.5">
                        {getOffsetLabel(template.daysOffset, template.trigger)}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={template.enabled}
                    onCheckedChange={(checked) => handleToggle(template, checked)}
                    aria-label={`Ativar ou desativar ${template.title}`}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="rounded-lg border bg-purple-50/40 p-3 text-xs dark:bg-purple-950/15">
                  <div className="rounded-lg rounded-tl-none border border-purple-100/80 bg-white p-2.5 shadow-2xs dark:border-purple-900/40 dark:bg-zinc-900">
                    <p className="line-clamp-3 whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
                      {template.content
                        .replace("{aluno}", "Gabriel Silva")
                        .replace("{empresa}", "Gestara Academy")
                        .replace("{link_app}", "https://app.gestarahub.com")}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-zinc-400">
                      <span>{template.sendHour}</span>
                      <div className="flex text-purple-500">
                        <Check className="size-2.5" />
                        <Check className="-ml-1 size-2.5" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Envio às {template.sendHour}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Pencil className="size-3" />
                    Personalizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <EditTemplateDialog
        template={editingTemplate}
        open={Boolean(editingTemplate)}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null);
        }}
      />
    </div>
  );
}
