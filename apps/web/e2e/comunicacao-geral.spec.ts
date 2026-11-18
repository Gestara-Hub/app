import type { Page } from "@playwright/test";
import { expect, openProfileSection, seedAcademy, student, test } from "./fixtures";
import { loginAsUser, user } from "./ficha-notas-fixtures";
import { TS, openedWhatsApp, waitWorld, type Tenant } from "./geral-fixtures";

/**
 * Comunicacao em geral (docs/product/13 secao 5): envio assistido a partir de
 * varios lugares (cadastro do aluno, ficha, cobranca avulsa), edicao dos
 * modelos, historico com filtros e detalhe, e o modo oficial do Pro (ligar e
 * desligar automaticos, horario de envio, reenviar falha, desconectar).
 * Hoje e terca 22/09/2026.
 */

const ORG = "org-academia-x";
const ATTENDANT = user("usr-att", "Bia Recepção", "attendant");

function log(id: string, over: Record<string, unknown>) {
  return {
    id,
    organizationId: ORG,
    recipientName: "Aluno A20",
    recipientPhone: "5511977770000",
    trigger: "billing_after_due",
    category: "billing",
    content: "Oi, Aluno A20! Sua mensalidade venceu.",
    status: "opened",
    clientId: "c-a",
    sentAt: "2026-09-21T15:00:00.000Z",
    ...over,
  };
}

const LOGS = [
  log("l-1", {}),
  log("l-2", {
    recipientName: "Bruna Lima",
    recipientPhone: "5511988881111",
    trigger: "birthday_greeting",
    category: "retention",
    content: "Parabéns pelo seu dia, Bruna Lima! 🎂",
    clientId: "c-b",
    sentAt: "2026-09-20T12:00:00.000Z",
    status: "delivered",
  }),
  log("l-3", {
    recipientName: "Carla Souza",
    recipientPhone: "5511966662222",
    trigger: "manual_broadcast",
    category: "retention",
    content: "Aula extra no sábado.",
    clientId: "c-c",
    sentAt: "2026-09-19T12:00:00.000Z",
    status: "failed",
    errorReason: "Número sem WhatsApp",
  }),
];

async function seedComm(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [
        student("c-a", "Aluno A20"),
        student("c-b", "Bruna Lima", { planId: undefined, phone: "11988881111" }),
        student("c-c", "Carla Souza", { planId: undefined, phone: "11966662222" }),
      ];
      extra?.(t);
    },
  });
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
}

/** Pro com o WhatsApp oficial ja conectado (numero do espaco cadastrado). */
const officialConnected = (t: Tenant) => {
  t.organization.subscription = { tier: "pro" };
  t.unit.phone = "1140028922";
  t.whatsAppConnection = {
    organizationId: ORG,
    officialStatus: "connected",
    phoneNumber: "551140028922",
    displayName: "Academia X",
    connectedAt: TS,
    allowedSendHours: { start: "08:00", end: "20:00" },
    monthlyQuota: { used: 0, included: 1000 },
  };
};

