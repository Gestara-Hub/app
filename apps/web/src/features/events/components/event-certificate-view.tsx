"use client";

import { useEffect } from "react";
import { Award, Ban, FileText, Printer } from "lucide-react";
import { isApiError, type EventCertificateDocument } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { formatDateTime } from "@gestarahub/core/format";
import { BackLink } from "@/components/shared/back-link";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseOrganization } from "@/lib/session";
import { toast } from "@/lib/toast";
import { useCan, useCurrentUser } from "@/features/auth";
import { CertificateSheet, useStoredFileUrl } from "@/features/certificates";
import { useCancelEventCertificate, useEventCertificate, useIssueEventCertificates } from "../hooks/use-events";

/**
 * Certificado de participacao em evento (doc product/29, fase 5, Plano
 * Profissional): mesma folha, modelo e codigo de verificacao do certificado de
 * curso. Na conta real o PDF sai do servidor; na demonstracao, pela impressao.
 */

export const EVENT_CERTIFICATE_LOCKED_HINT = "Faz parte do Plano Profissional. Imprima ou salve em PDF quando o evento terminar.";

export function EventCertificateLocked({ eventId, canManagePlan }: { eventId: string; canManagePlan: boolean }) {
  return (
    <div className="space-y-4">
      <BackLink fallbackHref={`/events/${eventId}`} className="mb-0" />
      <FeatureLocked
        title="Certificado de participação"
        description={EVENT_CERTIFICATE_LOCKED_HINT}
        icon={<Award className="size-7" aria-hidden />}
        canManagePlan={canManagePlan}
      />
    </div>
  );
}

function TemplateSheet({ sheet }: { sheet: EventCertificateDocument }) {
  const logoUrl = useStoredFileUrl(sheet.template.logoFileId);
  const artworkUrl = useStoredFileUrl(sheet.template.layout === "custom" ? sheet.template.artwork?.fileId : undefined);
  return <CertificateSheet certificate={sheet.certificate} template={sheet.template} logoUrl={logoUrl} artworkUrl={artworkUrl} className="mx-auto max-w-4xl print:max-w-none" />;
}

/** Certificado de um inscrito. */
export function EventCertificateView({ eventId, registrationId }: { eventId: string; registrationId: string }) {
  const can = useCan();
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const { data: sheet, isPending, error } = useEventCertificate(registrationId);
  const cancel = useCancelEventCertificate();
  const { confirm, dialog } = useConfirmAction();
  const canceled = sheet?.issued.status === "canceled";

  async function cancelCertificate() {
    const ok = await confirm({
      title: "Cancelar o certificado?",
      description: `A página de verificação passa a dizer que o certificado ${sheet?.issued.code} não vale. Não dá para desfazer.`,
      confirmLabel: "Cancelar certificado",
      cancelLabel: "Voltar",
      variant: "destructive",
    });
    if (!ok) return;
    cancel.mutate(registrationId, {
      onSuccess: () => toast.success("Certificado cancelado."),
      onError: (err) => toast.error(getErrorMessage(err, "Não foi possível cancelar o certificado.")),
    });
  }

  if (isApiError(error) && error.code === "FEATURE_NOT_IN_PLAN") {
    return <EventCertificateLocked eventId={eventId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink fallbackHref={`/events/${eventId}`} className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          {sheet && !canceled && can("events:manage") ? (
            <Button type="button" variant="outline" className="gap-1.5" disabled={cancel.isPending} onClick={() => void cancelCertificate()}>
              <Ban className="size-4" />
              Cancelar certificado
            </Button>
          ) : null}
          {sheet && !canceled && serverDocuments ? (
            <Button asChild className="gap-1.5">
              <a href={`/api/documents/certificates/event-registration/${registrationId}`} target="_blank" rel="noopener">
                <FileText className="size-4" />
                Baixar PDF
              </a>
            </Button>
          ) : sheet && !canceled ? (
            <Button type="button" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-4" />
              Imprimir ou salvar em PDF
            </Button>
          ) : null}
        </div>
      </div>
      {sheet && canceled ? (
        <p role="status" className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-400 print:hidden">
          Certificado cancelado{sheet.issued.canceledAt ? ` em ${formatDateTime(sheet.issued.canceledAt)}` : ""}. A página de verificação diz que ele não vale.
        </p>
      ) : sheet ? (
        <p className="text-xs text-muted-foreground print:hidden">
          Código de verificação {sheet.issued.code}, emitido em {formatDateTime(sheet.issued.issuedAt)}. Quem recebe confere pelo QR ou pelo endereço do rodapé.
        </p>
      ) : null}
      {isPending ? (
        <Skeleton className="mx-auto aspect-[297/210] w-full max-w-4xl rounded-md" />
      ) : sheet ? (
        <TemplateSheet sheet={sheet} />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          {getErrorMessage(error, "Não foi possível carregar o certificado.")}
        </p>
      )}
    </div>
  );
}

/** Certificados de todos os presentes do evento, um por folha, para imprimir. Abrir emite quem ainda nao tinha. */
export function EventCertificatesView({ eventId }: { eventId: string }) {
  const can = useCan();
  const issue = useIssueEventCertificates();
  const { mutate } = issue;
  useEffect(() => {
    mutate(eventId);
  }, [mutate, eventId]);
  const batch = issue.data;
  const template = batch?.template;
  const logoUrl = useStoredFileUrl(template?.logoFileId);
  const artworkUrl = useStoredFileUrl(template?.layout === "custom" ? template.artwork?.fileId : undefined);
  const valid = batch?.items.filter((item) => item.issued.status === "valid") ?? [];

  if (isApiError(issue.error) && issue.error.code === "FEATURE_NOT_IN_PLAN") {
    return <EventCertificateLocked eventId={eventId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } .certificate-page { break-after: page; } }"}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink fallbackHref={`/events/${eventId}`} className="mb-0" />
        {valid.length > 0 ? (
          <Button type="button" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir ou salvar em PDF
          </Button>
        ) : null}
      </div>
      {issue.isPending || (!batch && !issue.error) ? (
        <Skeleton className="mx-auto aspect-[297/210] w-full max-w-4xl rounded-md" />
      ) : issue.error ? (
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          {getErrorMessage(issue.error, "Não foi possível emitir os certificados.")}
        </p>
      ) : batch && valid.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">Ninguém com presença neste evento.</p>
      ) : batch && template ? (
        <>
          <p className="text-xs text-muted-foreground print:hidden">
            {valid.length === 1 ? "1 certificado" : `${valid.length} certificados`} de {batch.eventName}. Cada um tem o próprio código de verificação.
          </p>
          <div className="space-y-6 print:space-y-0">
            {valid.map((item) => (
              <div key={item.certificate.enrollmentId} className="certificate-page">
                <CertificateSheet certificate={item.certificate} template={template} logoUrl={logoUrl} artworkUrl={artworkUrl} className="mx-auto max-w-4xl print:max-w-none" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
