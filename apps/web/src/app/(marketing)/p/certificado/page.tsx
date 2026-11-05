import type { Metadata } from "next";
import { PublicLegalFooter } from "@/components/shared/public-legal-footer";
import Image from "next/image";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";
import { CertificateCodeForm } from "./certificate-code-form";

export const metadata: Metadata = {
  title: "Verificar certificado | GestaraHub",
  robots: { index: false, follow: false },
};

/**
 * Pagina publica para digitar o codigo do certificado (doc 21 §1.3): quem nao
 * consegue ler o QR chega aqui pelo endereco curto do rodape.
 */
export default function CertificateLookupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src={logoLightImage} alt="GestaraHub" className="h-10 w-auto dark:hidden" priority />
          <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-10 w-auto dark:block" priority />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold">Verificar certificado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Digite o código que está no rodapé do certificado, embaixo do QR Code.</p>
          <CertificateCodeForm />
        </div>
        <PublicLegalFooter />
      </div>
    </main>
  );
}
