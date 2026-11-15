"use client";

import { useState } from "react";
import { HeartHandshake, Megaphone, MessageSquare, SlidersHorizontal, Wallet } from "lucide-react";
import { toast } from "@/lib/toast";
import type { MessageTemplate } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fillMessage, isManualTrigger } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { useMessageTemplates, useUpdateTemplate, useWhatsAppConnection } from "../hooks/use-communication";
import { TRIGGER_META, TRIGGER_ORDER, metaStatusNotice, sampleValues, templatePreview, templateSubtitle } from "../message-meta";

const NOTICE_TONE = {
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-destructive",
} as const;
import { EditTemplateDialog } from "./edit-template-dialog";
import { MessageBubble } from "./message-bubble";

function TemplateCard({
  template,
  official,
  orgName,
  withPaymentLink,
  canManage,
  onEdit,
}: {
  template: MessageTemplate;
  official: boolean;
  orgName?: string;
  withPaymentLink: boolean;
  /** `communication:manage`: editar o texto e ligar/desligar o automatico. */
  canManage: boolean;
  onEdit: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const updateMut = useUpdateTemplate();
  const meta = TRIGGER_META[template.trigger];
  const preview = templatePreview(template.trigger, fillMessage(template.content, sampleValues(orgName, withPaymentLink)));
  // Modelo so de envio manual: sem interruptor nem prazo, nem no oficial.
  const manual = isManualTrigger(template.trigger);
  const automatic = official && !manual;
  const notice = official ? metaStatusNotice(template.metaStatus) : null;

  function toggle(enabled: boolean) {
    updateMut.mutate(
      { id: template.id, enabled },
      {
        onSuccess: () => toast.success(enabled ? "Envio automático ligado." : "Envio automático desligado."),
        onError: (err) => toast.error(getErrorMessage(err, "Não foi possível alterar o envio automático.")),
      },
    );
  }

  return (
    // Um grupo com o nome do modelo: leitor de tela anuncia o cartao, e os testes
    // acham o cartao certo dentro da sanfona (que tambem e um cartao arredondado).
    <div
      role="group"
      aria-label={meta.label}
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 sm:p-3.5 transition-colors",
        automatic && !template.enabled && "opacity-75",
      )}
    >
      {/* Celular: os dois icones cabem ao lado do nome; o automatico (com a chave) desce. */}
      <div
        className={cn(
          "flex gap-2",
          automatic ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-start justify-between sm:items-center",
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground break-words">
            {templateSubtitle(template, official)}
            {notice ? (
              <>
                {" · "}
                {/* So o que pede atencao: aprovado e o normal e nao aparece. */}
                {notice.needsEdit && canManage ? (
                  <button
                    type="button"
                    onClick={onEdit}
                    title={notice.hint}
                    className={cn("font-medium underline-offset-2 hover:underline", NOTICE_TONE[notice.tone])}
                  >
                    {notice.text}
                  </button>
                ) : (
                  <span title={notice.hint} className={cn("font-medium", NOTICE_TONE[notice.tone])}>
                    {notice.text}
                  </span>
                )}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {automatic ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground mr-1.5">
              Automático
              <Switch
                checked={template.enabled}
                disabled={!canManage || updateMut.isPending}
                onCheckedChange={toggle}
                aria-label={`Envio automático: ${meta.label}`}
              />
            </label>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={showPreview ? "secondary" : "ghost"}
                size="icon-sm"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  showPreview && "bg-muted text-foreground",
                )}
                onClick={() => setShowPreview((prev) => !prev)}
                aria-label={showPreview ? "Ocultar exemplo" : "Ver exemplo"}
                aria-expanded={showPreview}
              >
                <MessageSquare className="size-4" />
                <span className="sr-only">{showPreview ? "Ocultar exemplo" : "Ver exemplo"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showPreview ? "Ocultar exemplo" : "Ver exemplo"}</TooltipContent>
          </Tooltip>

          {canManage && !manual ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onEdit}
                  aria-label="Configurar modelo"
                >
                  <SlidersHorizontal className="size-4" />
                  <span className="sr-only">Configurar modelo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Configurar modelo</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {showPreview ? (
        <div className="mt-2.5 pt-1 border-t border-border/40">
          <MessageBubble text={preview} />
        </div>
      ) : (
        <span className="sr-only">{preview}</span>
      )}
    </div>
  );
}

const GROUPS = [
  {
    category: "billing" as const,
    title: "Cobrança",
    icon: Wallet,
    hint: "Lembretes das cobranças e pagamento recebido.",
  },
  {
    category: "retention" as const,
    title: "Relacionamento",
    icon: HeartHandshake,
    hint: "Boas-vindas, faltas, pacote, aniversário e avanço.",
  },
  {
    category: "administrative" as const,
    title: "Avisos",
    icon: Megaphone,
    hint: "Aula cancelada, mudança de horário e feriado.",
  },
];

/**
 * Textos das mensagens organizados em seções (Accordions).
 * Cada modelo é exibido em linha limpa e escaneável, com exemplo do WhatsApp sob demanda.
 */
export function MessageTemplatesTab() {
  const { data: templates, isPending } = useMessageTemplates();
  const { data: connection } = useWhatsAppConnection();
  const { data: organization } = useOrganization();
  const hasFeature = useHasFeature();
  const canManage = useCan()("communication:manage");
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const official = connection?.mode === "official";
  // Link so quando o espaco cobra online (ligado em Recebimentos online), como no envio.
  const withPaymentLink = hasFeature("online_payments") && Boolean(organization?.settings?.onlinePayments?.enabled);

  if (isPending) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Accordion
          type="multiple"
          defaultValue={["billing", "retention", "administrative"]}
          className="space-y-4"
        >
          {GROUPS.map((group) => {
            const items = (templates ?? [])
              .filter((t) => t.category === group.category)
              .sort((a, b) => TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger));
            if (items.length === 0) return null;

            return (
              <AccordionItem
                key={group.category}
                value={group.category}
                className="rounded-xl border border-border/70 bg-card px-4 sm:px-5 shadow-xs transition-colors overflow-hidden"
              >
                <AccordionTrigger headingLevel={2} className="py-3.5 hover:no-underline cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0 pr-2 text-left">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <group.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm leading-tight">
                          {group.title}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal tabular-nums">
                          ({items.length})
                        </span>
                      </div>
                      <p className="min-w-0 text-xs text-muted-foreground break-words mt-0.5 font-normal">
                        {group.hint}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 border-t border-border/40 mt-1 space-y-2.5">
                  {items.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      official={official}
                      orgName={organization?.name}
                      withPaymentLink={withPaymentLink}
                      canManage={canManage}
                      onEdit={() => setEditing(template)}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <EditTemplateDialog
          template={editing}
          official={official}
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
