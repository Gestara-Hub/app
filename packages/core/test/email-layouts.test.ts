import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hostedEmailAssetUrl,
  renderBrandEmailLayout,
  renderOpsAlertEmail,
  renderSupportConversationEmail,
} from "../src/email-layouts.ts";

describe("layouts compartilhados de e-mail", () => {
  it("hostedEmailAssetUrl aceita apenas https em domínio público", () => {
    assert.equal(hostedEmailAssetUrl("https://gestarahub.com.br"), "https://gestarahub.com.br/email-icon.png?v=6");
    assert.equal(hostedEmailAssetUrl("http://localhost:3200"), null);
    assert.equal(hostedEmailAssetUrl("https://abc.trycloudflare.com"), null);
    assert.equal(hostedEmailAssetUrl(undefined), null);
  });

  it("renderBrandEmailLayout renderiza topo escuro, badge, suporte e rodapé", () => {
    const html = renderBrandEmailLayout({
      title: "Assunto",
      preheader: "Resumo",
      badge: "Segurança",
      heading: "Título",
      intro: "Introdução",
      body: "<p>Corpo</p>",
      footer: "Rodapé",
      supportEmail: "contato@gestarahub.com.br",
      icon: { hasInlineIcon: true },
    });
    assert.match(html, /cid:gestarahub-icon/);
    assert.match(html, /Segurança/);
    assert.match(html, /Dúvidas\?/);
    assert.match(html, /CNPJ 45\.160\.928\/0001-71/);
  });

  it("renderSupportConversationEmail escapa conteúdo e preserva quebras de linha", () => {
    const html = renderSupportConversationEmail({
      firstName: "Jessica",
      protocol: "GH-104",
      threadSubject: "Dúvida <urgente>",
      replyBody: "Linha 1\nLinha 2 <script>",
      appUrl: "https://gestarahub.com.br",
      icon: { hostedIconUrl: "https://gestarahub.com.br/email-icon.png?v=6" },
    });
    assert.match(html, /GH-104/);
    assert.match(html, /Dúvida &lt;urgente&gt;/);
    assert.match(html, /Linha 1<br \/>Linha 2 &lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });

  it("renderOpsAlertEmail renderiza metadados, itens e botão", () => {
    const html = renderOpsAlertEmail({
      tone: "danger",
      sectionLabel: "Suporte",
      badge: "URGENTE",
      title: "2 conversas esperam resposta",
      subtitle: "1 urgente · 1 atrasada",
      meta: [{ label: "Protocolo", value: "GH-104", mono: true }],
      items: [{ badge: { text: "Urgente", tone: "danger" }, title: "Pix não caiu", meta: "Dojo Norte" }],
      action: { label: "Abrir fila no painel", href: "https://admin.gestarahub.com.br/support" },
    });
    assert.match(html, /URGENTE/);
    assert.match(html, /GH-104/);
    assert.match(html, /Pix não caiu/);
    assert.match(html, /Abrir fila no painel/);
  });
});
