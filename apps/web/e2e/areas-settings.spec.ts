import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { editWorld, expect, seedAcademy, skipWelcome, test } from "./fixtures";
import { AREAS, CUSTOM_BILLINGS, CUSTOM_PROGRESSIONS, ORG, readTenant, waitForStore, type Tenant } from "./areas-helpers";

/**
 * Configuracoes por area: "Área do espaço" (e os textos das mensagens que
 * acompanham enquanto estao no padrao), "Outra área", Regras da mensalidade,
 * "Planos e pacotes", Plano GestaraHub e o modelo de certificado (Pro).
 * Relogio do navegador: terca 22/09/2026.
 */

test.describe.configure({ timeout: 60_000 });

const MARTIAL_WELCOME = "Nos vemos no tatame!";
const OTHER_WELCOME = "Até a primeira aula!";

async function chooseArea(page: Page, label: string) {
  await page.getByRole("combobox", { name: /Área do espaço/ }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await expect(page.getByRole("combobox", { name: /Área do espaço/ })).toContainText(label);
}

/** "Salvar" da barra da aba Geral (aparece so com alteracao). */
const generalSave = (page: Page) =>
  page.locator("#settings-panel-geral").getByRole("button", { name: "Salvar", exact: true });

async function saveSettings(page: Page) {
  await generalSave(page).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();
}

const templateTexts = (t: Tenant): string[] => t.messageTemplates.map((m: { content: string }) => m.content);

/** Previas da aba Mensagens de Comunicação. */
async function messagesPanel(page: Page) {
  await page.goto("/communication");
  await page.getByRole("tab", { name: "Mensagens" }).click();
  await expect(page.getByRole("tab", { name: "Mensagens" })).toHaveAttribute("aria-selected", "true");
  return page.getByRole("tabpanel");
}

// ===========================================================================
// 1. Área do espaço
// ===========================================================================
test.describe("Configurações: Área do espaço", () => {
  for (const area of AREAS.filter((a) => a.id !== "martial_arts")) {
    test(`trocar Lutas por ${area.label} grava a área e tira o "tatame" das mensagens`, async ({ page }) => {
      await seedAcademy(page);
      expect(templateTexts(await readTenant(page)).join(" ")).toContain(MARTIAL_WELCOME);
      await page.goto("/settings");
      await expect(page.getByText("Muda padrões de novas turmas e palavras das telas.")).toBeVisible();
      await chooseArea(page, area.label);
      // Area da lista nao pede nome nem trilha.
      await expect(page.getByLabel("O que você ensina?")).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: /Como seus alunos avançam/ })).toHaveCount(0);
      await saveSettings(page);

      await waitForStore(page, (t) => t.organization.classSegment === area.id);
      const tenant = await readTenant(page);
      expect(tenant.organization.segment).toBe(area.label);
      expect(tenant.organization.customSegmentName).toBeUndefined();
      const texts = templateTexts(tenant).join("\n");
      expect(texts).not.toContain("tatame");
      expect(texts).not.toContain("Bons treinos");
      expect(texts).toContain(OTHER_WELCOME);

      const panel = await messagesPanel(page);
      await expect(panel).toContainText(OTHER_WELCOME);
      await expect(panel).not.toContainText("tatame");

      // A nova turma ja abre com as vagas da area.
      await page.goto("/classes");
      await page.getByRole("button", { name: "Nova turma" }).first().click();
      await expect(page.getByRole("dialog", { name: "Nova turma" }).getByLabel("Capacidade (vagas)")).toHaveValue(
        String(area.capacity),
      );

      await page.goto("/settings");
      await expect(page.getByRole("combobox", { name: /Área do espaço/ })).toContainText(area.label);
    });
  }

  test("mensagem editada não muda com a área; as do padrão voltam ao tom de lutas", async ({ page }) => {
    await seedAcademy(page);
    const own = "Oi, {aluno}! Bem-vindo ao nosso tatame.";
    await editWorld(page, ORG, (t) => {
      const welcome = t.messageTemplates.find((m: { content: string }) => m.content.includes(MARTIAL_WELCOME));
      welcome.content = own;
    });
    await page.goto("/settings");
    await chooseArea(page, "Dança");
    await saveSettings(page);
    await waitForStore(page, (t) => t.organization.classSegment === "dance");
    let texts = templateTexts(await readTenant(page));
    expect(texts).toContain(own);
    expect(texts.filter((c) => c !== own).join(" ")).not.toContain("tatame");
    expect(texts.join(" ")).toContain("nas últimas aulas da {empresa}. Seu lugar na turma está guardado!");

    await page.reload();
    await chooseArea(page, "Lutas");
    await saveSettings(page);
    await waitForStore(page, (t) => t.organization.classSegment === "martial_arts");
    texts = templateTexts(await readTenant(page));
    expect(texts).toContain(own);
    expect(texts.join(" ")).toContain("Seu lugar no tatame está guardado!");
    expect(texts.join(" ")).toContain("Bons treinos!");
    expect(texts.join(" ")).not.toContain(OTHER_WELCOME);
  });

  test("trocar entre duas áreas que não são de lutas mantém os textos de aula", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/settings");
    await chooseArea(page, "Música");
    await saveSettings(page);
    await waitForStore(page, (t) => t.organization.classSegment === "music");
    await chooseArea(page, "Gastronomia");
    await saveSettings(page);
    await waitForStore(page, (t) => t.organization.classSegment === "gastronomy");
    const texts = templateTexts(await readTenant(page)).join(" ");
    expect(texts).toContain(OTHER_WELCOME);
    expect(texts).not.toContain("tatame");
  });
});

