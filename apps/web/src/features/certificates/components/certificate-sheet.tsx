import type { CSSProperties } from "react";
import type { CertificateTemplate, CourseCertificate } from "@gestarahub/contracts";
import { renderCertificate, type RenderedCertificate } from "@gestarahub/core/certificate";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "../certificate-meta";

/**
 * Folha do certificado (A4 deitado). As medidas usam a largura da folha
 * (`cqw`), entao a previa pequena do editor, a tela e a impressao ficam iguais
 * em proporcao. O papel e sempre branco (tambem no tema escuro) e a impressao
 * mantem as cores do modelo (`print-color-adjust: exact`).
 */

type SheetProps = { text: RenderedCertificate; organizationName: string; logoUrl: string | null };

function Logo({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
  return <img src={url} alt="" className={cn("w-auto object-contain", className)} />;
}

function Signatures({ text, align = "center" }: { text: RenderedCertificate; align?: "center" | "left" }) {
  const single = text.signatures.length === 1;
  return (
    <div
      className={cn(
        "grid gap-[6cqw]",
        single ? "grid-cols-1" : "grid-cols-2",
        single && align === "center" && "mx-auto w-1/2",
        single && align === "left" && "w-1/2",
      )}
    >
      {text.signatures.map((signature, index) => (
        <div
          key={index}
          className={cn("border-t border-zinc-500 pt-[0.8cqw]", align === "center" ? "text-center" : "text-left")}
        >
          <p className="min-h-[1.4em] text-[1.4cqw] font-medium">{signature.name}</p>
          {signature.role ? <p className="text-[1.15cqw] text-zinc-500">{signature.role}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ClassicSheet({ text, organizationName, logoUrl }: SheetProps) {
  return (
    <div className="flex h-full flex-col border-[0.7cqw] border-double border-[color:var(--cert-accent)] p-[0.8cqw]">
      <div className="flex h-full flex-col items-center border border-[color:var(--cert-accent)]/40 px-[6cqw] py-[3.5cqw] text-center">
        <Logo url={logoUrl} className="mb-[1cqw] h-[6cqw]" />
        <p className="text-[1.3cqw] font-semibold tracking-[0.2em] text-zinc-500 uppercase">{organizationName}</p>
        <div className="flex flex-1 flex-col items-center justify-center gap-[2cqw]">
          <h1 className="font-serif text-[4.2cqw] leading-tight font-semibold text-[color:var(--cert-accent)]">
            {text.title}
          </h1>
          <p className="max-w-[80%] text-[1.9cqw] leading-relaxed whitespace-pre-line">{text.body}</p>
          <p className="text-[1.35cqw] text-zinc-600">{text.placeAndDate}</p>
        </div>
        <div className="w-full pt-[2cqw]">
          <Signatures text={text} />
        </div>
      </div>
    </div>
  );
}

function ModernSheet({ text, organizationName, logoUrl }: SheetProps) {
  return (
    <div className="flex h-full">
      <div className="flex w-[22%] shrink-0 flex-col justify-between bg-[color:var(--cert-accent)] p-[3cqw] text-white">
        {logoUrl ? (
          <div className="self-start rounded-[0.8cqw] bg-white p-[1cqw]">
            <Logo url={logoUrl} className="h-[6cqw] max-w-full" />
          </div>
        ) : (
          <span />
        )}
        <p className="text-[1.4cqw] leading-snug font-semibold tracking-[0.15em] uppercase">{organizationName}</p>
      </div>
      <div className="flex flex-1 flex-col px-[5cqw] py-[4.5cqw] text-left">
        <div className="flex flex-1 flex-col justify-center gap-[2cqw]">
          <div className="space-y-[1.2cqw]">
            <h1 className="text-[4.4cqw] leading-tight font-bold tracking-tight">{text.title}</h1>
            <span aria-hidden className="block h-[0.45cqw] w-[8cqw] rounded-full bg-[color:var(--cert-accent)]" />
          </div>
          <p className="text-[1.9cqw] leading-relaxed whitespace-pre-line">{text.body}</p>
          <p className="text-[1.35cqw] text-zinc-600">{text.placeAndDate}</p>
        </div>
        <div className="pt-[2cqw]">
          <Signatures text={text} align="left" />
        </div>
      </div>
    </div>
  );
}

function MinimalSheet({ text, organizationName, logoUrl }: SheetProps) {
  return (
    <div className="flex h-full flex-col px-[7cqw] py-[5cqw] text-left">
      <div className="flex items-center gap-[1.5cqw]">
        <Logo url={logoUrl} className="h-[4.5cqw]" />
        <p className="text-[1.3cqw] font-medium tracking-[0.15em] text-zinc-500 uppercase">{organizationName}</p>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-[2cqw]">
        <span aria-hidden className="block h-[0.25cqw] w-[5cqw] bg-[color:var(--cert-accent)]" />
        <h1 className="text-[4cqw] leading-tight font-light tracking-tight">{text.title}</h1>
        <p className="max-w-[85%] text-[1.85cqw] leading-relaxed whitespace-pre-line text-zinc-700">{text.body}</p>
        <p className="text-[1.35cqw] text-zinc-500">{text.placeAndDate}</p>
      </div>
      <Signatures text={text} align="left" />
    </div>
  );
}

export function CertificateSheet({
  certificate,
  template,
  logoUrl = null,
  className,
}: {
  certificate: CourseCertificate;
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body" | "signatures" | "showAttendance">;
  logoUrl?: string | null;
  className?: string;
}) {
  const text = renderCertificate(certificate, template);
  const accent = ACCENT_COLORS[template.accentColor]?.hex ?? ACCENT_COLORS.graphite.hex;
  const props: SheetProps = { text, organizationName: certificate.organizationName, logoUrl };
  return (
    // A4 deitado; na impressao (folha de 277 x 190 mm uteis) a altura fica fixa para caber em 1 pagina.
    <div className={cn("@container w-full print:w-[277mm]", className)}>
      <article
        className="certificate-sheet aspect-[297/210] w-full overflow-hidden rounded-md bg-white text-zinc-900 shadow-sm ring-1 ring-black/10 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:aspect-auto print:h-[190mm] print:rounded-none print:shadow-none print:ring-0"
        style={{ "--cert-accent": accent } as CSSProperties}
      >
        {template.layout === "modern" ? (
          <ModernSheet {...props} />
        ) : template.layout === "minimal" ? (
          <MinimalSheet {...props} />
        ) : (
          <ClassicSheet {...props} />
        )}
      </article>
    </div>
  );
}
