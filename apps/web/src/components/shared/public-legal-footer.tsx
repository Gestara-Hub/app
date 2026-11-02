import Link from "next/link";
import { COMPANY_ADDRESS, COMPANY_CNPJ, COMPANY_NAME, SITE_NAME, SUPPORT_EMAIL } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Rodape das paginas publicas (fatura, certificado, termo do menor): quem e a
 * empresa por tras do produto (Decreto 7.962/2013 e LGPD, doc product/27) e os
 * caminhos para Termos, Privacidade e contato.
 */
export function PublicLegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("space-y-1 text-center text-[11px] leading-relaxed text-muted-foreground", className)}>
      <p>
        {SITE_NAME} é um produto da {COMPANY_NAME} · CNPJ {COMPANY_CNPJ}
      </p>
      <p>{COMPANY_ADDRESS}</p>
      <p>
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Termos de uso
        </Link>
        {" · "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacidade
        </Link>
        {" · "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-foreground">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </footer>
  );
}
