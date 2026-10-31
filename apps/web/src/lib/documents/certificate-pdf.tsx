import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CertificateArtwork, CertificateLayout, CertificatePart } from "@gestarahub/contracts";
import type { RenderedCertificate } from "@gestarahub/core/certificate";
import type { DocumentLogo } from "./document-pdf";

/**
 * Certificado em PDF (A4 deitado), nos modelos da folha da tela
 * (features/certificates/certificate-sheet): classico, moderno, limpo e a arte
 * do espaco ("Minha arte"). As medidas da tela sao em % da largura da folha
 * (cqw); aqui 1 cqw = 8,42 pt.
 */

Font.registerHyphenationCallback((word) => [word]);

const CQW = 841.89 / 100;
const cq = (value: number) => value * CQW;

const INK = "#18181b";
const GRAY_500 = "#71717a";
const GRAY_600 = "#52525b";
const GRAY_700 = "#3f3f46";

/** Mistura a cor com o branco (moldura interna clara do modelo classico). */
function tint(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", color: INK, backgroundColor: "#ffffff" },
  body: { fontSize: cq(1.9), lineHeight: 1.6 },
  date: { fontSize: cq(1.35), color: GRAY_600 },
  signatureName: { fontSize: cq(1.4), minHeight: cq(1.4) * 1.4 },
  signatureRole: { fontSize: cq(1.15), color: GRAY_500, marginTop: 1 },
});

interface SheetProps {
  text: RenderedCertificate;
  organizationName: string;
  logo: DocumentLogo | null;
  accent: string;
}

function Signatures({
  text,
  align,
  ink = "dark",
}: {
  text: RenderedCertificate;
  align: "center" | "left";
  ink?: "dark" | "light";
}) {
  const single = text.signatures.length === 1;
  const light = ink === "light";
  return (
    <View
      style={{
        flexDirection: "row",
        gap: cq(6),
        width: single ? "50%" : "100%",
        alignSelf: single && align === "center" ? "center" : "flex-start",
      }}
    >
      {text.signatures.map((signature, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            borderTopWidth: 0.75,
            borderTopColor: light ? "#ffffffb3" : GRAY_500,
            paddingTop: cq(0.8),
            textAlign: align,
          }}
        >
          <Text style={[styles.signatureName, light ? { color: "#ffffff" } : {}]}>{signature.name}</Text>
          {signature.role ? (
            <Text style={[styles.signatureRole, light ? { color: "#ffffffbf" } : {}]}>{signature.role}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ClassicSheet({ text, organizationName, logo, accent }: SheetProps) {
  return (
    <View style={{ flex: 1, margin: 18, borderWidth: 3, borderColor: accent, padding: 2 }}>
      <View style={{ flex: 1, borderWidth: 1, borderColor: accent, padding: cq(0.8) }}>
        <View
          style={{
            flex: 1,
            borderWidth: 0.75,
            borderColor: tint(accent, 0.6),
            paddingHorizontal: cq(6),
            paddingVertical: cq(3.5),
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt */}
          {logo ? <Image src={logo.src} style={{ height: cq(6), marginBottom: cq(1), objectFit: "contain" }} /> : null}
          <Text style={{ fontSize: cq(1.3), fontFamily: "Helvetica-Bold", letterSpacing: cq(1.3) * 0.2, color: GRAY_500 }}>
            {organizationName.toUpperCase()}
          </Text>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: cq(2) }}>
            <Text style={{ fontFamily: "Times-Bold", fontSize: cq(4.2), lineHeight: 1.2, color: accent }}>{text.title}</Text>
            <Text style={[styles.body, { maxWidth: "80%" }]}>{text.body}</Text>
            <Text style={styles.date}>{text.placeAndDate}</Text>
          </View>
          <View style={{ width: "100%", paddingTop: cq(2) }}>
            <Signatures text={text} align="center" />
          </View>
        </View>
      </View>
    </View>
  );
}

function ModernSheet({ text, organizationName, logo, accent }: SheetProps) {
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: "22%", backgroundColor: accent, padding: cq(3), justifyContent: "space-between" }}>
        {logo ? (
          <View style={{ alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: cq(0.8), padding: cq(1) }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt */}
            <Image src={logo.src} style={{ height: cq(6), objectFit: "contain" }} />
          </View>
        ) : (
          <View />
        )}
        <Text
          style={{
            color: "#ffffff",
            fontFamily: "Helvetica-Bold",
            fontSize: cq(1.4),
            lineHeight: 1.35,
            letterSpacing: cq(1.4) * 0.15,
          }}
        >
          {organizationName.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: cq(5), paddingVertical: cq(4.5) }}>
        <View style={{ flex: 1, justifyContent: "center", gap: cq(2) }}>
          <View style={{ gap: cq(1.2) }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: cq(4.4), lineHeight: 1.2 }}>{text.title}</Text>
            <View style={{ height: cq(0.45), width: cq(8), borderRadius: cq(0.45), backgroundColor: accent }} />
          </View>
          <Text style={styles.body}>{text.body}</Text>
          <Text style={styles.date}>{text.placeAndDate}</Text>
        </View>
        <View style={{ paddingTop: cq(2) }}>
          <Signatures text={text} align="left" />
        </View>
      </View>
    </View>
  );
}

