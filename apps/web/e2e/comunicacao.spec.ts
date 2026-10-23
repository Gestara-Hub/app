import type { Page } from "@playwright/test";
import { expect, readAcademy, seedAcademy, student, test } from "./fixtures";

/**
 * Comunicacao pelo WhatsApp do proprio espaco (docs/product/13, secao 5 e
 * docs/technical/07): no gratis o envio e assistido (abre
 * api.whatsapp.com/send com o texto pronto e registra "Aberto no WhatsApp");
 * no Pro, com o WhatsApp oficial conectado, a mensagem sai pelo sistema.
 * O link do WhatsApp nunca vai para a rede: a aba nova e respondida localmente.
 */

/** Executa a acao que abre o WhatsApp e devolve o link aberto na aba nova. */
async function openedWhatsApp(page: Page, action: () => Promise<void>) {
  await page.context().route("https://api.whatsapp.com/**", (route) =>
    route.fulfill({ body: "ok", contentType: "text/plain" }),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), action()]);
  await popup.waitForLoadState();
  const raw = popup.url();
  await popup.close();
  const url = new URL(raw);
  return {
    raw,
    origin: `${url.origin}${url.pathname}`,
    phone: url.searchParams.get("phone"),
    // O valor em reais vem do Intl com espaco fino (U+00A0) depois do "R$".
    text: (url.searchParams.get("text") ?? "").replace(/\u00a0/g, " "),
  };
}

/** Abre o menu ⋮ da mensalidade do aluno e escolhe a acao. */
async function chargeAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** Aluno com mensalidade proporcional (20/09 a 30/09 = R$ 55,00) vencida em 20/09. */
const withStudent = (t: Record<string, unknown>) => {
  t.clients = [student("c-a", "Aluno A20")];
};

async function openTab(page: Page, name: "Mensagens" | "Histórico" | "Conexão") {
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

test.describe("envio assistido (grátis)", () => {
  test("grátis usa o envio assistido e mostra o oficial como recurso do Pro", { tag: "@smoke" }, async ({ page }) => {
    await seedAcademy(page, { extra: withStudent });
    await page.goto("/communication");
    await expect(page.getByText("Mensagens prontas que abrem no WhatsApp do seu espaço.")).toBeVisible();
    await expect(page.getByText("Envio assistido", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Envio automático no Pro" })).toHaveAttribute("href", "/settings?tab=plano");
    await expect(page.getByText("Abertas no WhatsApp")).toBeVisible();

    await openTab(page, "Conexão");
    await expect(page.getByText("Em uso")).toBeVisible();
    await expect(page.getByText("Envio automático pelo WhatsApp oficial")).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar WhatsApp oficial" })).toHaveCount(0);

    // Modelos sem interruptor de envio automatico no assistido.
    await openTab(page, "Mensagens");
    await expect(page.getByText("Em atraso", { exact: true })).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);
  });

  test("lembrete de mensalidade atrasada abre o WhatsApp com o texto pronto e vai para o Histórico", { tag: "@smoke" }, async ({
    page,
  }) => {
    await seedAcademy(page, { extra: withStudent });
    await page.goto("/classes/billing?status=all");
    await expect(page.locator("div.group").filter({ hasText: "Aluno A20" })).toContainText("Atrasado");

    const link = await openedWhatsApp(page, () => chargeAction(page, "Aluno A20", "Lembrar no WhatsApp"));
    expect(link.origin).toBe("https://api.whatsapp.com/send");
    expect(link.phone).toBe("5511977770000");
    // Modelo "Em atraso" com os dados da cobranca; a frase do link de pagamento
    // sai inteira (o espaco nao cobra online no gratis).
    expect(link.text).toBe(
      "Oi, Aluno A20! Notamos que a mensalidade de R$ 55,00 da Academia X que venceu em 20/09 ainda está em aberto. Qualquer dúvida, estamos à disposição!",
    );
    expect(link.text).not.toContain("{");

    // O registro "Aberto no WhatsApp" e gravado logo depois de abrir a aba;
    // espera chegar ao banco antes de trocar de pagina.
    await expect
      .poll(async () => (await readAcademy()).messageLogs?.length ?? 0)
      .toBe(1);
    await page.goto("/communication");
    await expect(page.getByText("Abertas no WhatsApp").locator("..")).toContainText("1");
    await openTab(page, "Histórico");
    const row = page.getByRole("button", { name: "Mensagem para Aluno A20", exact: true });
    await expect(row).toContainText("Aberto no WhatsApp");
    await expect(row).toContainText("Em atraso");
    await expect(row).toContainText("(11) 97777-0000");
    await row.click();
    const detail = page.getByRole("dialog", { name: "Em atraso" });
    await expect(detail).toContainText("O WhatsApp foi aberto com esta mensagem.");
    await expect(detail).toContainText("venceu em 20/09");
  });

  test("mensagem avulsa preserva emoji e quebra de linha no link", async ({ page }) => {
    await seedAcademy(page, { extra: withStudent });
    await page.goto("/communication");
    await page.getByRole("button", { name: "Nova mensagem" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova mensagem" });
    await expect(dialog).toContainText("Abre o WhatsApp deste aparelho com a mensagem pronta.");
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: /Aluno A20/ }).click();
    await dialog.getByLabel("Mensagem").fill("Bom treino hoje! 🥋\nAté às 17h 🎉");

    const link = await openedWhatsApp(page, () => dialog.getByRole("button", { name: "Abrir no WhatsApp" }).click());
    expect(link.phone).toBe("5511977770000");
    expect(link.text).toBe("Bom treino hoje! 🥋\nAté às 17h 🎉");
    // Emoji codificado em UTF-8 (o wa.me estragava como "�").
    expect(link.raw).toContain("%F0%9F%A5%8B");
    expect(link.raw).not.toContain("wa.me");
    await expect(dialog).toBeHidden();

    await openTab(page, "Histórico");
    const row = page.getByRole("button", { name: "Mensagem para Aluno A20", exact: true });
    await expect(row).toContainText("Mensagem avulsa");
    await expect(row).toContainText("Aberto no WhatsApp");
  });

  test("texto do modelo editado persiste e é usado no lembrete", async ({ page }) => {
    test.slow(); // tres telas e um reload
    await seedAcademy(page, { extra: withStudent });
    await page.goto("/communication");
    const card = page.locator("div.rounded-xl").filter({ has: page.getByText("Em atraso", { exact: true }) });
    await card.getByRole("button", { name: "Editar texto" }).click();
    const dialog = page.getByRole("dialog", { name: "Em atraso" });
    const text = dialog.getByLabel("Texto");
    await text.fill("{aluno}, sua mensalidade de {valor} venceu em {vencimento}. 🥋");
    // Previa com os valores de exemplo.
    await expect(dialog).toContainText("Ana Souza, sua mensalidade de R$ 150,00 venceu em 10/11. 🥋");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Mensagem salva.")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByText("Ana Souza, sua mensalidade de R$ 150,00 venceu em 10/11. 🥋")).toBeVisible();

    await page.goto("/classes/billing?status=all");
    await expect(page.locator("div.group").filter({ hasText: "Aluno A20" })).toContainText("Atrasado");
    const link = await openedWhatsApp(page, () => chargeAction(page, "Aluno A20", "Lembrar no WhatsApp"));
    expect(link.text).toBe("Aluno A20, sua mensalidade de R$ 55,00 venceu em 20/09. 🥋");
  });

  test("aluno sem WhatsApp com DDD não abre o WhatsApp", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno Sem Fone", { phone: "97777000" })]) });
    await page.goto("/communication");
    await page.getByRole("button", { name: "Nova mensagem" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova mensagem" });
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: /Aluno Sem Fone/ }).click();
    await expect(dialog.getByText("Este aluno não tem WhatsApp com DDD no cadastro.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Abrir no WhatsApp" })).toBeDisabled();
  });
});

