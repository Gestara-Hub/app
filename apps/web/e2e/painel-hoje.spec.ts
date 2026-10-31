import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, skipWelcome, student, test } from "./fixtures";
import type { Tenant } from "./geral-fixtures";

/**
 * Dashboard "Lembretes" (doc product/25): um bloco no topo so com as pendencias do dia
 * (cobranças em atraso de todos os meses, 3 faltas seguidas, aniversariantes de hoje e troca
 * de faixa pela idade). Hoje e terca 22/09/2026.
 */

const TS = "2026-09-01T12:00:00.000Z";

/** Executa a acao que abre o WhatsApp (envio assistido) e devolve o texto do link. */
async function openedWhatsApp(page: Page, action: () => Promise<void>) {
  await page.context().route("https://api.whatsapp.com/**", (route) =>
    route.fulfill({ body: "ok", contentType: "text/plain" }),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), action()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  await popup.close();
  return { phone: url.searchParams.get("phone"), text: url.searchParams.get("text") ?? "" };
}

const absence = (studentId: string, sessionId: string, status = "absent") => ({
  id: `at-${studentId}-${sessionId}`,
  sessionId,
  studentId,
  status,
  markedAt: TS,
});

/**
 * Cenario com uma pendencia de cada tipo:
 * - Aluno A20: mensalidade de R$ 55,00 vencida em 20/09;
 * - Aluno Sumido: faltou nas 3 ultimas aulas, em duas turmas;
 * - Aluno Voltou: duas faltas e depois presenca (nao entra);
 * - Aluno Parabéns: faz 31 anos hoje; Aluno Quinta: faz aniversario em 2 dias;
 * - Aluno Verde: 16 anos na faixa Verde (vai ate 15 anos).
 */
async function seedTodo(page: Page, more?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      const noPlan = { planId: undefined };
      t.clients = [
        student("c-a", "Aluno A20"),
        student("c-s", "Aluno Sumido", { ...noPlan, phone: "11988881111" }),
        student("c-v", "Aluno Voltou", noPlan),
        student("c-p", "Aluno Parabéns", { ...noPlan, phone: "11988882222", birthDate: "1995-09-22" }),
        student("c-q", "Aluno Quinta", { ...noPlan, birthDate: "2000-09-24" }),
        student("c-g", "Aluno Verde", {
          ...noPlan,
          birthDate: "2010-03-01",
          progressions: {
            "m-jj": {
              modalityId: "m-jj",
              modalityName: "Jiu-Jitsu",
              levelId: "lvl-kids-green",
              levelName: "Faixa Verde",
              levelColor: "green",
              subLevel: 2,
              maxSubLevels: 4,
              promotedAt: "2026-01-10",
              strengths: [],
              goals: [],
              evaluations: [],
              promotionHistory: [],
              updatedAt: TS,
            },
          },
        }),
      ];
      t.classGroups = [
        classGroup("cg-1", "Jiu-Jitsu Adulto"),
        classGroup("cg-2", "Jiu-Jitsu Noite", { meetingSlots: [4, 5].map((weekday) => ({ weekday, start: "19:00", end: "20:00" })) }),
      ];
      t.enrollments = [
        enrollment("e-a", "cg-1", "c-a"),
        enrollment("e-s1", "cg-1", "c-s"),
        enrollment("e-s2", "cg-2", "c-s"),
        enrollment("e-v1", "cg-1", "c-v"),
        enrollment("e-v2", "cg-2", "c-v"),
        enrollment("e-g", "cg-1", "c-g"),
      ];
      const wed = "cg-1~2026-09-16~17:00";
      const fri = "cg-2~2026-09-18~19:00";
      const mon = "cg-1~2026-09-21~17:00";
      t.attendances = [
        absence("c-s", wed),
        absence("c-s", fri),
        absence("c-s", mon),
        absence("c-v", wed),
        absence("c-v", fri),
        absence("c-v", mon, "present"),
      ];
      more?.(t);
    },
  });
  await skipWelcome(page);
  await page.goto("/dashboard");
}

/** O bloco "Lembretes" (card com o titulo; doc product/25). */
const todoCard = (page: Page) =>
  page.locator("[data-slot=card]").filter({ has: page.getByText("Lembretes", { exact: true }) });

/** Linha de pendencia pelo titulo. */
const todoRow = (page: Page, title: string | RegExp) =>
  todoCard(page).getByRole("listitem").filter({ has: page.getByText(title) }).first();

