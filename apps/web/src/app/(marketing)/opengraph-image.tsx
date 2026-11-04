import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/config/site";

// Previa do link ao compartilhar (WhatsApp, Instagram, e-mail).
export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "src/assets/logo-light.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "#ffffff",
          color: "#09090b",
          fontFamily: "sans-serif",
        }}
      >
        <img src={logoSrc} width={560} height={73} alt="" />
        <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2 }}>{SITE_TAGLINE}</div>
        <div
          style={{
            display: "flex",
            padding: "12px 28px",
            borderRadius: 999,
            background: "#ecfdf5",
            color: "#047857",
            fontSize: 30,
            fontWeight: 600,
          }}
        >
          Plano grátis • Sem cartão de crédito
        </div>
      </div>
    ),
    size,
  );
}
