"use client";

import { useRetainedValue } from "@/lib/use-retained-value";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import type { MessageTemplate, MessageTrigger } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fillMessage, isManualTrigger } from "@/lib/whatsapp";
import { useHasFeature } from "@/features/auth";
import { useOrganization } from "@/features/settings";
import { useUpdateTemplate, useWhatsAppConnection } from "../hooks/use-communication";
import { TRIGGER_META, automationTiming, sampleValues, templatePreview, templateSubtitle } from "../message-meta";
import { MessageBubble } from "./message-bubble";

const DAYS_OFFSET_CONFIG: Partial<
  Record<
    MessageTrigger,
    { label: string; suffix: string; min: number; max: number; negative?: boolean }
  >
> = {
  billing_before_due: { label: "Prazo", suffix: "dias antes do vencimento", min: 1, max: 30, negative: true },
  charge_reminder: { label: "Prazo", suffix: "dias antes do vencimento", min: 1, max: 30, negative: true },
  billing_after_due: { label: "Prazo", suffix: "dias após o vencimento", min: 1, max: 30 },
  billing_critical: { label: "Prazo", suffix: "dias após o vencimento", min: 2, max: 60 },
  absence_alert: { label: "Prazo", suffix: "faltas seguidas", min: 1, max: 15 },
  package_ending: { label: "Prazo", suffix: "dias antes de vencer", min: 1, max: 30 },
};

function TemplateConfigForm({
  template,
  official,
  onClose,
}: {
  template: MessageTemplate;
  official: boolean;
  onClose: () => void;
}) {
  const updateMut = useUpdateTemplate();
  const { data: connection } = useWhatsAppConnection();
  const { data: organization } = useOrganization();
  const hasFeature = useHasFeature();
  const offsetConfig = DAYS_OFFSET_CONFIG[template.trigger];
  const [enabled, setEnabled] = useState(template.enabled);
  const [sendHour, setSendHour] = useState(template.sendHour);
  const [daysInput, setDaysInput] = useState(() =>
    String(offsetConfig?.negative ? Math.abs(template.daysOffset) : template.daysOffset),
  );

  // Modelo só de envio manual (sem rotina automática nem horário).
  const automatic = official && !isManualTrigger(template.trigger);
  const parsedDays = Number.parseInt(daysInput, 10);
  const isValidDays =
    !offsetConfig || (Number.isInteger(parsedDays) && parsedDays >= offsetConfig.min && parsedDays <= offsetConfig.max);
  const nextDaysOffset = offsetConfig
    ? isValidDays
      ? offsetConfig.negative
        ? -parsedDays
        : parsedDays
      : template.daysOffset
    : template.daysOffset;

  const allowed = connection?.allowedSendHours;
  const outsideAllowedHours = Boolean(
    automatic && enabled && allowed && sendHour && (sendHour < allowed.start || sendHour > allowed.end),
  );

  async function save() {
    if (automatic && offsetConfig && !isValidDays) {
      toast.error(`Informe um prazo entre ${offsetConfig.min} e ${offsetConfig.max} (${offsetConfig.suffix}).`);
      return;
    }
    try {
      if (automatic) {
        await updateMut.mutateAsync({
          id: template.id,
          enabled,
          sendHour,
          ...(offsetConfig ? { daysOffset: nextDaysOffset } : {}),
        });
      }
      toast.success("Configuração da mensagem salva.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar a configuração."));
    }
  }

  const withPaymentLink =
    hasFeature("online_payments") && Boolean(organization?.settings?.onlinePayments?.enabled);
  const preview = templatePreview(
    template.trigger,
    fillMessage(template.content, sampleValues(organization?.name, withPaymentLink)),
  );

  return (
    <>
      <DialogBody className="space-y-4">
        {/* Selo so com a API oficial ligada e o modelo aprovado pela Meta (12/11/2026):
            no envio pelo WhatsApp do celular nada e homologado. */}
        {official && template.metaStatus === "APPROVED" ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-foreground">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Modelo aprovado pelo WhatsApp</p>
              <p className="text-muted-foreground leading-relaxed">
                Texto validado pela Meta: entrega segura e tarifa menor.
              </p>
            </div>
          </div>
        ) : null}

        {/* Configurações operacionais (Envio automático e horário) */}
        {automatic ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="template-enabled" className="text-sm font-medium text-foreground cursor-pointer">
                Envio automático
              </label>
              <Switch
                id="template-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={updateMut.isPending}
              />
            </div>
            {offsetConfig ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                <Label htmlFor="template-days-offset" className="text-sm font-medium text-foreground">
                  {offsetConfig.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="template-days-offset"
                    type="number"
                    min={offsetConfig.min}
                    max={offsetConfig.max}
                    value={daysInput}
                    onChange={(e) => setDaysInput(e.target.value)}
                    disabled={!enabled || updateMut.isPending}
                    className="h-8 w-20 text-base md:text-sm bg-background"
                  />
                  <span className="text-xs text-muted-foreground">{offsetConfig.suffix}</span>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
              <Label htmlFor="template-hour" className="text-sm font-medium text-foreground">
                Horário de envio
              </Label>
              <Input
                id="template-hour"
                type="time"
                value={sendHour}
                onChange={(e) => setSendHour(e.target.value)}
                disabled={!enabled || updateMut.isPending}
                className="h-8 w-28 text-base md:text-sm bg-background"
              />
            </div>
            {outsideAllowedHours ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  Fora do horário permitido em Conexão ({allowed?.start}–{allowed?.end}). O envio automático só dispara dentro dessa janela.
                </span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground pt-0.5">
              {automationTiming({ ...template, daysOffset: nextDaysOffset })}.
            </p>
          </div>
        ) : null}

        {/* Prévia realista do balão de WhatsApp */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Como o aluno recebe</p>
            <span className="text-xs text-muted-foreground">Prévia simulada</span>
          </div>
          <MessageBubble text={preview} />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            As variáveis dinâmicas (como nome do aluno, valores e links seguros) são preenchidas automaticamente no momento do disparo.
          </p>
        </div>
      </DialogBody>

      <DialogFooter className="shrink-0 border-t border-border/40 bg-background p-6 pt-4">
        {automatic ? (
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={updateMut.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={updateMut.isPending}>
              {updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function EditTemplateDialog({
  template: templateProp,
  official,
  open,
  onOpenChange,
}: {
  template: MessageTemplate | null;
  official: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const template = useRetainedValue(templateProp);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {template ? TRIGGER_META[template.trigger].label : "Mensagem"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {template ? templateSubtitle(template, official) : ""}
          </SheetDescription>
        </SheetHeader>
        {template ? (
          <TemplateConfigForm
            key={template.id}
            template={template}
            official={official}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
