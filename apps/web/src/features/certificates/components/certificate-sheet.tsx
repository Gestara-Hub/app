import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { AnyCertificate, CertificateArtwork, CertificateBlock, CertificatePart, CertificateTemplate } from "@gestarahub/contracts";
import { renderCertificate, type RenderedCertificate } from "@gestarahub/core/certificate";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "../certificate-meta";
import { certificateLookupAddress, certificateVerifyUrl } from "../certificate-verify";

/**
 * Rodape de verificacao (doc 21 §1.3): codigo e QR no canto, por cima de
 * qualquer layout. A previa do editor nao tem codigo e fica sem ele.
 */
type SheetPosition = { x: number; y: number };
type BlockMove = (block: CertificateBlock, position: SheetPosition) => void;

const pct = (part: number, whole: number) => Math.round((part / whole) * 10000) / 100;

/**
 * Arrastar um bloco dentro da folha (editor, "Minha arte"): devolve a posicao em
 * % da folha. No primeiro movimento, os outros blocos que ainda estavam no fluxo
 * ganham a posicao em que estao: assim nada pula quando um bloco sai do fluxo.
 */
function startDrag(event: ReactPointerEvent<HTMLElement>, block: CertificateBlock, onMove: BlockMove) {
  const el = event.currentTarget;
  const sheet = el.closest("article");
  if (!sheet) return;
  event.preventDefault();
  el.setPointerCapture(event.pointerId);
  const bounds = sheet.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const grabX = event.clientX - box.left;
  const grabY = event.clientY - box.top;
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;
  const move = (e: PointerEvent) => {
    if (!started) {
      // Um clique com o mouse tremendo nao e arrasto: so comeca depois de uns pixels.
      if (Math.abs(e.clientX - startX) < 4 && Math.abs(e.clientY - startY) < 4) return;
      started = true;
      for (const other of sheet.querySelectorAll<HTMLElement>("[data-block]")) {
        const name = other.dataset.block as CertificateBlock | undefined;
        if (!name || name === block || other.style.left) continue;
        const r = other.getBoundingClientRect();
        onMove(name, { x: pct(r.left - bounds.left, bounds.width), y: pct(r.top - bounds.top, bounds.height) });
      }
    }
    const maxX = bounds.width - box.width;
    const maxY = bounds.height - box.height;
    const left = Math.min(Math.max(e.clientX - grabX - bounds.left, 0), maxX);
    const top = Math.min(Math.max(e.clientY - grabY - bounds.top, 0), maxY);
    onMove(block, { x: pct(left, bounds.width), y: pct(top, bounds.height) });
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/**
 * Bloco da arte propria: no fluxo, ou solto onde a pessoa arrastou (`position`,
 * em % da folha). Com `onMove`, arrasta-se na previa.
 */
function Block({
  block,
  position,
  onMove,
  className,
  flowClassName,
  absoluteClassName,
  children,
}: {
  block: CertificateBlock;
  position?: SheetPosition;
  onMove?: BlockMove;
  className?: string;
  /** Classes so no fluxo (ex.: largura do texto). */
  flowClassName?: string;
  /** Classes so quando solto (ex.: largura fixa). */
  absoluteClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onPointerDown={onMove ? (event) => startDrag(event, block, onMove) : undefined}
      style={position ? { left: `${position.x}%`, top: `${position.y}%` } : undefined}
      data-block={block}
      className={cn(
        className,
        position ? cn("absolute", absoluteClassName) : flowClassName,
        onMove && "cursor-grab touch-none select-none rounded-[0.5cqw] outline-dashed outline-1 outline-offset-[0.4cqw] outline-current/60 active:cursor-grabbing",
      )}
      title={onMove ? "Arraste para mudar de lugar" : undefined}
      data-testid={`certificate-block-${block}`}
    >
      {children}
    </div>
  );
}

const QR_SIZE_CLASS = { small: "size-[3.2cqw]", normal: "size-[4.5cqw]" } as const;

/**
 * Rodape de verificacao: QR, codigo e endereco curto. No canto inferior direito,
 * ou onde a pessoa arrastou na arte propria (`position`, em % da folha).
 */
function Verification({
  code,
  ink,
  position,
  size = "normal",
  onMove,
}: {
  code: string;
  ink: "dark" | "light";
  position?: SheetPosition;
  size?: "small" | "normal";
  onMove?: BlockMove;
}) {
  const url = certificateVerifyUrl(code);
  return (
    <Block
      block="verification"
      position={position}
      onMove={onMove}
      className={cn("flex flex-col items-center gap-[0.4cqw]", ink === "light" ? "text-white/85" : "text-zinc-500")}
      flowClassName="absolute right-[2.2cqw] bottom-[1.8cqw]"
    >
      <div data-testid="certificate-verification" className="flex flex-col items-center gap-[0.4cqw]">
        {/* QR, o codigo embaixo e o endereco curto para quem digita (o QR ja leva direto). */}
        <QRCodeSVG
          value={url}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#000000"
          role="img"
          aria-label="QR Code de verificação"
          className={cn("rounded-[0.3cqw] bg-white p-[0.3cqw]", QR_SIZE_CLASS[size])}
        />
        <p className={cn("font-semibold tracking-wide", size === "small" ? "text-[0.75cqw]" : "text-[0.85cqw]")}>{code}</p>
        <p className="text-[0.65cqw]">{certificateLookupAddress()}</p>
      </div>
    </Block>
  );
}

/**
 * Folha do certificado (A4 deitado). As medidas usam a largura da folha
 * (`cqw`), entao a previa pequena do editor, a tela e a impressao ficam iguais
 * em proporcao. O papel e sempre branco (tambem no tema escuro) e a impressao
 * mantem as cores do modelo (`print-color-adjust: exact`).
 */

type SheetProps = {
  text: RenderedCertificate;
  organizationName: string;
  logoUrl: string | null;
  /** Com o rodape de verificacao, as assinaturas sobem para nao encostar nele. */
  reserveFooter: boolean;
};

/** Posicao do bloco de texto sobre a arte ("Minha arte"). */
const TEXT_POSITION_CLASS = { top: "justify-start", center: "justify-center", bottom: "justify-end" } as const;

function Logo({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null;
  // Sem o arrasto nativo da imagem: ele engolia o arrasto do bloco da logo na previa.
  // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
  return <img src={url} alt="" draggable={false} className={cn("w-auto object-contain", className)} />;
}

function Signatures({
  text,
  align = "center",
  ink = "dark",
}: {
  text: RenderedCertificate;
  align?: "center" | "left";
  ink?: "dark" | "light";
}) {
  const single = text.signatures.length === 1;
  const light = ink === "light";
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
          className={cn(
            "border-t pt-[0.8cqw]",
            light ? "border-white/70" : "border-zinc-500",
            align === "center" ? "text-center" : "text-left",
          )}
        >
          <p className="min-h-[1.4em] text-[1.4cqw] font-medium">{signature.name}</p>
          {signature.role ? (
            <p className={cn("text-[1.15cqw]", light ? "text-white/75" : "text-zinc-500")}>{signature.role}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ClassicSheet({ text, organizationName, logoUrl, reserveFooter }: SheetProps) {
  return (
    <div className="flex h-full flex-col border-[0.7cqw] border-double border-[color:var(--cert-accent)] p-[0.8cqw]">
      <div
        className={cn(
          "flex h-full flex-col items-center border border-[color:var(--cert-accent)]/40 px-[6cqw] py-[3.5cqw] text-center",
          reserveFooter && "pb-[7.5cqw]",
        )}
      >
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

function ModernSheet({ text, organizationName, logoUrl, reserveFooter }: SheetProps) {
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
      <div className={cn("flex flex-1 flex-col px-[5cqw] py-[4.5cqw] text-left", reserveFooter && "pb-[7.5cqw]")}>
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

function MinimalSheet({ text, organizationName, logoUrl, reserveFooter }: SheetProps) {
  return (
    <div className={cn("flex h-full flex-col px-[7cqw] py-[5cqw] text-left", reserveFooter && "pb-[7.5cqw]")}>
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

/**
 * "Minha arte" (doc 21 §1.1): a imagem do espaco cobre a folha e o texto fica
 * por cima, na posicao e na cor escolhidas; as partes que a arte ja traz
 * impressas ficam de fora. Sem a imagem (ainda carregando), fundo branco.
 */
const LOGO_SIZE_CLASS = { small: "h-[3.5cqw]", medium: "h-[5cqw]", large: "h-[8cqw]" } as const;

function CustomSheet({
  text,
  organizationName,
  logoUrl,
  artworkUrl,
  artwork,
  reserveFooter,
  onMove,
}: SheetProps & { artworkUrl: string | null; artwork: Omit<CertificateArtwork, "fileId">; onMove?: BlockMove }) {
  const show = (part: CertificatePart) => !artwork.hidden.includes(part);
  const light = artwork.ink === "light";
  const logo = show("logo") && logoUrl ? (
    <Block block="logo" position={artwork.logo} onMove={onMove} className="flex justify-center">
      <Logo url={logoUrl} className={LOGO_SIZE_CLASS[artwork.logoSize ?? "medium"]} />
    </Block>
  ) : null;
  const textBlock =
    show("organizationName") || show("title") || show("body") || show("date") ? (
      <Block
        block="text"
        position={artwork.text}
        onMove={onMove}
        className="flex flex-col items-center gap-[1.6cqw] text-center"
        flowClassName="w-full"
        absoluteClassName="w-[70.56%]"
      >
        {show("organizationName") ? (
          <p className={cn("text-[1.3cqw] font-semibold tracking-[0.2em] uppercase", light ? "text-white/80" : "text-zinc-500")}>
            {organizationName}
          </p>
        ) : null}
        {show("title") ? <h1 className="font-serif text-[4.2cqw] leading-tight font-semibold">{text.title}</h1> : null}
        {show("body") ? <p className="text-[1.9cqw] leading-relaxed whitespace-pre-line">{text.body}</p> : null}
        {show("date") ? (
          <p className={cn("text-[1.35cqw]", light ? "text-white/80" : "text-zinc-600")}>{text.placeAndDate}</p>
        ) : null}
      </Block>
    ) : null;
  const signatures = show("signatures") ? (
    // O respiro fica como margem (fora da caixa): solto, o bloco mantem o conteudo no mesmo lugar.
    <Block block="signatures" position={artwork.signatures} onMove={onMove} flowClassName="mt-[1.5cqw] w-full" absoluteClassName="w-[70.56%]">
      <Signatures text={text} ink={artwork.ink} />
    </Block>
  ) : null;
  return (
    <div className={cn("relative flex h-full flex-col", light ? "text-white" : "text-zinc-900")}>
      {artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
        <img src={artworkUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className={cn(
          "relative flex h-full flex-col items-center px-[8cqw] py-[5cqw] text-center",
          TEXT_POSITION_CLASS[artwork.textPosition],
          reserveFooter && "pb-[7.5cqw]",
        )}
      >
        {/* Blocos no fluxo (na ordem da folha); os soltos saem daqui e ficam onde foram arrastados. */}
        <div className="flex w-[84%] flex-col items-center gap-[1.6cqw]">
          {!artwork.logo ? logo : null}
          {!artwork.text ? textBlock : null}
          {!artwork.signatures ? signatures : null}
        </div>
      </div>
      {artwork.logo ? logo : null}
      {artwork.text ? textBlock : null}
      {artwork.signatures ? signatures : null}
    </div>
  );
}

export function CertificateSheet({
  certificate,
  template,
  logoUrl = null,
  artworkUrl = null,
  className,
  onBlockMove,
}: {
  certificate: AnyCertificate;
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body" | "signatures" | "showAttendance"> & {
    artwork?: Omit<CertificateArtwork, "fileId"> & { fileId?: string };
  };
  logoUrl?: string | null;
  /** Imagem da arte de fundo (layout "custom"). */
  artworkUrl?: string | null;
  className?: string;
  /** Editor da arte propria: arrastar um bloco (logo, texto, assinaturas, QR) muda a posicao dele. */
  onBlockMove?: BlockMove;
}) {
  const text = renderCertificate(certificate, template);
  const isCustom = template.layout === "custom" && Boolean(template.artwork);
  const verificationPosition = isCustom ? template.artwork?.verification : undefined;
  const accent = ACCENT_COLORS[template.accentColor]?.hex ?? ACCENT_COLORS.graphite.hex;
  const props: SheetProps = {
    text,
    organizationName: certificate.organizationName,
    logoUrl,
    // Com o QR arrastado para outro lugar, as assinaturas nao precisam subir.
    reserveFooter: Boolean(certificate.verificationCode) && !verificationPosition,
  };
  return (
    // A4 deitado; na impressao (folha de 277 x 190 mm uteis) a altura fica fixa para caber em 1 pagina.
    <div className={cn("@container w-full print:w-[277mm]", className)}>
      <article
        className="certificate-sheet relative aspect-[297/210] w-full overflow-hidden rounded-md bg-white text-zinc-900 shadow-sm ring-1 ring-black/10 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:aspect-auto print:h-[190mm] print:rounded-none print:shadow-none print:ring-0"
        style={{ "--cert-accent": accent } as CSSProperties}
      >
        {template.layout === "custom" && template.artwork ? (
          <CustomSheet {...props} artworkUrl={artworkUrl} artwork={template.artwork} onMove={onBlockMove} />
        ) : template.layout === "modern" ? (
          <ModernSheet {...props} />
        ) : template.layout === "minimal" ? (
          <MinimalSheet {...props} />
        ) : (
          <ClassicSheet {...props} />
        )}
        {certificate.verificationCode ? (
          <Verification
            code={certificate.verificationCode}
            ink={isCustom && template.artwork?.ink === "light" ? "light" : "dark"}
            position={verificationPosition}
            size={isCustom ? template.artwork?.qrSize : undefined}
            onMove={isCustom ? onBlockMove : undefined}
          />
        ) : null}
      </article>
    </div>
  );
}