// ===========================================================================
// 2. Outra área
// ===========================================================================
test.describe("Configurações: Outra área", () => {
  for (const [i, progression] of CUSTOM_PROGRESSIONS.entries()) {
    // Pares diferentes dos do setup: cada trilha com outra forma de cobrar.
    const billing = CUSTOM_BILLINGS[(i + 1) % CUSTOM_BILLINGS.length];
    test(`${progression.label} + ${billing.label}: grava nome, trilha e cobrança`, async ({ page }) => {
      await seedAcademy(page);
      await page.goto("/settings");
      await chooseArea(page, "Outra área");
      await expect(page.getByText("Muda a trilha sugerida e as palavras das telas.")).toBeVisible();
      await expect(page.getByText("É só o padrão: cada turma pode cobrar diferente.")).toBeVisible();
      // Padroes: sem etapas e mensalidade.
      await expect(page.getByRole("combobox", { name: /Como seus alunos avançam/ })).toContainText("Não avançam");
      await expect(page.getByRole("combobox", { name: /Como você cobra/ })).toContainText("Mensalidade");

      await page.getByLabel("O que você ensina?").fill("Fotografia");
      await page.getByRole("combobox", { name: /Como seus alunos avançam/ }).click();
      await page.getByRole("menuitem", { name: progression.label, exact: true }).click();
      await page.getByRole("combobox", { name: /Como você cobra/ }).click();
      await page.getByRole("menuitem", { name: billing.label, exact: true }).click();
      await saveSettings(page);

      await waitForStore(page, (t) => t.organization.classSegment === "custom");
      expect((await readTenant(page)).organization).toMatchObject({
        segment: "Fotografia",
        customSegmentName: "Fotografia",
        customSegmentProgression: progression.value,
        customSegmentBilling: billing.value,
      });
      await page.reload();
      await expect(page.getByLabel("O que você ensina?")).toHaveValue("Fotografia");
      await expect(page.getByRole("combobox", { name: /Como seus alunos avançam/ })).toContainText(progression.label);
      await expect(page.getByRole("combobox", { name: /Como você cobra/ })).toContainText(billing.label);
    });
  }

  test("nome da área é obrigatório", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/settings");
    await chooseArea(page, "Outra área");
    await generalSave(page).click();
    await expect(page.getByText("Informe o que você ensina.")).toBeVisible();
    await expect(page.getByText("Revise os campos destacados.")).toBeVisible();
    await expect(page.getByLabel("O que você ensina?")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Configurações salvas.")).toHaveCount(0);
    // So espacos tambem nao vale.
    await page.getByLabel("O que você ensina?").fill("   ");
    await generalSave(page).click();
    await expect(page.getByText("Informe o que você ensina.")).toBeVisible();
    expect((await readTenant(page)).organization.classSegment).not.toBe("custom");
  });

  test("voltar da Outra área para uma área da lista apaga nome, trilha e cobrança próprios", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.organization.classSegment = "custom";
        t.organization.segment = "Teatro";
        t.organization.customSegmentName = "Teatro";
        t.organization.customSegmentProgression = "levels";
        t.organization.customSegmentBilling = "package";
      },
    });
    await page.goto("/settings");
    await expect(page.getByLabel("O que você ensina?")).toHaveValue("Teatro");
    await chooseArea(page, "Idiomas e reforço");
    await expect(page.getByLabel("O que você ensina?")).toHaveCount(0);
    await saveSettings(page);
    await waitForStore(page, (t) => t.organization.classSegment === "languages");
    const org = (await readTenant(page)).organization;
    expect(org.segment).toBe("Idiomas e reforço");
    expect(org.customSegmentName).toBeUndefined();
    expect(org.customSegmentProgression).toBeUndefined();
    expect(org.customSegmentBilling).toBeUndefined();
  });
});

