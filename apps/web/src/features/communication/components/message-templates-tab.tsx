"use client";

import { useState } from "react";
import { HeartHandshake, Megaphone, MessageSquare, Pencil, Wallet } from "lucide-react";
import { toast } from "@/lib/toast";
import type { MessageTemplate, MetaTemplateStatus } from "@gestarahub/contracts";
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
import { TRIGGER_META, TRIGGER_ORDER, automationTiming, sampleValues, templatePreview } from "../message-meta";
import { EditTemplateDialog } from "./edit-template-dialog";
import { MessageBubble } from "./message-bubble";

function MetaStatusBadge({ status }: { status?: MetaTemplateStatus }) {
  if (!status) return null;

  if (status === "APPROVED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Aprovado na Meta
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Modelo oficial aprovado pela Meta. Disparos automáticos liberados 24h para qualquer aluno.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "PENDING") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Em análise na Meta
          </span>
        </TooltipTrigger>
        <TooltipContent>
          A Meta está revisando este modelo. A aprovação costuma levar alguns minutos.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "REJECTED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-destructive/30 bg-destructive/10 text-destructive">
            <span className="size-1.5 rounded-full bg-destructive" />
            Recusado na Meta
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Este modelo não foi aprovado pela Meta. Edite o texto para reavaliar.
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

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
  const automatic = official && !isManualTrigger(template.trigger);

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
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 sm:p-3.5 transition-colors space-y-2.5",
        automatic && !template.enabled && "opacity-75",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{meta.label}</p>
            {official ? <MetaStatusBadge status={template.metaStatus} /> : null}
          </div>
          <p className="text-xs text-muted-foreground">{automatic ? automationTiming(template) : meta.where}</p>
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

          {canManage ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onEdit}
                  aria-label="Editar texto"
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar texto</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar texto</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {showPreview ? (
        <div className="pt-1 border-t border-border/40">
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
                <AccordionTrigger className="py-3.5 hover:no-underline cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0 pr-2 text-left">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <group.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {group.title}
                        </h3>
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
