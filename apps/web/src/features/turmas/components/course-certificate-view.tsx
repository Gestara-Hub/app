"use client";

import Link from "next/link";
import { Award, ChevronLeft, FileText, Printer } from "lucide-react";
import { isApiError, type CourseCertificateDocument } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { isSupabaseOrganization } from "@/lib/session";
import { useCan, useCurrentUser } from "@/features/auth";
import { CertificateSheet, useStoredFileUrl } from "@/features/certificates";
import { useCourseCertificate } from "../hooks/use-turmas";

/** Texto da tela de upsell (uma linha, como os outros recursos do Pro). */
export const CERTIFICATE_LOCKED_HINT = "Faz parte do Plano Profissional. Imprima ou salve em PDF no fim do curso.";

function BackLink({ classGroupId }: { classGroupId: string }) {
  return (
    <Button variant="ghost" className="-ml-2 gap-1" asChild>
      <Link href={`/classes/${classGroupId}`}>
        <ChevronLeft className="size-4" />
        Voltar à turma
      </Link>
    </Button>
  );
}

/** Upsell do certificado (plano sem o recurso `certificates`). */
export function CourseCertificateLocked({
  classGroupId,
  canManagePlan,
}: {
  classGroupId: string;
  canManagePlan: boolean;
}) {
  return (
    <div className="space-y-4">
      <BackLink classGroupId={classGroupId} />
      <FeatureLocked
        title="Certificado de conclusão"
        description={CERTIFICATE_LOCKED_HINT}
        icon={<Award className="size-7" aria-hidden />}
        canManagePlan={canManagePlan}
      />
    </div>
  );
}

/** Folha com o modelo do espaco (layout, cor, logo e texto). */
function TemplateCertificateSheet({ sheet }: { sheet: CourseCertificateDocument }) {
  const logoUrl = useStoredFileUrl(sheet.template.logoFileId);
  return (
    <CertificateSheet
      certificate={sheet.certificate}
      template={sheet.template}
      logoUrl={logoUrl}
      className="mx-auto max-w-4xl print:max-w-none"
    />
  );
}

/**
 * Certificado de conclusao do curso: na conta real o PDF sai do servidor
 * (mesmo modelo da folha); na demonstracao, pela impressao do navegador.
 */
export function CourseCertificateView({
  classGroupId,
  enrollmentId,
}: {
  classGroupId: string;
  enrollmentId: string;
}) {
  const can = useCan();
  // Conta real: o PDF sai do servidor; na demonstracao, pela impressao do navegador.
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const { data: sheet, isPending, error } = useCourseCertificate(enrollmentId);

  if (isApiError(error) && error.code === "FEATURE_NOT_IN_PLAN") {
    return <CourseCertificateLocked classGroupId={classGroupId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      {/* Folha deitada (A4); a margem da impressao fica fora da folha. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink classGroupId={classGroupId} />
        {sheet && serverDocuments ? (
          <Button asChild className="gap-1.5">
            <a href={`/api/documents/certificates/${enrollmentId}`} target="_blank" rel="noopener">
              <FileText className="size-4" />
              Baixar PDF
            </a>
          </Button>
        ) : sheet ? (
          <Button type="button" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir ou salvar em PDF
          </Button>
        ) : null}
      </div>
      {isPending ? (
        <Skeleton className="mx-auto aspect-[297/210] w-full max-w-4xl rounded-md" />
      ) : sheet ? (
        <TemplateCertificateSheet sheet={sheet} />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          {getErrorMessage(error, "Não foi possível carregar o certificado.")}
        </p>
      )}
    </div>
  );
}