async function openTab(page: Page, name: "Mensagens" | "Histórico" | "Conexão") {
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

const logsInWorld = (n: number) => (t: Tenant) => (t.messageLogs ?? []).length === n;

test.describe("envio assistido de vários lugares", () => {
  test("boas-vindas pelo aviso de aluno criado", async ({ page }) => {
    await seedComm(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Novo aluno" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Novo aluno" });
    // Os modelos de mensagem carregam com o formulario (o aviso so oferece as
    // boas-vindas com eles prontos); ninguem cadastra em menos de 1 segundo.
    await page.waitForTimeout(1000);
    await dialog.getByLabel("Nome").fill("Diego Novo");
    await dialog.getByLabel("Telefone (WhatsApp)").fill("11955554444");
    await dialog.getByRole("radio", { name: /^Não paga mensalidade/ }).click();
    // Chave de boas-vindas no topo do cadastro (04/11/2026): comeca desligada; ligada, o aviso oferece o envio.
    const welcome = dialog.getByRole("switch", { name: "Enviar boas-vindas no WhatsApp" });
    await expect(welcome).not.toBeChecked();
    await welcome.click();
    await expect(welcome).toBeChecked();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Aluno criado com sucesso.")).toBeVisible();

    const link = await openedWhatsApp(page, () => page.getByRole("button", { name: "Enviar boas-vindas" }).click());
    expect(link.phone).toBe("5511955554444");
    expect(link.text).toContain("Seja bem-vindo(a) à Academia X, Diego Novo!");
    expect(link.text).not.toContain("{");
    await waitWorld(page, ORG, logsInWorld(1));

    await page.goto("/communication");
    await openTab(page, "Histórico");
    const row = page.getByRole("button", { name: "Mensagem para Diego Novo", exact: true });
    await expect(row).toContainText("Boas-vindas");
    await expect(row).toContainText("Aberto no WhatsApp");
  });

  test("ficha do aluno: nova mensagem já com o aluno e histórico dele", async ({ page }) => {
    await seedComm(page, (t) => (t.messageLogs = LOGS));
    await page.goto("/clients/c-b");
    const panel = await openProfileSection(page, "Mensagens");
    // So as mensagens da Bruna.
    await expect(panel.getByRole("button", { name: /^Mensagem de / })).toHaveCount(1);
    await expect(panel).toContainText("Aniversário");
    await expect(panel).toContainText("Entregue");

    await panel.getByRole("button", { name: "Nova mensagem" }).first().click();
    // Na ficha o destinatario ja vem escolhido (sem campo de aluno).
    const dialog = page.getByRole("dialog", { name: "Mensagem para Bruna Lima" });
    await expect(dialog.getByRole("combobox", { name: "Alunos" })).toHaveCount(0);
    await dialog.getByLabel("Mensagem").fill("Seu kimono chegou!");
    const link = await openedWhatsApp(page, () => dialog.getByRole("button", { name: "Abrir no WhatsApp" }).click());
    expect(link.phone).toBe("5511988881111");
    expect(link.text).toBe("Seu kimono chegou!");
    await expect(panel.getByRole("button", { name: /^Mensagem de / })).toHaveCount(2);

    await panel.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Entregue" }).click();
    await expect(panel.getByRole("button", { name: /^Mensagem de / })).toHaveCount(1);
  });

  test("lembrete de cobrança avulsa pelo menu da cobrança", async ({ page }) => {
    await seedComm(page, (t) => {
      t.charges = [
        {
          id: "ch-x",
          organizationId: ORG,
          unitId: "unit-academia-x",
          studentId: "c-b",
          kind: "extra",
          description: "Kimono",
          competence: "2026-09",
          dueDate: "2026-09-25",
          amountCents: 25000,
          status: "pending",
          createdAt: TS,
          updatedAt: TS,
        },
      ];
    });
    await page.goto("/classes/billing?status=all");
    await page.getByRole("button", { name: "Ações de Bruna Lima", exact: true }).click();
    const link = await openedWhatsApp(page, () => page.getByRole("menuitem", { name: "Lembrar no WhatsApp" }).click());
    expect(link.phone).toBe("5511988881111");
    // Texto mestre da biblioteca da Meta: sem o nome do aluno (doc technical/07 §1.7).
    expect(link.text).toContain("Lembrete de pagamento:");
    expect(link.text).toContain("Kimono");
    expect(link.text).toContain("R$ 250,00");
    expect(link.text).toContain("25/09");
    // Sem cobranca online no gratis: a frase do link sai inteira.
    expect(link.text).not.toContain("link");
    expect(link.text).not.toContain("{");
    await waitWorld(page, ORG, logsInWorld(1));
    await page.goto("/communication");
    await openTab(page, "Histórico");
    await expect(page.getByRole("button", { name: "Mensagem para Bruna Lima", exact: true })).toContainText(
      "Lembrete de cobrança",
    );
  });
});