function MinimalSheet({ text, organizationName, logo, accent }: SheetProps) {
  return (
    <View style={{ flex: 1, paddingHorizontal: cq(7), paddingVertical: cq(5) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: cq(1.5) }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt */}
        {logo ? <Image src={logo.src} style={{ height: cq(4.5), objectFit: "contain" }} /> : null}
        <Text style={{ fontSize: cq(1.3), letterSpacing: cq(1.3) * 0.15, color: GRAY_500 }}>
          {organizationName.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: cq(2) }}>
        <View style={{ height: cq(0.25), width: cq(5), backgroundColor: accent }} />
        <Text style={{ fontSize: cq(4), lineHeight: 1.2 }}>{text.title}</Text>
        <Text style={[styles.body, { maxWidth: "85%", fontSize: cq(1.85), color: GRAY_700 }]}>{text.body}</Text>
        <Text style={[styles.date, { color: GRAY_500 }]}>{text.placeAndDate}</Text>
      </View>
      <Signatures text={text} align="left" />
    </View>
  );
}

/** "Minha arte": a imagem cobre a pagina e o texto fica por cima (mesmas regras da tela). */
function CustomSheet({
  text,
  organizationName,
  logo,
  artwork,
  settings,
}: SheetProps & { artwork: DocumentLogo | null; settings: Omit<CertificateArtwork, "fileId"> }) {
  const show = (part: CertificatePart) => !settings.hidden.includes(part);
  const light = settings.ink === "light";
  const ink = light ? "#ffffff" : INK;
  const soft = light ? "#ffffffcc" : GRAY_600;
  const justify = settings.textPosition === "top" ? "flex-start" : settings.textPosition === "bottom" ? "flex-end" : "center";
  return (
    <View style={{ flex: 1 }}>
      {artwork ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt
        <Image src={artwork.src} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
      <View style={{ flex: 1, paddingHorizontal: cq(8), paddingVertical: cq(5), justifyContent: justify, alignItems: "center" }}>
        <View style={{ maxWidth: "84%", alignItems: "center", gap: cq(1.6), color: ink }}>
          {show("logo") && logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt
            <Image src={logo.src} style={{ height: cq(5), objectFit: "contain" }} />
          ) : null}
          {show("organizationName") ? (
            <Text style={{ fontSize: cq(1.3), fontFamily: "Helvetica-Bold", letterSpacing: cq(1.3) * 0.2, color: light ? "#ffffffcc" : GRAY_500 }}>
              {organizationName.toUpperCase()}
            </Text>
          ) : null}
          {show("title") ? (
            <Text style={{ fontFamily: "Times-Bold", fontSize: cq(4.2), lineHeight: 1.2, color: ink, textAlign: "center" }}>{text.title}</Text>
          ) : null}
          {show("body") ? <Text style={[styles.body, { color: ink, textAlign: "center" }]}>{text.body}</Text> : null}
          {show("date") ? <Text style={[styles.date, { color: soft }]}>{text.placeAndDate}</Text> : null}
          {show("signatures") ? (
            <View style={{ width: "100%", paddingTop: cq(1.5) }}>
              <Signatures text={text} align="center" ink={settings.ink} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Rodape de verificacao (doc 21 §1.3): codigo, endereco e QR no canto. */
function Verification({ code, url, qr, light }: { code: string; url: string; qr: DocumentLogo; light: boolean }) {
  const color = light ? "#ffffffd9" : GRAY_500;
  return (
    <View
      style={{
        position: "absolute",
        right: cq(2.2),
        bottom: cq(1.8),
        flexDirection: "row",
        alignItems: "center",
        gap: cq(1),
      }}
    >
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: cq(0.95), fontFamily: "Helvetica-Bold", color }}>{code}</Text>
        <Text style={{ fontSize: cq(0.95), color }}>Confira em {url.replace(/^https?:\/\//, "")}</Text>
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf nao tem alt */}
      <Image src={qr.src} style={{ width: cq(6), height: cq(6), backgroundColor: "#ffffff", padding: cq(0.3) }} />
    </View>
  );
}

export function CertificatePdf({
  text,
  layout,
  organizationName,
  accent,
  logo,
  artwork = null,
  artworkSettings,
  verification,
}: {
  text: RenderedCertificate;
  layout: CertificateLayout;
  organizationName: string;
  accent: string;
  logo: DocumentLogo | null;
  /** Imagem da arte de fundo (layout "custom"). */
  artwork?: DocumentLogo | null;
  artworkSettings?: Omit<CertificateArtwork, "fileId">;
  /** Codigo de verificacao com o QR ja desenhado (a previa do editor nao tem). */
  verification?: { code: string; url: string; qr: DocumentLogo };
}) {
  const props: SheetProps = { text, organizationName, logo, accent };
  return (
    <Document title={text.title} author={organizationName} creator="GestaraHub" producer="GestaraHub">
      <Page size="A4" orientation="landscape" style={styles.page}>
        {layout === "custom" && artworkSettings ? (
          <CustomSheet {...props} artwork={artwork} settings={artworkSettings} />
        ) : layout === "modern" ? (
          <ModernSheet {...props} />
        ) : layout === "minimal" ? (
          <MinimalSheet {...props} />
        ) : (
          <ClassicSheet {...props} />
        )}
        {verification ? (
          <Verification {...verification} light={layout === "custom" && artworkSettings?.ink === "light"} />
        ) : null}
      </Page>
    </Document>
  );
}
