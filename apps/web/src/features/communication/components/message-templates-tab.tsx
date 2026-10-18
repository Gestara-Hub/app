"use client";

import { useState } from "react";
import { HeartHandshake, Megaphone, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { MessageTemplate } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fillMessage, isManualTrigger } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { useCan, useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { useMessageTemplates, useUpdateTemplate, useWhatsAppConnection } from "../hooks/use-communication";
import { TRIGGER_META, TRIGGER_ORDER, automationTiming, sampleValues } from "../message-meta";
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
  const updateMut = useUpdateTemplate();
  const meta = TRIGGER_META[template.trigger];
  const preview = fillMessage(template.content, sampleValues(orgName, withPaymentLink));
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
    <div className={cn("space-y-3 rounded-xl border bg-card p-4", automatic && !template.enabled && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{automatic ? automationTiming(template) : meta.where}</p>
        </div>
        {automatic ? (
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            Automático
            <Switch
              checked={template.enabled}
              disabled={!canManage || updateMut.isPending}
              onCheckedChange={toggle}
              aria-label={`Envio automático: ${meta.label}`}
            />
          </label>
        ) : null}
      </div>
      <MessageBubble text={preview} />
      {canManage ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" className="gap-1.5 text-xs" onClick={onEdit}>
            <Pencil className="size-3" />
            Editar texto
          </Button>
        </div>
      ) : null}
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
 * Textos das mensagens. No envio assistido mostra onde cada botao aparece; no
 * WhatsApp oficial, quando sai sozinho e o interruptor de envio automatico.
 */
export function MessageTemplatesTab() {
  const { data: templates, isPending } = useMessageTemplates();
  const { data: connection } = useWhatsAppConnection();
  const { data: organization } = useOrganization();
  const hasFeature = useHasFeature();
  const canManage = useCan()("communication:manage");
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const official = connection?.mode === "official";
  const withPaymentLink = hasFeature("online_payments");

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const items = (templates ?? [])
          .filter((t) => t.category === group.category)
          .sort((a, b) => TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger));
        if (items.length === 0) return null;
        return (
          <section key={group.category} className="space-y-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <group.icon className="size-4 text-muted-foreground" />
                {group.title}
              </h3>
              <p className="text-xs text-muted-foreground">{group.hint}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
          </section>
        );
      })}

      <EditTemplateDialog
        template={editing}
        official={official}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