test.describe("modelos de mensagem", () => {
  test("configurar o aniversário mostra a prévia preenchida, sem editar o texto", async ({ page }) => {
    await seedComm(page);
    await page.goto("/communication");
    // Texto fixo desde 09/11/2026 (doc frontend/06 §16): "Configurar modelo" abre a
    // previa com as variaveis preenchidas, sem campo de texto; no envio assistido so "Fechar".
    const card = page.getByRole("group", { name: "Aniversário", exact: true });
    await card.getByRole("button", { name: "Configurar modelo" }).click();
    const dialog = page.getByRole("dialog", { name: "Aniversário" });
    await expect(dialog).toContainText("Como o aluno recebe");
    await expect(dialog).toContainText("Ana Souza");
    await expect(dialog).toContainText("Academia X");
    await expect(dialog).not.toContainText("{");
    await expect(dialog.getByLabel("Texto")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Salvar" })).toHaveCount(0);
    // O "Fechar" do rodape (o X do canto tem o mesmo nome).
    await dialog.getByRole("button", { name: "Fechar", exact: true }).first().click();
    await expect(dialog).toBeHidden();
  });

  test("atendente vê os modelos e o histórico sem editar nem enviar", async ({ page }) => {
    await seedComm(page, (t) => {
      t.users.push(ATTENDANT);
      t.messageLogs = LOGS;
    });
    await loginAsUser(page, ATTENDANT);
    await page.goto("/communication");
    await expect(page.getByText("Em atraso", { exact: true })).toBeVisible();
    // Configurar os modelos e de quem gerencia a comunicacao; enviar, nao.
    await expect(page.getByRole("button", { name: "Configurar modelo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nova mensagem" })).toBeVisible();
    await openTab(page, "Histórico");
    await expect(page.getByRole("button", { name: /^Mensagem para / })).toHaveCount(3);
  });
});

test.describe("histórico", () => {
  test("filtros por status, tipo e busca; detalhe da mensagem", async ({ page }) => {
    await seedComm(page, (t) => (t.messageLogs = LOGS));
    await page.goto("/communication");
    await openTab(page, "Histórico");
    const rows = page.getByRole("button", { name: /^Mensagem para / });
    await expect(rows).toHaveCount(3);
    await expect(page.getByText("3 mensagens", { exact: true })).toBeVisible();

    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Relacionamento" }).click();
    await expect(rows).toHaveCount(2);
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Avulsa" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Carla Souza");

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await expect(rows).toHaveCount(3);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Falhou" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Falhou");

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByPlaceholder("Buscar por aluno, telefone ou texto...").fill("parabéns");
    await expect(rows).toHaveCount(1);
    await rows.first().click();
    const detail = page.getByRole("dialog", { name: "Aniversário" });
    await expect(detail).toContainText("Parabéns pelo seu dia, Bruna Lima! 🎂");
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();

    await page.getByPlaceholder("Buscar por aluno, telefone ou texto...").fill("ninguém aqui");
    await expect(rows).toHaveCount(0);
  });

  test("sem mensagens mostra o guia vazio", async ({ page }) => {
    await seedComm(page);
    await page.goto("/communication");
    await openTab(page, "Histórico");
    await expect(page.getByText("Nenhuma mensagem ainda")).toBeVisible();
  });
});

test.describe("WhatsApp oficial (Pro)", () => {
  test("ligar e desligar o envio automático de um modelo", async ({ page }) => {
    await seedComm(page, officialConnected);
    await page.goto("/communication");
    await expect(page.getByText("Mensagens automáticas pelo WhatsApp oficial do seu espaço.")).toBeVisible();
    await openTab(page, "Mensagens");
    const toggle = page.getByRole("switch", { name: "Envio automático: Em atraso" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(page.getByText("Envio automático desligado.")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(page.getByText("Envio automático ligado.")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  test("horário de envio valida início antes do fim", async ({ page }) => {
    await seedComm(page, officialConnected);
    await page.goto("/communication");
    await openTab(page, "Conexão");
    const save = page.getByRole("tabpanel").getByRole("button", { name: "Salvar" });
    await expect(save).toBeDisabled();
    await page.getByRole("textbox", { name: "De", exact: true }).fill("21:00");
    await page.getByRole("textbox", { name: "Até", exact: true }).fill("20:00");
    await save.click();
    await expect(page.getByText("O início precisa ser antes do fim.")).toBeVisible();
    await page.getByRole("textbox", { name: "De", exact: true }).fill("09:00");
    await save.click();
    await expect(page.getByText("Horário salvo.")).toBeVisible();
    await waitWorld(page, ORG, (t) => t.whatsAppConnection.allowedSendHours.start === "09:00");
  });

  test("reenviar mensagem que falhou", async ({ page }) => {
    await seedComm(page, (t) => {
      officialConnected(t);
      t.messageLogs = LOGS;
    });
    await page.goto("/communication");
    await openTab(page, "Histórico");
    await page.getByRole("button", { name: "Ações da mensagem para Carla Souza", exact: true }).click();
    await page.getByRole("menuitem", { name: "Reenviar" }).click();
    await expect(page.getByText("Mensagem reenviada para Carla Souza.")).toBeVisible();
    // No assistido nao ha reenviar.
    await page.getByRole("button", { name: "Ações da mensagem para Aluno A20", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Reenviar" })).toHaveCount(0);
  });

  test("desconectar volta para o envio assistido", async ({ page }) => {
    await seedComm(page, officialConnected);
    await page.goto("/communication");
    await openTab(page, "Conexão");
    await page.getByRole("tabpanel").getByRole("button", { name: /Desconectar/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "Desconectar o WhatsApp oficial?" });
    await confirm.getByRole("button", { name: /Desconectar/ }).click();
    await expect(page.getByText("WhatsApp oficial desconectado.")).toBeVisible();
    await expect(page.getByText("Mensagens prontas que abrem no WhatsApp do seu espaço.")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByRole("button", { name: "Conectar WhatsApp oficial" })).toBeVisible();
  });
});
