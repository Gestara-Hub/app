"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { isApiError } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/features/auth";
import { CertificateSheet, useStoredFileUrl } from "@/features/certificates";
import { useIssueCourseCertificates } from "../hooks/use-turmas";
import { CourseCertificateLocked } from "./course-certificate-view";

/**
 * Certificados de todos os concluidos da turma, um por folha, para imprimir
 * (doc 21 §1.4). Na conta real o PDF sai do servidor; esta tela e o caminho da
 * demonstracao e de quem prefere imprimir. Abrir emite quem ainda nao tinha.
 */
export function ClassCertificatesView({ classGroupId }: { classGroupId: string }) {
  const can = useCan();
  const issue = useIssueCourseCertificates();
  const { mutate } = issue;
  useEffect(() => {
    mutate(classGroupId);
  }, [mutate, classGroupId]);
  const batch = issue.data;
  const template = batch?.template;
  const logoUrl = useStoredFileUrl(template?.logoFileId);
  const artworkUrl = useStoredFileUrl(template?.layout === "custom" ? template.artwork?.fileId : undefined);
  const valid = batch?.items.filter((item) => item.issued.status === "valid") ?? [];

  if (isApiError(issue.error) && issue.error.code === "FEATURE_NOT_IN_PLAN") {
    return <CourseCertificateLocked classGroupId={classGroupId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } .certificate-page { break-after: page; } }"}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink fallbackHref={`/classes/${classGroupId}`} className="mb-0" />
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
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          Nenhum aluno concluído nesta turma.
        </p>
      ) : batch && template ? (
        <>
          <p className="text-xs text-muted-foreground print:hidden">
            {valid.length === 1 ? "1 certificado" : `${valid.length} certificados`} de {batch.className}. Cada um tem o próprio código de verificação.
          </p>
          <div className="space-y-6 print:space-y-0">
            {valid.map((item) => (
              <div key={item.certificate.enrollmentId} className="certificate-page">
                <CertificateSheet
                  certificate={item.certificate}
                  template={template}
                  logoUrl={logoUrl}
                  artworkUrl={artworkUrl}
                  className="mx-auto max-w-4xl print:max-w-none"
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
