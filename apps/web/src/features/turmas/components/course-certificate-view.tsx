"use client";

import Link from "next/link";
import { Award, ChevronLeft, Printer } from "lucide-react";
import { isApiError, type CourseCertificate } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { defaultCertificateText } from "@gestarahub/core/certificate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { useCan } from "@/features/auth";
import { useCourseCertificate } from "../hooks/use-turmas";

/** Texto da tela de upsell (uma linha, como os outros recursos do Pro). */
export const CERTIFICATE_LOCKED_HINT = "Certificado de conclusão no Plano Pro.";

function BackLink({ classGroupId }: { classGroupId: string }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1" asChild>
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

/**
 * Modelo padrao do certificado (A4 deitado na impressao). So desenho: os dados
 * vem prontos do servico e o texto de `defaultCertificateText`, para um futuro
 * gerador trocar o modelo sem mexer nos dados.
 */
function DefaultCertificateSheet({ certificate }: { certificate: CourseCertificate }) {
  const text = defaultCertificateText(certificate);
  return (
    <article className="certificate-sheet mx-auto flex aspect-[297/210] w-full max-w-4xl flex-col rounded-md border-4 border-double border-foreground/40 bg-white p-6 text-center text-zinc-900 sm:p-12 print:max-w-none print:rounded-none print:border-zinc-500">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase sm:text-sm">
        {certificate.organizationName}
      </p>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:gap-6">
        <h1 className="font-serif text-2xl font-semibold sm:text-4xl">{text.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed sm:text-lg">{text.body}</p>
        <p className="text-xs text-zinc-600 sm:text-sm">{text.placeAndDate}</p>
      </div>
      <div className="grid grid-cols-2 gap-6 pt-6 sm:gap-16 sm:pt-10">
        {[
          { name: certificate.instructorName, role: "Instrutor" },
          { name: certificate.organizationName, role: "Responsável" },
        ].map((signature) => (
          <div key={signature.role} className="border-t border-zinc-500 pt-2">
            <p className="text-xs font-medium sm:text-sm">{signature.name}</p>
            <p className="text-[11px] text-zinc-500 sm:text-xs">{signature.role}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Certificado de conclusao do curso, para imprimir ou salvar em PDF pelo
 * navegador (sem biblioteca de PDF). A barra some na impressao.
 */
export function CourseCertificateView({
  classGroupId,
  enrollmentId,
}: {
  classGroupId: string;
  enrollmentId: string;
}) {
  const can = useCan();
  const { data: certificate, isPending, error } = useCourseCertificate(enrollmentId);

  if (isApiError(error) && error.code === "FEATURE_NOT_IN_PLAN") {
    return <CourseCertificateLocked classGroupId={classGroupId} canManagePlan={can("subscription:manage")} />;
  }

  return (
    <div className="space-y-4">
      {/* Folha deitada; a margem da impressao fica com a borda do certificado. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink classGroupId={classGroupId} />
        {certificate ? (
          <Button type="button" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir ou salvar em PDF
          </Button>
        ) : null}
      </div>
      {isPending ? (
        <Skeleton className="mx-auto aspect-[297/210] w-full max-w-4xl rounded-md" />
      ) : certificate ? (
        <DefaultCertificateSheet certificate={certificate} />
      ) : (
        <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          {getErrorMessage(error, "Não foi possível carregar o certificado.")}
        </p>
      )}
    </div>
  );
}