test("lembretes: uma linha por tipo, com o contador de pendências", { tag: "@smoke" }, async ({ page }) => {
  await seedTodo(page);
  const card = todoCard(page);
  await expect(card).toContainText("4 pendências");
  await expect(card).toContainText("1 cobrança em atraso");
  await expect(card).toContainText("R$ 55,00 até hoje");
  await expect(card).toContainText("1 aluno com 3 faltas seguidas");
  await expect(card).toContainText("1 aniversariante hoje");
  await expect(card).toContainText("1 aluno precisa trocar de faixa pela idade");
  // Quem voltou a treinar (presenca depois das faltas) nao entra.
  await expect(card).not.toContainText("Aluno Voltou");

  const overdue = todoRow(page, "1 cobrança em atraso");
  await overdue.getByRole("button", { name: "Ver" }).click();
  await expect(overdue).toContainText("Aluno A20");
  await overdue.getByRole("link", { name: "Abrir em Cobranças" }).click();
  await expect(page).toHaveURL(/\/classes\/billing\?overdue=all$/);
  await expect(page.locator("div.group").filter({ hasText: "Aluno A20" })).toContainText("Atrasado");
});

test("3 faltas seguidas em turmas diferentes: 'Sentimos sua falta' pelo WhatsApp e 'Avisado hoje'", async ({
  page,
}) => {
  await seedTodo(page);
  const row = todoRow(page, "1 aluno com 3 faltas seguidas");
  await expect(row).toContainText("Aluno Sumido");
  await row.getByRole("button", { name: "Ver" }).click();
  await expect(row).toContainText("3 faltas seguidas · desde há 6 dias · Jiu-Jitsu Adulto, Jiu-Jitsu Noite");

  const link = await openedWhatsApp(page, () =>
    row.getByRole("button", { name: "Mandar mensagem para Aluno Sumido no WhatsApp" }).click(),
  );
  expect(link.phone).toBe("5511988881111");
  expect(link.text).toContain("Oi, Aluno Sumido! Tudo bem? Sentimos muito a sua falta");
  expect(link.text).toContain("Academia X");
  expect(link.text).toContain("💪");
  await expect(row).toContainText("Avisado hoje");
});

test("aniversariante de hoje: parabéns pelo WhatsApp e o card só com selos (sem aviso)", async ({ page }) => {
  await seedTodo(page);
  const row = todoRow(page, "1 aniversariante hoje");
  await expect(row).toContainText("Aluno Parabéns");
  await row.getByRole("button", { name: "Ver" }).click();
  await expect(row).toContainText("Faz 31 anos");

  const link = await openedWhatsApp(page, () =>
    row.getByRole("button", { name: "Mandar parabéns para Aluno Parabéns no WhatsApp" }).click(),
  );
  expect(link.phone).toBe("5511988882222");
  expect(link.text).toBe(
    "Parabéns pelo seu dia, Aluno Parabéns! 🎂 Toda a equipe da Academia X deseja muita saúde, conquistas e evolução. É uma honra ter você na nossa família! Aproveite seu dia especial.",
  );
  await expect(row).toContainText("Parabéns enviado");

  // Card do mes: hoje primeiro com o selo "Hoje", proximos com "Em N dias"; sem faixa de aviso.
  const birthdays = page
    .locator("[data-slot=card]")
    .filter({ has: page.getByText(/^Aniversariantes de setembro/) });
  await expect(birthdays).toContainText("(2)");
  const items = birthdays.getByRole("listitem");
  await expect(items.first()).toContainText("Aluno Parabéns");
  await expect(items.first()).toContainText("Hoje");
  await expect(items.nth(1)).toContainText("Aluno Quinta");
  await expect(items.nth(1)).toContainText("Em 2 dias");
  await expect(birthdays).not.toContainText("Mande os parabéns!");
  await expect(birthdays.getByRole("alert")).toHaveCount(0);
  // O parabens ja enviado hoje fica marcado tambem no card.
  await expect(birthdays.getByRole("button", { name: "Mandar parabéns para Aluno Parabéns no WhatsApp" })).toHaveAttribute(
    "title",
    "Parabéns já mandado hoje",
  );
});