// ===========================================================================
// 3. Regras da mensalidade, Planos e pacotes, Plano GestaraHub
// ===========================================================================
test("Regras da mensalidade: valem só para mensalidade e as dicas acompanham a escolha", async ({ page }) => {
  await seedAcademy(page);
  // Aba propria desde 31/10/2026 (antes um bloco da Geral).
  await page.goto("/settings?tab=cobranca");
  const card = page.locator("#billing-rules");
  await expect(
    card.getByText("Só para mensalidades. Curso, pacote e avulso têm valor e vencimento próprios."),
  ).toBeVisible();
  await expect(card.getByText("Quando a mensalidade vence.")).toBeVisible();
  await expect(card.getByText("Como fica a 1ª cobrança.")).toBeVisible();
  await expect(card.getByText("Todos os alunos vencem no mesmo dia.")).toBeVisible();

  await card.getByRole("radio", { name: /^Mês cheio/ }).click();
  await expect(card.getByText("Vence todo mês no dia da matrícula.")).toBeVisible();
  await expect(card.getByText("Automático (dia da matrícula)")).toBeVisible();
  await card.getByRole("radio", { name: /^Depois do uso/ }).click();
  await page.locator("#settings-panel-cobranca").getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Regras da mensalidade salvas.")).toBeVisible();
  await waitForStore(page, (t) => t.organization.settings.billingTiming === "postpaid");
  expect((await readTenant(page)).organization.settings.midMonthStrategy).toBe("full_cycle");
});

