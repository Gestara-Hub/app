import type { Metadata } from "next";
import { getPublicMinorConsentDetailsAction } from "@/services/legalConsent/actions";
import { MinorConsentForm } from "./minor-consent-form";

export const metadata: Metadata = {
  title: "Autorização de Matrícula e LGPD | GestaraHub",
  description:
    "Autorização de matrícula e tratamento de dados pessoais para alunos menores de 18 anos conforme o Artigo 14 da LGPD.",
};

export default async function MinorConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPublicMinorConsentDetailsAction(id);

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4 sm:px-6 flex flex-col justify-center items-center">
      <div className="w-full max-w-lg">
        {result.success && result.student ? (
          <MinorConsentForm student={result.student} />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center space-y-3 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground">
              Link de Autorização Não Encontrado
            </h2>
            <p className="text-sm text-muted-foreground">
              Não encontramos o cadastro deste aluno ou o link informado está
              incorreto. Entre em contato com a secretaria do estabelecimento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