test("troca de faixa pela idade: 'Graduar' abre a graduação com a sugestão", async ({ page }) => {
  await seedTodo(page);
  const row = todoRow(page, "1 aluno precisa trocar de faixa pela idade");
  await row.getByRole("button", { name: "Ver" }).click();
  await expect(row).toContainText("Faixa Verde · Jiu-Jitsu · passou da idade");
  await row.getByRole("button", { name: "Graduar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
  await expect(dialog).toContainText("Com 16 anos, Faixa Verde não vale mais (13 a 15 anos). Sugestão: Faixa Azul.");

  await dialog.getByRole("button", { name: "Graduar", exact: true }).click();
  // Sem grau na faixa que ja nao vale: a sugestao e trocar para a Azul.
  await expect(dialog.getByRole("button", { name: /Dar o/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Trocar de faixa/ })).toContainText("Faixa Azul");
  await dialog.getByRole("button", { name: "Confirmar graduação" }).click();
  await expect(page.getByText("Registrado: Faixa Azul.")).toBeVisible();
  await page.keyboard.press("Escape");
  // Graduou: sai a troca pela idade e entra o lembrete de parabenizar pelo avanço (doc product/25).
  await expect(todoCard(page)).not.toContainText("trocar de faixa pela idade");
  await expect(todoCard(page)).toContainText("1 aluno avançou de nível");
  await expect(todoCard(page)).toContainText("4 pendências");
});

test("sino no topo: o número de pendências e a mesma lista num painel lateral, em qualquer tela", async ({ page }) => {
  await seedTodo(page);
  await page.goto("/classes");
  const bell = page.getByRole("button", { name: "Lembretes: 4 lembretes pendentes" });
  await expect(bell).toBeVisible();
  await bell.click();
  const sheet = page.getByRole("dialog", { name: "Lembretes" });
  await expect(sheet).toContainText("4 pendências");
  await expect(sheet).toContainText("1 cobrança em atraso");
  await expect(sheet).toContainText("1 aniversariante hoje");
  const row = sheet.getByRole("listitem").filter({ has: page.getByText("1 aniversariante hoje") }).first();
  await row.getByRole("button", { name: "Ver" }).click();
  await openedWhatsApp(page, () => row.getByRole("button", { name: "Mandar parabéns para Aluno Parabéns no WhatsApp" }).click());
  await expect(row).toContainText("Parabéns enviado hoje");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Lembretes: 3 lembretes pendentes" })).toBeVisible();
});

/** Painel do sino aberto, com a linha dos aniversariantes aberta. */
async function openBellBirthdays(page: Page) {
  await page.goto("/classes");
  await page.getByRole("button", { name: /^Lembretes:/ }).click();
  const sheet = page.getByRole("dialog", { name: "Lembretes" });
  const row = sheet.getByRole("listitem").filter({ has: page.getByText("1 aniversariante hoje") }).first();
  await row.getByRole("button", { name: "Ver" }).click();
  return { sheet, row };
}

test("sino: clicar fora do menu ⋮ de um aluno fecha só o menu, o painel continua", async ({ page }) => {
  await seedTodo(page);
  const { sheet, row } = await openBellBirthdays(page);
  // Com o menu aberto o painel fica oculto aos leitores de tela: o clique vai por coordenada.
  const box = (await sheet.boundingBox())!;
  for (const outside of ["sheet", "overlay"] as const) {
    await row.getByRole("button", { name: "Mais ações de Aluno Parabéns" }).click();
    await expect(page.getByRole("menuitem", { name: "Lembrar amanhã" })).toBeVisible();
    if (outside === "sheet") await page.mouse.click(box.x + 40, box.y + 40);
    else await page.mouse.click(20, 300);
    await expect(page.getByRole("menuitem", { name: "Lembrar amanhã" })).toHaveCount(0);
    await expect(sheet).toBeVisible();
  }
});

test("sino com o WhatsApp oficial: cancelar ou enviar na confirmação não fecha o painel", async ({ page }) => {
  await seedTodo(page, (t) => {
    t.organization.subscription = { tier: "pro" };
    t.unit.phone = "1140028922";
    t.whatsAppConnection = {
      organizationId: t.organization.id,
      officialStatus: "connected",
      phoneNumber: "551140028922",
      displayName: "Academia X",
      connectedAt: TS,
      allowedSendHours: { start: "08:00", end: "20:00" },
      monthlyQuota: { used: 0, included: 1000 },
    };
  });
  const { sheet, row } = await openBellBirthdays(page);
  const send = row.getByRole("button", { name: "Mandar parabéns para Aluno Parabéns no WhatsApp" });
  const confirm = page.getByRole("alertdialog", { name: "Enviar para Aluno Parabéns?" });

  await send.click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(sheet).toBeVisible();

  await send.click();
  await confirm.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Mensagem enviada para Aluno Parabéns.")).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(row).toContainText("Parabéns enviado hoje");
});

test("sem pendências o bloco não aparece", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno Em Dia", { planId: undefined })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
    },
  });
  await skipWelcome(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Nenhuma mensalidade gerada no mês")).toBeVisible();
  await expect(page.getByText("Lembretes", { exact: true })).toHaveCount(0);
  // Sem pendencia, sem sino.
  await expect(page.getByRole("button", { name: /^Lembretes:/ })).toHaveCount(0);
});