test("menu e tela \"Planos e pacotes\"", async ({ page }) => {
  await seedAcademy(page);
  await skipWelcome(page);
  await page.goto("/dashboard");
  // Cadastros ficam no contexto "Gestão" do menu.
  await page.getByRole("button", { name: "Gestão" }).click();
  const link = page.getByRole("link", { name: "Planos e pacotes", exact: true });
  await expect(link).toBeVisible();
  await expect(page.getByRole("link", { name: "Planos", exact: true })).toHaveCount(0);
  await link.click();
  // Primeira abertura da tela no servidor de dev compila a rota.
  await expect(page).toHaveURL(/\/classes\/plans$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Planos e pacotes", level: 1 })).toBeVisible();
  await expect(page.getByText("Mensalidades e pacotes de aulas.")).toBeVisible();
});

/**
 * Plano Profissional no banco: o plano pago so e gravado pelo servidor (achado
 * 66), entao a conta real nao tem o botao de demonstracao. O pagamento do plano
 * e a troca estao em `plano-gestarahub.spec.ts`.
 */
async function activatePro(page: Page) {
  await editWorld(page, ORG, (t) => {
    t.organization.subscription = { tier: "pro", interval: "monthly", status: "active", paymentMethod: "pix", priceCents: 7990, asaasSubscriptionId: "sub_mock_e2e", renewsOn: "2026-10-12", nextDueDate: "2026-10-12", changedAt: "2026-09-12T12:00:00.000Z" };
  });
  await page.goto("/settings?tab=plano");
}

test("Plano GestaraHub: o Grátis assina pelo checkout; o Pro volta ao Grátis no fim do período", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings?tab=plano");
  const panel = page.locator("#settings-panel-plano");
  await expect(panel).toContainText("O cadastro e a operação do dia a dia são grátis.");
  await expect(panel.getByText("Certificado de conclusão", { exact: true })).toBeVisible();
  await expect(panel.getByText("Certificado de conclusão do curso para imprimir ou salvar em PDF.")).toBeVisible();
  // Conta real: nada de botão de demonstração, e o pagamento online ja e do Gratis.
  await expect(panel.getByRole("button", { name: "Ativar Profissional (demonstração)" })).toHaveCount(0);
  await expect(panel.getByText("Pagamento online", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Assinar o Profissional" })).toHaveAttribute(
    "href",
    "/plans/checkout?tier=pro&interval=monthly",
  );
  expect((await readTenant(page)).organization.subscription?.tier ?? "free").toBe("free");

  await activatePro(page);
  await expect(panel).toContainText("Sua organização tem todos os recursos do Profissional.");
  await panel.getByRole("button", { name: "Voltar ao Grátis" }).click();
  const back = page.getByRole("dialog", { name: "Voltar ao Grátis?" });
  await expect(back).toContainText("Volta ao Grátis em");
  // Cancelar nao troca nada.
  await back.getByRole("button", { name: "Cancelar" }).click();
  await expect(panel.getByRole("button", { name: "Voltar ao Grátis" })).toBeVisible();
});

// ===========================================================================
// 4. Certificado
// ===========================================================================
const FILE_DATE = new Date("2026-09-20T10:00:00Z");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Arquivos de teste gravados com data fixa (o campo deduplica por data). */
async function logoFiles(testInfo: TestInfo) {
  const dir = testInfo.outputPath("logos");
  await mkdir(dir, { recursive: true });
  const files = {
    png: { name: "logo.png", buffer: PNG_1X1 },
    // PNG valido no cabecalho, mas com 1,5 MB (passa do limite de 1 MB).
    big: { name: "logo-grande.png", buffer: Buffer.concat([PNG_1X1, Buffer.alloc(1.5 * 1024 * 1024)]) },
    txt: { name: "notas.txt", buffer: Buffer.from("nao e imagem") },
  };
  const out = {} as Record<keyof typeof files, string>;
  for (const [key, file] of Object.entries(files) as [keyof typeof files, { name: string; buffer: Buffer }][]) {
    const target = path.join(dir, file.name);
    await writeFile(target, file.buffer);
    await utimes(target, FILE_DATE, FILE_DATE);
    out[key] = target;
  }
  return out;
}

const DEFAULT_BODY_PREVIEW =
  "Certificamos que Ana Souza concluiu o curso Confeitaria Básica, de 04/08/2026 a 22/09/2026, que teve 8 aulas, com frequência de 92%.";

test.describe("Configurações: Certificado", () => {
  test("Plano Grátis: aba com o cadeado e o caminho para o Pro", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/settings?tab=certificado");
    const panel = page.locator("#settings-panel-certificado");
    await expect(panel.getByText("Disponível no Plano Profissional")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Modelo de certificado" })).toBeVisible();
    await expect(panel.getByText("Modelo de certificado no Plano Profissional.")).toBeVisible();
    await expect(panel.getByRole("textbox")).toHaveCount(0);
    const cta = panel.getByRole("link", { name: "Ver Plano Profissional" });
    await expect(cta).toHaveAttribute("href", "/settings?tab=plano");
    await cta.click();
    await expect(page).toHaveURL(/tab=plano/);
    await expect(page.getByRole("link", { name: "Assinar o Profissional" })).toBeVisible();
  });

  async function openEditor(page: Page) {
    await seedAcademy(page);
    await activatePro(page);
    await page.goto("/settings?tab=certificado");
    const panel = page.locator("#settings-panel-certificado");
    await expect(panel.getByText("Aparência", { exact: true })).toBeVisible();
    return panel;
  }

  test("Pro: layouts, cores e prévia ao vivo", async ({ page }) => {
    const panel = await openEditor(page);
    const sheet = panel.locator("article.certificate-sheet");
    await expect(sheet).toContainText("Certificado de conclusão");
    await expect(sheet).toContainText(DEFAULT_BODY_PREVIEW);
    await expect(sheet).toContainText("Carla Mendes");
    await expect(panel.getByText("Dados de exemplo.")).toBeVisible();

    const layouts = panel.getByRole("radiogroup", { name: "Layout" }).getByRole("radio");
    // Classico, Moderno, Limpo e Minha arte (31/10/2026).
    await expect(layouts).toHaveCount(4);
    await expect(panel.getByRole("radio", { name: /^Clássico/ })).toHaveAttribute("aria-checked", "true");
    const classicHtml = await sheet.innerHTML();
    for (const name of ["Moderno", "Limpo", "Minha arte"]) {
      await panel.getByRole("radio", { name: new RegExp(`^${name}`) }).click();
      await expect(panel.getByRole("radio", { name: new RegExp(`^${name}`) })).toHaveAttribute("aria-checked", "true");
      expect(await sheet.innerHTML()).not.toBe(classicHtml);
      await expect(sheet).toContainText(DEFAULT_BODY_PREVIEW);
    }
    // A cor de destaque nao vale em "Minha arte": volta ao Classico para conferir a paleta.
    await panel.getByRole("radio", { name: /^Clássico/ }).click();

    const colors = panel.getByRole("radiogroup", { name: "Cor" }).getByRole("radio");
    await expect(colors).toHaveCount(6);
    const swatches: [string, string][] = [
      ["Azul-marinho", "#1e3a8a"],
      ["Verde", "#166534"],
      ["Vinho", "#881337"],
      ["Dourado", "#a16207"],
      ["Roxo", "#5b21b6"],
      ["Grafite", "#3f3f46"],
    ];
    for (const [label, hex] of swatches) {
      await panel.getByRole("radio", { name: label, exact: true }).click();
      await expect(panel.getByRole("radio", { name: label, exact: true })).toHaveAttribute("aria-checked", "true");
      await expect(sheet).toHaveAttribute("style", new RegExp(`--cert-accent: ${hex}`));
    }
    // A ultima cor da lista e a padrao: muda para uma que nao e, para a barra de salvar aparecer.
    await panel.getByRole("radio", { name: "Verde", exact: true }).click();
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
  });

  test("Pro: variáveis entram onde está o cursor e a frequência pode sair", async ({ page }) => {
    const panel = await openEditor(page);
    const body = panel.locator("#certificate-body");
    const sheet = panel.locator("article.certificate-sheet");
    await body.fill("Parabéns, ");
    await panel.getByRole("button", { name: "+ Aluno" }).click();
    await expect(body).toHaveValue("Parabéns, {aluno}");
    await body.press("End");
    await body.pressSequentially(". Curso: ");
    await panel.getByRole("button", { name: "+ Curso" }).click();
    await expect(body).toHaveValue("Parabéns, {aluno}. Curso: {curso}");
    // Cursor no inicio: a variavel entra antes do texto. Espera o quadro em que o
    // app devolve o cursor para depois da variavel anterior (senao ele vence a corrida).
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
    await panel.getByRole("button", { name: "+ Professor" }).click();
    await expect(body).toHaveValue("{professor}Parabéns, {aluno}. Curso: {curso}");
    await expect(sheet).toContainText("Carla MendesParabéns, Ana Souza. Curso: Confeitaria Básica");
    // Sem cidade nos dados de exemplo: a frase com {cidade} sai da previa.
    await body.fill("Emitido em {cidade}. Parabéns, {aluno}.");
    await expect(sheet).toContainText("Parabéns, Ana Souza.");
    await expect(sheet).not.toContainText("Emitido em");

    // Todas as variaveis viram chip.
    for (const label of ["Aluno", "Curso", "Início", "Fim", "Aulas", "Carga horária", "Frequência", "Professor", "Nome do espaço", "Cidade", "Data de emissão"]) {
      await expect(panel.getByRole("button", { name: `+ ${label}`, exact: true })).toBeVisible();
    }

    // Frequencia desligada: o trecho sai da previa.
    await body.fill("Certificamos que {aluno} concluiu o curso {curso}, com {aulas} e frequência de {frequencia}.");
    await expect(sheet).toContainText("com 8 aulas e frequência de 92%.");
    const attendance = panel.getByRole("switch", { name: "Mostrar frequência" });
    await expect(attendance).toBeChecked();
    await attendance.click();
    await expect(attendance).not.toBeChecked();
    await expect(sheet).toContainText("Certificamos que Ana Souza concluiu o curso Confeitaria Básica, com 8 aulas.");
    await expect(sheet).not.toContainText("92%");
  });

  test("Pro: validação de título, texto, variável desconhecida e assinatura", async ({ page }) => {
    const panel = await openEditor(page);
    await panel.getByLabel("Título").fill("");
    await panel.locator("#certificate-body").fill("");
    // "Outro nome" abre o campo do nome, vazio.
    await expect(panel.locator("#signature-0-signer")).toContainText("Professor da turma");
    await expect(panel.locator("#signature-0-name")).toHaveCount(0);
    await panel.locator("#signature-0-signer").click();
    await page.getByRole("option", { name: "Outro nome" }).click();
    await expect(panel.locator("#signature-0-name")).toHaveValue("");
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(panel.getByText("Informe o título.")).toBeVisible();
    await expect(panel.getByText("Escreva o texto do certificado.")).toBeVisible();
    await expect(panel.getByText("Informe o nome.")).toBeVisible();
    await expect(page.getByText("Modelo de certificado salvo.")).toHaveCount(0);

    await panel.getByLabel("Título").fill("Certificado {premio}");
    await panel.locator("#certificate-body").fill("Parabéns, {aluno}! Nota {nota} e {nota}.");
    await panel.locator("#signature-0-name").fill("{diretor}");
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    const use = "Use: {aluno}, {curso}, {inicio}, {fim}, {aulas}, {carga_horaria}, {frequencia}, {professor}, {empresa}, {cidade}, {data}.";
    await expect(panel.getByText(`Variável desconhecida: {premio}. ${use}`)).toBeVisible();
    await expect(panel.getByText(`Variável desconhecida: {nota}. ${use}`)).toBeVisible();
    await expect(panel.getByText(`Variável desconhecida: {diretor}. ${use}`)).toBeVisible();
    await expect(page.getByText("Modelo de certificado salvo.")).toHaveCount(0);
    expect((await readTenant(page)).certificateTemplate).toBeUndefined();

    // Assinaturas: no maximo 2; com 1 sobrando, some o "Remover".
    await expect(panel.getByRole("button", { name: "Adicionar assinatura" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Remover assinatura" }).first().click();
    await expect(panel.getByRole("button", { name: "Remover assinatura" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Adicionar assinatura" })).toBeVisible();
  });

  test("Pro: \"Ver em PDF\" gera a prévia do modelo em edição sem salvar", async ({ page }) => {
    const panel = await openEditor(page);
    await expect(panel.getByRole("button", { name: "Ver em PDF" })).toBeVisible();
    // A rota devolve o PDF com o modelo que veio do navegador e nao grava nada.
    const res = await page.request.post("/api/documents/certificates/preview", {
      data: {
        template: {
          layout: "modern",
          accentColor: "green",
          title: "Certificado de participação",
          body: "Parabéns, {aluno}, pelo curso {curso}.",
          signatures: [{ name: "{professor}", role: "Instrutor" }],
          showAttendance: true,
        },
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect((await readTenant(page)).certificateTemplate).toBeUndefined();
    // Modelo invalido: o erro do servico, sem PDF.
    const bad = await page.request.post("/api/documents/certificates/preview", {
      data: { template: { layout: "modern", accentColor: "green", title: "", body: "x", signatures: [], showAttendance: true } },
    });
    expect(bad.status()).toBe(422);
  });

  test("Pro: modelo por modalidade, com volta ao modelo do espaço", async ({ page }) => {
    const panel = await openEditor(page);
    const scope = panel.locator("#certificate-scope");
    await expect(scope).toContainText("Todo o espaço");
    await scope.click();
    await page.getByRole("option", { name: "Jiu-Jitsu", exact: true }).click();
    await expect(panel.getByText("Usa o modelo do espaço. Mude algo e salve para ter o próprio.")).toBeVisible();

    await panel.getByLabel("Título").fill("Certificado de Jiu-Jitsu");
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
    await waitForStore(page, (t) => t.categories.find((c: { id: string }) => c.id === "m-jj")?.certificateTemplate?.title === "Certificado de Jiu-Jitsu");
    // O do espaco nao mudou.
    expect((await readTenant(page)).certificateTemplate).toBeUndefined();
    await expect(scope).toContainText("Jiu-Jitsu · modelo próprio");
    const back = panel.getByRole("button", { name: "Usar o modelo do espaço" });
    await expect(back).toBeVisible();

    // Trocar com alteracao nao salva pergunta antes.
    await panel.getByLabel("Título").fill("Rascunho");
    await scope.click();
    await page.getByRole("option", { name: "Todo o espaço" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Alterações não salvas" });
    await confirm.getByRole("button", { name: "Continuar editando" }).click();
    await expect(panel.getByLabel("Título")).toHaveValue("Rascunho");
    await scope.click();
    await page.getByRole("option", { name: "Todo o espaço" }).click();
    await confirm.getByRole("button", { name: "Trocar mesmo assim" }).click();
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de conclusão");

    // Volta a modalidade ao modelo do espaco, com confirmacao.
    await scope.click();
    await page.getByRole("option", { name: /^Jiu-Jitsu · modelo próprio/ }).click();
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de Jiu-Jitsu");
    await back.click();
    await page.getByRole("alertdialog", { name: "Usar o modelo do espaço?" }).getByRole("button", { name: "Usar o do espaço" }).click();
    await expect(page.getByText("Jiu-Jitsu voltou ao modelo do espaço.")).toBeVisible();
    await waitForStore(page, (t) => !t.categories.find((c: { id: string }) => c.id === "m-jj")?.certificateTemplate);
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de conclusão");
    await expect(scope).toContainText("Jiu-Jitsu");
    await expect(scope).not.toContainText("modelo próprio");
  });

  test("Pro: Minha arte com posição, cor do texto e partes escondidas, salva e emitida", async ({ page }, testInfo) => {
    const files = await logoFiles(testInfo);
    const panel = await openEditor(page);
    const sheet = panel.locator("article.certificate-sheet");
    await panel.getByRole("radio", { name: /^Minha arte/ }).click();
    // Sem a cor de destaque; com o bloco da arte.
    await expect(panel.getByRole("radiogroup", { name: "Cor", exact: true })).toHaveCount(0);
    await expect(panel.getByText("Arte de fundo", { exact: true })).toBeVisible();
    await expect(sheet).toContainText(DEFAULT_BODY_PREVIEW);

    // Salvar sem a imagem avisa.
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(panel.getByText("Envie a arte de fundo.")).toBeVisible();

    // Dois campos de arquivo (logo em Aparencia e a arte): o da arte.
    await panel.locator("input[type=file]#artwork").setInputFiles(files.png);
    await expect(sheet.locator("img")).toHaveAttribute("src", /^blob:/);
    await panel.getByRole("radio", { name: "Embaixo" }).click();
    await panel.getByRole("radio", { name: /^Claro/ }).click();
    await panel.getByRole("switch", { name: "Título" }).click();
    await expect(sheet).not.toContainText("Certificado de conclusão");
    await expect(sheet).toContainText(DEFAULT_BODY_PREVIEW);
    // Esconder o texto tambem seria um certificado vazio.
    await panel.getByRole("switch", { name: "Texto" }).click();
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(panel.getByText("Mostre pelo menos o título ou o texto.")).toBeVisible();
    await panel.getByRole("switch", { name: "Texto" }).click();

    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
    await waitForStore(page, (t) => t.certificateTemplate?.layout === "custom");
    const saved = (await readTenant(page)).certificateTemplate;
    expect(saved.artwork).toMatchObject({ textPosition: "bottom", ink: "light", hidden: ["title"] });
    expect(saved.artwork.fileId).toBeTruthy();

    // Recarregado: a arte atual, os ajustes e a previa com a imagem.
    await page.reload();
    await expect(panel.getByText("Arte atual")).toBeVisible();
    await expect(panel.getByRole("radio", { name: "Embaixo" })).toHaveAttribute("aria-checked", "true");
    await expect(panel.getByRole("switch", { name: "Título" })).not.toBeChecked();
    await expect(sheet.locator("img")).toHaveAttribute("src", /^(blob:|\/api\/attachments\/)/);
  });

  test("Pro: logo válida, recusada por formato e por tamanho", async ({ page }, testInfo) => {
    const files = await logoFiles(testInfo);
    const panel = await openEditor(page);
    const input = panel.locator("input[type=file]");
    const list = panel.getByRole("list", { name: "Arquivos anexados" });
    const sheet = panel.locator("article.certificate-sheet");
    await expect(sheet.locator("img")).toHaveCount(0);

    await input.setInputFiles(files.txt);
    await expect(list).toContainText("Formato não aceito (use imagem).");
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(panel.getByText("Remova “notas.txt”: formato não aceito (use imagem).")).toBeVisible();
    await expect(page.getByText("Modelo de certificado salvo.")).toHaveCount(0);
    await expect(sheet.locator("img")).toHaveCount(0);
    await panel.getByRole("button", { name: "Remover notas.txt" }).click();

    await input.setInputFiles(files.big);
    await expect(list).toContainText("Arquivo maior que 1 MB.");
    await expect(sheet.locator("img")).toHaveCount(0);
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(panel.getByText("Remova “logo-grande.png”: arquivo maior que 1 MB.")).toBeVisible();
    await panel.getByRole("button", { name: "Remover logo-grande.png" }).click();

    await input.setInputFiles(files.png);
    await expect(list).toContainText("PNG ·");
    await expect(sheet.locator("img")).toHaveAttribute("src", /^(blob:|\/api\/attachments\/)/);
  });

  test("Pro: salvar, recarregar, remover a logo e voltar ao texto padrão com confirmação", async ({ page }, testInfo) => {
    const files = await logoFiles(testInfo);
    const panel = await openEditor(page);
    const restore = panel.getByRole("button", { name: "Voltar ao texto padrão" });
    const save = panel.getByRole("button", { name: "Salvar", exact: true });
    // Texto padrao e sem mudancas: sem link de voltar e sem barra de salvar.
    await expect(restore).toHaveCount(0);
    await expect(save).toHaveCount(0);

    await panel.getByRole("radio", { name: /^Moderno/ }).click();
    await panel.getByRole("radio", { name: "Verde", exact: true }).click();
    await panel.getByLabel("Título").fill("Certificado de participação");
    await panel.getByRole("switch", { name: "Mostrar frequência" }).click();
    await panel.locator("#signature-1-role").fill("Diretora");
    await panel.locator("input[type=file]").setInputFiles(files.png);
    await expect(restore).toBeVisible();
    await save.click();
    await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
    await waitForStore(page, (t) => t.certificateTemplate?.layout === "modern");
    const saved = (await readTenant(page)).certificateTemplate;
    expect(saved).toMatchObject({
      layout: "modern",
      accentColor: "green",
      title: "Certificado de participação",
      showAttendance: false,
      signatures: [
        { name: "{professor}", role: "Instrutor" },
        { name: "{empresa}", role: "Diretora" },
      ],
    });
    expect(saved.logoFileId).toBeTruthy();

    await page.reload();
    await expect(panel.getByRole("radio", { name: /^Moderno/ })).toHaveAttribute("aria-checked", "true");
    await expect(panel.getByRole("radio", { name: "Verde", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de participação");
    await expect(panel.getByRole("switch", { name: "Mostrar frequência" })).not.toBeChecked();
    await expect(panel.getByText("Logo atual")).toBeVisible();
    await expect(panel.locator("article.certificate-sheet img")).toHaveAttribute("src", /^(blob:|\/api\/attachments\/)/);
    await expect(save).toHaveCount(0);

    // Remover a logo so vale ao salvar.
    await panel.getByRole("button", { name: "Remover", exact: true }).click();
    await expect(panel.getByText("Logo atual")).toHaveCount(0);
    await expect(panel.locator("article.certificate-sheet img")).toHaveCount(0);
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();

    // Voltar ao texto padrao pede confirmacao; Cancelar nao mexe.
    await restore.click();
    const confirm = page.getByRole("alertdialog", { name: "Voltar ao texto padrão?" });
    await expect(confirm).toContainText("O título e o texto do certificado voltam ao padrão. Salve para valer.");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de participação");

    // Confirmado: so o titulo e o texto voltam, no rascunho; o resto fica.
    await restore.click();
    await confirm.getByRole("button", { name: "Voltar ao padrão" }).click();
    await expect(panel.getByLabel("Título")).toHaveValue("Certificado de conclusão");
    // Texto padrao, mas a frequencia continua desligada: o trecho dela sai da previa.
    await expect(panel.locator("article.certificate-sheet")).toContainText(
      "Certificamos que Ana Souza concluiu o curso Confeitaria Básica, de 04/08/2026 a 22/09/2026, que teve 8 aulas.",
    );
    await expect(restore).toHaveCount(0);
    await expect(panel.getByRole("radio", { name: /^Moderno/ })).toHaveAttribute("aria-checked", "true");
    await save.click();
    await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
    await waitForStore(page, (t) => t.certificateTemplate?.title === "Certificado de conclusão");
    const restored = (await readTenant(page)).certificateTemplate;
    expect(restored).toMatchObject({ layout: "modern", accentColor: "green", showAttendance: false });
    expect(restored.logoFileId).toBeUndefined();
    await expect(save).toHaveCount(0);
  });

  test("Pro: alteração não salva pede confirmação ao trocar de aba", async ({ page }) => {
    const panel = await openEditor(page);
    await panel.getByLabel("Título").fill("Título novo");
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
    await page.getByRole("tab", { name: /Geral/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "Alterações não salvas" });
    await expect(confirm).toContainText("Você tem alterações não salvas na aba Certificado");
    await confirm.getByRole("button", { name: "Continuar editando" }).click();
    await expect(page).toHaveURL(/tab=certificado/);
    await expect(panel.getByLabel("Título")).toHaveValue("Título novo");

    await page.getByRole("tab", { name: /Geral/ }).click();
    await confirm.getByRole("button", { name: "Trocar de aba" }).click();
    await expect(page).toHaveURL(/tab=geral/);
    expect((await readTenant(page)).certificateTemplate).toBeUndefined();
  });
});
