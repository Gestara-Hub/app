"use client";

import { useState } from "react";
import {
  AlarmClock,
  AlertTriangle,
  Ban,
  BellRing,
  CalendarClock,
  CalendarX,
  Cake,
  CircleCheck,
  Clock,
  HandHeart,
  type LucideIcon,
  MessageSquare,
  Package,
  PartyPopper,
  Receipt,
  Repeat,
  Siren,
  Ticket,
  TrendingUp,
} from "lucide-react";
import type { MessageTrigger } from "@gestarahub/contracts";
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
import { ListContainer } from "@/components/shared/list";
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

/**
 * Icone de cada mensagem (25/11/2026, lista no padrao de Relatorios): cor so no
 * icone, como nas outras listas. Mensagem nova sem icone cai no balao.
 */
const TRIGGER_ICON: Partial<Record<MessageTrigger, { icon: LucideIcon; color: string }>> = {
  billing_before_due: { icon: CalendarClock, color: "text-sky-500" },
  billing_due_date: { icon: AlarmClock, color: "text-amber-500" },
  billing_after_due: { icon: AlertTriangle, color: "text-orange-500" },
  billing_critical: { icon: Siren, color: "text-rose-500" },
  charge_reminder: { icon: Receipt, color: "text-indigo-500" },
  payment_received: { icon: CircleCheck, color: "text-emerald-500" },
  welcome_student: { icon: PartyPopper, color: "text-violet-500" },
  absence_alert: { icon: HandHeart, color: "text-pink-500" },
  birthday_greeting: { icon: Cake, color: "text-amber-500" },
  package_ending: { icon: Package, color: "text-orange-500" },
  level_up: { icon: TrendingUp, color: "text-teal-500" },
  trial_follow_up: { icon: Repeat, color: "text-sky-500" },
  event_reminder: { icon: Ticket, color: "text-orange-500" },
  class_canceled: { icon: Ban, color: "text-rose-500" },
  schedule_change: { icon: CalendarX, color: "text-indigo-500" },
  holiday_notice: { icon: BellRing, color: "text-amber-500" },
};
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
  const { icon: Icon, color: iconColor } = TRIGGER_ICON[template.trigger] ?? { icon: MessageSquare, color: "text-primary" };
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
    // Uma linha da lista (padrao de Relatorios, 25/11/2026), com o nome do modelo
    // como grupo: o leitor de tela anuncia a linha, e os testes acham a linha certa.
    <div
      role="group"
      aria-label={meta.label}
      className={cn("px-4 py-3.5 sm:px-5 transition-colors", automatic && !template.enabled && "opacity-75")}
    >
      {/* Celular: os dois icones cabem ao lado do nome; o automatico (com a chave) desce. */}
      <div
        className={cn(
          "flex gap-2",
          automatic ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-start justify-between sm:items-center",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-2xs" aria-hidden>
            <Icon className={cn("size-5", iconColor)} />
          </span>
          <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{meta.label}</p>
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

          {/* Antes do "Ver exemplo" (que fica sempre na ponta, alinhado entre as linhas).
              So com o WhatsApp oficial (25/11/2026): o painel ajusta prazo e horario do
              envio automatico; o texto e fixo, e sem o oficial ele so repetia a previa. */}
          {canManage && automatic ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onEdit}
                  aria-label="Prazo e horário"
                >
                  <Clock className="size-4" />
                  <span className="sr-only">Prazo e horário</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Prazo e horário</TooltipContent>
            </Tooltip>
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
        </div>
      </div>

      {showPreview ? (
        // Alinhado com o texto, depois do icone.
        <div className="mt-2.5 pt-1 sm:ml-12">
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
    hint: "Lembretes das cobranças e pagamento recebido.",
  },
  {
    category: "retention" as const,
    title: "Relacionamento",
    hint: "Boas-vindas, faltas, pacote, aniversário e avanço.",
  },
  {
    category: "administrative" as const,
    title: "Avisos",
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

  // Modelos ainda em analise: os automaticos so saem depois que a Meta aprovar (19/11/2026).
  const pendingCount = official ? (templates ?? []).filter((t) => t.metaStatus === "PENDING").length : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {pendingCount > 0 ? (
          <div
            data-testid="templates-pending-notice"
            className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs"
          >
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-foreground">
                {pendingCount === 1
                  ? "1 aviso aguardando aprovação do WhatsApp"
                  : `${pendingCount} avisos aguardando aprovação do WhatsApp`}
              </p>
              <p className="text-muted-foreground">
                Saem sozinhos assim que aprovados, em geral em minutos ou poucas horas. O e-mail de aprovação vem da Meta, dona do WhatsApp.
              </p>
            </div>
          </div>
        ) : null}
        {/* Secoes abertas, uma moldura por secao (padrao de Relatorios, 25/11/2026). */}
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const items = (templates ?? [])
              .filter((t) => t.category === group.category)
              .sort((a, b) => TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger));
            if (items.length === 0) return null;
            const headingId = `templates-group-${group.category}`;

            return (
              <section key={group.category} className="space-y-2" aria-labelledby={headingId}>
                <div>
                  <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
                    {group.title} <span className="tabular-nums">· {items.length}</span>
                  </h2>
                  <p className="min-w-0 break-words text-xs text-muted-foreground">{group.hint}</p>
                </div>
                <ListContainer>
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
                </ListContainer>
              </section>
            );
          })}
        </div>

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