test.describe("WhatsApp oficial (Pro)", () => {
  test("ativar o Pro e conectar o WhatsApp oficial troca o modo de envio", async ({ page }) => {
    test.slow(); // Configuracoes + Comunicacao, com a troca de plano recarregando o layout
    await seedAcademy(page, {
      extra: (t) => {
        withStudent(t);
        (t.unit as Record<string, unknown>).phone = "1140028922";
      },
    });

    await page.goto("/settings?tab=plano");
    await page.getByRole("button", { name: "Ativar Profissional (demonstração)" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ativar Profissional" }).click();
    await expect(page.getByText("Plano Profissional ativado.")).toBeVisible();

    await page.goto("/communication");
    // Pro sem conexao: ainda assistido, com o atalho para conectar.
    await expect(page.getByText("Envio assistido", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Conectar WhatsApp oficial" }).click();
    await expect(page.getByRole("tab", { name: "Conexão" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Número do espaço: (11) 4002-8922.")).toBeVisible();
    await page.getByRole("tabpanel").getByRole("button", { name: "Conectar WhatsApp oficial" }).click();
    await expect(page.getByText("WhatsApp oficial conectado.")).toBeVisible();

    await expect(page.getByText("Mensagens automáticas pelo WhatsApp oficial do seu espaço.")).toBeVisible();
    await expect(page.getByText("Academia X · (11) 4002-8922. As mensagens ligadas saem sozinhas.")).toBeVisible();
    await expect(page.getByText("Horário de envio automático")).toBeVisible();
    await openTab(page, "Mensagens");
    await expect(page.getByRole("switch", { name: "Envio automático: Em atraso" })).toBeVisible();

    // No oficial, a mensagem sai pelo sistema: sem aba do WhatsApp.
    let popups = 0;
    page.on("popup", () => (popups += 1));
    await page.getByRole("button", { name: "Nova mensagem" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova mensagem" });
    await expect(dialog).toContainText("Sai pelo WhatsApp oficial do espaço.");
    await dialog.getByRole("combobox", { name: "Aluno" }).click();
    await page.getByRole("option", { name: /Aluno A20/ }).click();
    await dialog.getByLabel("Mensagem").fill("Aula extra no sábado.");
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(dialog).toBeHidden();

    await openTab(page, "Histórico");
    await expect(page.getByRole("button", { name: "Mensagem para Aluno A20", exact: true })).toContainText("Entregue");
    await expect(page.getByText("Enviadas no mês", { exact: true })).toBeVisible();
    expect(popups).toBe(0);
  });

  test("Pro sem telefone do espaço não conecta", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        (t.organization as Record<string, unknown>).subscription = { tier: "pro" };
      },
    });
    await page.goto("/communication");
    await openTab(page, "Conexão");
    await expect(page.getByText("Cadastre o telefone do espaço em Configurações antes de conectar.")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByRole("button", { name: "Conectar WhatsApp oficial" })).toBeDisabled();
    // Continua no envio assistido, sem conexao.
    await expect(page.getByText("Mensagens prontas que abrem no WhatsApp do seu espaço.")).toBeVisible();
    await expect(page.getByText("WhatsApp oficial conectado")).toHaveCount(0);
  });
});
