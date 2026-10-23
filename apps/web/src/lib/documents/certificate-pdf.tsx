import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CertificateLayout } from "@gestarahub/contracts";
import type { RenderedCertificate } from "@gestarahub/core/certificate";
import type { DocumentLogo } from "./document-pdf";

/**
 * Certificado em PDF (A4 deitado), nos tres modelos da folha da tela
 * (features/certificates/certificate-sheet): classico, moderno e limpo. As
 * medidas da tela sao em % da largura da folha (cqw); aqui 1 cqw = 8,42 pt.
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

function Signatures({ text, align }: { text: RenderedCertificate; align: "center" | "left" }) {
  const single = text.signatures.length === 1;
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
          style={{ flex: 1, borderTopWidth: 0.75, borderTopColor: GRAY_500, paddingTop: cq(0.8), textAlign: align }}
        >
          <Text style={styles.signatureName}>{signature.name}</Text>
          {signature.role ? <Text style={styles.signatureRole}>{signature.role}</Text> : null}
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

export function CertificatePdf({
  text,
  layout,
  organizationName,
  accent,
  logo,
}: {
  text: RenderedCertificate;
  layout: CertificateLayout;
  organizationName: string;
  accent: string;
  logo: DocumentLogo | null;
}) {
  const props: SheetProps = { text, organizationName, logo, accent };
  return (
    <Document title={text.title} author={organizationName} creator="GestaraHub" producer="GestaraHub">
      <Page size="A4" orientation="landscape" style={styles.page}>
        {layout === "modern" ? (
          <ModernSheet {...props} />
        ) : layout === "minimal" ? (
          <MinimalSheet {...props} />
        ) : (
          <ClassicSheet {...props} />
        )}
      </Page>
    </Document>
  );
}
