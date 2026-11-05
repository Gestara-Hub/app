import type { Metadata } from "next";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
import Image from "next/image";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatWorkload } from "@gestarahub/core/certificate";
import { formatDate } from "@gestarahub/core/format";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { loadCertificatePage } from "@/services/server/certificatePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificação de certificado | GestaraHub",
  // Pagina de um certificado: fora dos buscadores.
  robots: { index: false, follow: false },
};

/**
 * Pagina publica que confirma um certificado (doc 21 §1.3): quem recebe o
 * certificado (empresa, escola) abre o endereco do rodape ou le o QR. So dados
 * mascarados; nada e gravado.
 */
export default async function CertificateVerificationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await loadCertificatePage(code);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-10 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-10 w-auto dark:block" priority />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          {!view ? (
            <Status
              tone="bad"
              title="Certificado não encontrado"
              text="Confira o código no rodapé do certificado. Ele tem o formato GH-XXXX-XXXX."
            />
          ) : view.status === "canceled" ? (
            <Status tone="bad" title="Certificado cancelado" text={`O espaço ${view.organizationName} cancelou este certificado. Ele não vale mais.`} />
          ) : (
            <>
              <Status tone="good" title="Certificado válido" text={`Emitido por ${view.organizationName}.`} />
              <dl className="mt-5 divide-y text-sm">
                <Row label="Aluno" value={view.studentName} />
                {view.kind === "graduation" ? (
                  // Graduacao (doc 21 §1.6): a etapa alcancada e a data, no lugar do curso e do periodo.
                  <>
                    <Row label="Graduação" value={view.modalityName ? `${view.levelName} · ${view.modalityName}` : view.levelName} />
                    {view.previousLevelName ? <Row label="Vinha de" value={view.previousLevelName} /> : null}
                    <Row label="Graduado em" value={formatDate(view.graduatedOn)} />
                  </>
                ) : (
                  <>
                    <Row label="Curso" value={view.modalityName ? `${view.courseName} · ${view.modalityName}` : view.courseName} />
                    <Row
                      label="Período"
                      value={view.startDate === view.endDate ? formatDate(view.startDate) : `${formatDate(view.startDate)} a ${formatDate(view.endDate)}`}
                    />
                    <Row label="Carga horária" value={`${formatWorkload(view.workloadMinutes)} · ${view.lessonsCount} ${view.lessonsCount === 1 ? "aula" : "aulas"}`} />
                    {view.attendancePercent !== null ? <Row label="Frequência" value={`${view.attendancePercent}%`} /> : null}
                  </>
                )}
                <Row label="Emitido em" value={formatDate(view.issuedOn)} />
                <Row label="Código" value={view.code} />
              </dl>
            </>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          O nome aparece abreviado para proteger os dados do aluno.
        </p>
        <PublicLegalFooter />
      </div>
    </div>
  );
}

function Status({ tone, title, text }: { tone: "good" | "bad"; title: string; text: string }) {
  const Icon = tone === "good" ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-3">
      <Icon className={tone === "good" ? "mt-0.5 size-6 shrink-0 text-emerald-600" : "mt-0.5 size-6 shrink-0 text-red-600"} aria-hidden />
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}
