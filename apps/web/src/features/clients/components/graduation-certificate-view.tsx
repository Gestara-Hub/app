"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasPreviousRoute } from "@/lib/navigation-history";
import { Award, Ban, ChevronLeft, FileText, Printer } from "lucide-react";
import { toast } from "@/lib/toast";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { formatDateTime } from "@gestarahub/core/format";
import { isApiError, type GraduationCertificateDocument } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { isSupabaseOrganization } from "@/lib/session";
import { useCan, useCurrentUser } from "@/features/auth";
import { CertificateSheet, useStoredFileUrl } from "@/features/certificates";
import { useCancelGraduationCertificate, useGraduationCertificate } from "../hooks/use-clients";

/** Texto da tela de upsell (uma linha, como os outros recursos do Pro). */
export const GRADUATION_CERTIFICATE_LOCKED_HINT = "Faz parte do Plano Profissional. Imprima ou salve em PDF a cada graduação.";

/** Volta para a tela anterior (a ficha ou o dialogo de graduacao); aberto direto, vai para a ficha. Um link novo fazia a ficha voltar para ca em laco. */
function BackLink({ studentId }: { studentId: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" className="-ml-2 gap-1" asChild>
      <Link
        href={`/clients/${studentId}?tab=evolution`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || !hasPreviousRoute()) return;
          event.preventDefault();
          router.back();
        }}
      >
        <ChevronLeft className="size-4" />
        Voltar à ficha
      </Link>
    </Button>
  );
}

/** Upsell do certificado de graduacao (plano sem o recurso `certificates`). */
export function GraduationCertificateLocked({ studentId, canManagePlan }: { studentId: string; canManagePlan: boolean }) {
  return (
    <div className="space-y-4">
      <BackLink studentId={studentId} />
      <FeatureLocked
        title="Certificado de graduação"
        description={GRADUATION_CERTIFICATE_LOCKED_HINT}
        icon={<Award className="size-7" aria-hidden />}
        canManagePlan={canManagePlan}
      />
    </div>
  );
}

/** Folha com o modelo de graduacao do espaco ou da modalidade. */
function TemplateSheet({ sheet }: { sheet: GraduationCertificateDocument }) {
  const logoUrl = useStoredFileUrl(sheet.template.logoFileId);
  const artworkUrl = useStoredFileUrl(sheet.template.layout === "custom" ? sheet.template.artwork?.fileId : undefined);
  return (
    <CertificateSheet
      certificate={sheet.certificate}
      template={sheet.template}
      logoUrl={logoUrl}
      artworkUrl={artworkUrl}
      className="mx-auto max-w-4xl print:max-w-none"
    />
  );
}

/**
 * Certificado de graduacao (doc 21 §1.6): abrir emite; na conta real o PDF sai
 * do servidor, na demonstracao pela impressao do navegador. Igual ao de curso.
 */
export function GraduationCertificateView({ studentId, promotionId }: { studentId: string; promotionId: string }) {
  const can = useCan();
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const { data: sheet, isPending, error } = useGraduationCertificate(studentId, promotionId);
  const cancel = useCancelGraduationCertificate();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
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
    cancel.mutate(
      { studentId, promotionId },
      {
        onSuccess: () => toast.success("Certificado cancelado."),
        onError: (err) => toast.error(getErrorMessage(err, "Não foi possível cancelar o certificado.")),
      },
    );
  }

  if (isApiError(error) && error.code === "FEATURE_NOT_IN_PLAN") {
    return <GraduationCertificateLocked studentId={studentId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink studentId={studentId} />
        <div className="flex flex-wrap items-center gap-2">
          {sheet && !canceled && can("progression:manage") ? (
            <Button type="button" variant="outline" className="gap-1.5" disabled={cancel.isPending} onClick={() => void cancelCertificate()}>
              <Ban className="size-4" />
              Cancelar certificado
            </Button>
          ) : null}
          {sheet && !canceled && serverDocuments ? (
            <Button asChild className="gap-1.5">
              <a href={`/api/documents/certificates/graduation/${studentId}/${promotionId}`} target="_blank" rel="noopener">
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
