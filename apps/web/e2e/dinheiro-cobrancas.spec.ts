import type { Page } from "@playwright/test";
import { classGroup, expect, seedAcademy, student, test } from "./fixtures";
import {
  TS,
  charge,
  contextMenuItems,
  makePro,
  menuAction,
  noPlan,
  openMenuItems,
  openedWhatsApp,
  pickSelect,
  rowOf,
  stepMonth,
  tenantOf,
  waitForTenant,
} from "./dinheiro-fixtures";

/**
 * Tela Cobranças com todos os tipos (doc 15, "Tela Cobranças" e "Lembretes de
 * WhatsApp das outras cobranças"): linhas, filtros, menus, WhatsApp, cobrança
 * online (Pro) e Pix Automático. Relogio fixo em 22/09/2026 (terca).
 */

test.describe.configure({ timeout: 90_000 });

const extra = (id: string, studentId: string, over: Record<string, unknown> = {}) => charge(id, studentId, over);
const course = (id: string, studentId: string, over: Record<string, unknown> = {}) =>
  charge(id, studentId, { kind: "course", description: "Confeitaria", classGroupId: "cg-c", amountCents: 20000, ...over });
const pack = (id: string, studentId: string, over: Record<string, unknown> = {}) =>
  charge(id, studentId, { kind: "package", description: "10 aulas", amountCents: 50000, ...over });

/**
 * Um aluno por tipo e situacao em setembro:
 * - Aluno Mensal: mensalidade gerada sozinha (R$ 55, venceu 20/09);
 * - Aluno Semanal: plano semanal (parcelas da semana agrupadas);
 * - Aluna Bolsista: bolsa integral (isenta);
 * - Aluno Avulso: aula avulsa de 21/09;
 * - Aluna Extra: parcela 2 de 3 do Kimono; Aluno Cancelado: avulsa cancelada a mao;
 * - Aluna Curso: parcela 2 de 4 do curso; Aluno Pacote: compra a vista do pacote;
 * - Aluno Trocou: mensalidade substituida pela troca de plano (oculta por padrao).
 */
function mixedMonth(t: Record<string, unknown>) {
  (t.plans as unknown[]).push({
    id: "p-w",
    organizationId: "org-academia-x",
    name: "Semanal Jiu-Jitsu",
    priceCents: 4000,
    period: "weekly",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  });
  t.clients = [
    student("c-m", "Aluno Mensal"),
    student("c-w", "Aluno Semanal", { planId: "p-w", planStartDate: "2026-09-01" }),
    student("c-b", "Aluna Bolsista", { planStartDate: "2026-09-01", discount: { type: "percentage", value: 100, scholarship: true } }),
    noPlan("c-d", "Aluno Avulso"),
    noPlan("c-e", "Aluna Extra"),
    noPlan("c-x", "Aluno Cancelado"),
    noPlan("c-c", "Aluna Curso"),
    noPlan("c-p", "Aluno Pacote"),
    noPlan("c-r", "Aluno Trocou"),
  ];
  t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
  t.charges = [
    charge("d-1", "c-d", { kind: "dropin", description: undefined, classGroupId: "cg-1", dueDate: "2026-09-21", amountCents: 4000 }),
    extra("x-2", "c-e", { installmentGroupId: "g-x", cycleIndex: 2, cycleTotal: 3, amountCents: 10000 }),
    extra("x-c", "c-x", { description: "Evento", status: "canceled", canceledBy: "user", cancelReason: "Cobrança duplicada", amountCents: 7000 }),
    course("k-2", "c-c", { installmentGroupId: "g-k", cycleIndex: 2, cycleTotal: 4, dueDate: "2026-09-15" }),
    pack("pk-1", "c-p", { dueDate: "2026-09-28" }),
    charge("r-1", "c-r", {
      kind: "membership",
      description: undefined,
      planId: "p-m",
      dueDate: "2026-09-10",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      amountCents: 15000,
      status: "canceled",
      canceledBy: "system",
      replaced: true,
      notes: "Substituída pela troca de plano",
    }),
  ];
}

test("todos os tipos no mês: texto de cada linha, filtros de tipo e situação e os menus de cada estado", { tag: "@smoke" }, async ({ page }) => {
  await seedAcademy(page, { extra: mixedMonth });
  await page.goto("/classes/billing?status=all");

  // Linha de cada tipo.
  await expect(rowOf(page, "Aluno Mensal")).toContainText("Mensal Jiu-Jitsu");
  await expect(rowOf(page, "Aluno Mensal")).toContainText("vence 20/09");
  await expect(rowOf(page, "Aluno Mensal")).toContainText("Atrasado");
  const dropin = rowOf(page, "Aluno Avulso");
  await expect(dropin).toContainText("Aula avulsa");
  await expect(dropin).toContainText("Jiu-Jitsu Adulto");
  await expect(dropin).toContainText("aula em 21/09");
  await expect(rowOf(page, "Aluna Extra")).toContainText("Kimono");
  await expect(rowOf(page, "Aluna Extra")).toContainText("parcela 2 de 3");
  await expect(rowOf(page, "Aluna Curso")).toContainText("Curso Confeitaria");
  await expect(rowOf(page, "Aluna Curso")).toContainText("parcela 2 de 4");
  await expect(rowOf(page, "Aluna Curso")).toContainText("Atrasado");
  await expect(rowOf(page, "Aluno Pacote")).toContainText("Pacote 10 aulas");
  await expect(rowOf(page, "Aluno Pacote")).toContainText("vence 28/09");
  await expect(rowOf(page, "Aluno Cancelado")).toContainText("Cobrança duplicada");
  const scholar = rowOf(page, "Aluna Bolsista");
  await expect(scholar).toContainText("Bolsista");
  await expect(scholar).not.toContainText("Pendente");
  // Semanal: as cobrancas do mes numa linha so, com a contagem.
  const weekly = page.locator("div.cursor-pointer").filter({ hasText: "Aluno Semanal" });
  await expect(weekly).toContainText("Semanal Jiu-Jitsu");
  await expect(weekly).toContainText("5 cobranças");
  // A substituida fica oculta, com o aviso.
  await expect(rowOf(page, "Aluno Trocou")).toHaveCount(0);
  await expect(page.getByText("1 cobrança substituída por troca de plano ou regra está oculta.")).toBeVisible();

  // Menus: avulsa nao tem lembrete; isenta e substituida nao tem acao.
  expect(await openMenuItems(page, "Aluno Avulso")).toEqual(["Marcar pago", "Cobrar online (desligado nas Configurações)", "Cancelar cobrança"]);
  for (const name of ["Aluna Extra", "Aluna Curso", "Aluno Pacote", "Aluno Mensal"]) {
    expect(await openMenuItems(page, name)).toEqual([
      "Marcar pago",
      "Lembrar no WhatsApp",
      "Cobrar online (desligado nas Configurações)",
      "Cancelar cobrança",
    ]);
  }
  await expect(scholar.getByRole("button", { name: "Ações de Aluna Bolsista" })).toHaveCount(0);
  expect(await contextMenuItems(page, scholar)).toEqual([]);
  expect(await contextMenuItems(page, rowOf(page, "Aluno Cancelado"))).toEqual(["Reverter cancelamento"]);
  // A linha agrupada abre as parcelas pelo clique direito; cada parcela tem o menu dela.
  expect(await contextMenuItems(page, weekly)).toEqual(["Ver cobranças"]);
  await weekly.getByRole("button", { name: "Ver cobranças" }).click();
  await expect(page.getByRole("button", { name: "Ações de Aluno Semanal", exact: true }).first()).toBeVisible();
  expect(await contextMenuItems(page, weekly)).toEqual(["Ocultar cobranças"]);

  // Tipo: cada opcao com o que lhe cabe.
  const kinds: [string, string, string[]][] = [
    ["Mensalidades", "kind=membership", ["Aluno Mensal", "Aluno Semanal", "Aluna Bolsista"]],
    ["Aulas avulsas", "kind=dropin", ["Aluno Avulso"]],
    ["Cobranças avulsas", "kind=extra", ["Aluna Extra", "Aluno Cancelado"]],
    ["Cursos", "kind=course", ["Aluna Curso"]],
    ["Pacotes", "kind=package", ["Aluno Pacote"]],
  ];
  const everyone = ["Aluno Mensal", "Aluno Semanal", "Aluna Bolsista", "Aluno Avulso", "Aluna Extra", "Aluno Cancelado", "Aluna Curso", "Aluno Pacote"];
  for (const [label, query, shown] of kinds) {
    await pickSelect(page, "Filtrar por tipo", label);
    await expect(page).toHaveURL(new RegExp(query));
    for (const name of everyone) {
      // A linha agrupada (semanal) nao e um ListRow: procura as duas.
      const any = page.locator("div.group, div.cursor-pointer").filter({ hasText: name });
      if (shown.includes(name)) await expect(any.first()).toBeVisible();
      else await expect(any).toHaveCount(0);
    }
  }
  await pickSelect(page, "Filtrar por tipo", "Todos os tipos");
  await expect(page).not.toHaveURL(/kind=/);

  // Situação: isentas, canceladas (sem as substituidas) e substituidas.
  await pickSelect(page, "Filtrar por situação", /^Isentas( \d+)?$/);
  await expect(page).toHaveURL(/status=waived/);
  await expect(rowOf(page, "Aluna Bolsista")).toBeVisible();
  await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
  await pickSelect(page, "Filtrar por situação", /Canceladas/);
  await expect(rowOf(page, "Aluno Cancelado")).toBeVisible();
  await expect(rowOf(page, "Aluno Trocou")).toHaveCount(0);
  await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
  await pickSelect(page, "Filtrar por situação", /Substituídas/);
  await expect(page).toHaveURL(/status=replaced/);
  const replaced = rowOf(page, "Aluno Trocou");
  await expect(replaced).toContainText("Substituída");
  await expect(replaced).toContainText("Substituída pela troca de plano");
  await expect(replaced.getByRole("button")).toHaveCount(0);
  expect(await contextMenuItems(page, replaced)).toEqual([]);
  await pickSelect(page, "Filtrar por situação", /Atrasadas/);
  await expect(rowOf(page, "Aluna Curso")).toBeVisible();
  await expect(rowOf(page, "Aluno Mensal")).toBeVisible();
  await expect(rowOf(page, "Aluno Pacote")).toHaveCount(0);
  await pickSelect(page, "Filtrar por situação", /Todos os status/);

  // O aviso "Mostrar" abre as substituidas.
  await page.getByRole("button", { name: "Mostrar" }).click();
  await expect(page).toHaveURL(/status=replaced/);
});

test("mês sem cobranças: vazio geral e o vazio de cada tipo com \"Limpar filtros\"", async ({ page }) => {
  await seedAcademy(page, { extra: (t) => (t.clients = [noPlan("c-1", "Aluno Sem Nada")]) });
  await page.goto("/classes/billing?status=all");
  await expect(page.getByText("Nenhuma cobrança nesta competência.")).toBeVisible();
  await expect(page.getByText("Nenhum aluno com mensalidade ou aula avulsa neste mês.")).toBeVisible();
  const empty: [string, string][] = [
    ["Mensalidades", "Nenhuma mensalidade neste mês."],
    ["Aulas avulsas", "Nenhuma aula avulsa neste mês."],
    ["Cobranças avulsas", "Nenhuma cobrança avulsa neste mês."],
    ["Cursos", "Nenhuma parcela de curso neste mês."],
    ["Pacotes", "Nenhum pacote neste mês."],
  ];
  for (const [label, message] of empty) {
    await pickSelect(page, "Filtrar por tipo", label);
    await expect(page.getByText(message)).toBeVisible();
  }
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(page).not.toHaveURL(/kind=/);
  await expect(page.getByText("Nenhuma cobrança nesta competência.")).toBeVisible();

  // Mes futuro: as mensalidades aparecem quando ele comecar; "Hoje" volta.
  await stepMonth(page, "next", "2026-10");
  await expect(page.getByText("As mensalidades deste mês aparecem quando ele começar.")).toBeVisible();
  await page.getByRole("button", { name: "Hoje" }).click();
  await expect(page).not.toHaveURL(/month=/);
});

test.describe("WhatsApp", () => {
  /** Uma cobranca de cada tipo, pendente, para o lembrete. */
  function reminderMonth(t: Record<string, unknown>) {
    t.clients = [
      student("c-m", "Aluno Mensal"),
      noPlan("c-1", "Aluna Kimono"),
      noPlan("c-2", "Aluno Parcela", { phone: "11911112222" }),
      noPlan("c-3", "Aluna Curso Vista"),
      noPlan("c-4", "Aluno Curso Parcela"),
      noPlan("c-5", "Aluna Pacote Vista"),
      noPlan("c-6", "Aluno Pacote Parcela"),
      noPlan("c-7", "Aluno Aula"),
    ];
    t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
    t.charges = [
      extra("x-1", "c-1"),
      extra("x-2", "c-2", { installmentGroupId: "g-x", cycleIndex: 2, cycleTotal: 3, amountCents: 10000, dueDate: "2026-09-30" }),
      course("k-1", "c-3", { installmentGroupId: "g-k1", cycleIndex: 1, cycleTotal: 1, amountCents: 80000, dueDate: "2026-09-29" }),
      course("k-2", "c-4", { installmentGroupId: "g-k2", cycleIndex: 2, cycleTotal: 4, dueDate: "2026-09-26" }),
      pack("pk-1", "c-5", { dueDate: "2026-09-24" }),
      pack("pk-2", "c-6", { installmentGroupId: "g-p", cycleIndex: 1, cycleTotal: 2, amountCents: 25000, dueDate: "2026-09-23" }),
      charge("d-1", "c-7", { kind: "dropin", description: undefined, classGroupId: "cg-1", dueDate: "2026-09-21", amountCents: 4000 }),
    ];
  }

  test("lembrete de cada tipo: modelo da mensalidade, \"Lembrete de cobrança\" com a referência e nada na aula avulsa", async ({
    page,
  }) => {
    await seedAcademy(page, { extra: reminderMonth });
    await page.goto("/classes/billing?status=all");
    const remind = (name: string) => openedWhatsApp(page, () => menuAction(page, name, "Lembrar no WhatsApp"));

    // Mensalidade continua com o modelo da situacao (atrasada: "Em atraso").
    const membership = await remind("Aluno Mensal");
    expect(membership.text).toBe(
      "Oi, Aluno Mensal! Notamos que a mensalidade de R$ 55,00 da Academia X que venceu em 20/09 ainda está em aberto. Qualquer dúvida, estamos à disposição!",
    );

    const kimono = await remind("Aluna Kimono");
    expect(kimono.origin).toBe("https://api.whatsapp.com/send");
    expect(kimono.phone).toBe("5511977770000");
    // Sem cobranca online no gratis: a frase do link sai inteira.
    expect(kimono.text).toBe(
      "Olá, Aluna Kimono! Lembrete da cobrança Kimono de R$ 250,00 na Academia X, com vencimento em 25/09. Bons treinos! 🥋",
    );
    const parcel = await remind("Aluno Parcela");
    expect(parcel.phone).toBe("5511911112222");
    expect(parcel.text).toContain("Lembrete da parcela 2 de 3 da cobrança Kimono de R$ 100,00 na Academia X, com vencimento em 30/09.");
    expect((await remind("Aluna Curso Vista")).text).toContain("Lembrete da matrícula no curso Confeitaria de R$ 800,00");
    expect((await remind("Aluno Curso Parcela")).text).toContain("Lembrete da parcela 2 de 4 do curso Confeitaria de R$ 200,00");
    expect((await remind("Aluna Pacote Vista")).text).toContain("Lembrete da compra do pacote 10 aulas de R$ 500,00");
    expect((await remind("Aluno Pacote Parcela")).text).toContain(
      "Lembrete da parcela 1 de 2 do pacote 10 aulas de R$ 250,00 na Academia X, com vencimento em 23/09.",
    );
    expect(await openMenuItems(page, "Aluno Aula")).not.toContain("Lembrar no WhatsApp");

    // Todos ficam no Histórico, ligados ao modelo.
    await waitForTenant(page, (t) => (t.messageLogs ?? []).length === 7);
    await page.goto("/communication");
    await page.getByRole("tab", { name: "Histórico" }).click();
    const row = page.getByRole("button", { name: "Mensagem para Aluna Kimono", exact: true });
    await expect(row).toContainText("Lembrete de cobrança");
    await expect(row).toContainText("Aberto no WhatsApp");
    await expect(page.getByRole("button", { name: "Mensagem para Aluno Mensal", exact: true })).toContainText("Em atraso");

    // O modelo novo aparece em Mensagens, com a previa da referencia.
    await page.getByRole("tab", { name: "Mensagens" }).click();
    await expect(page.getByText("Lembrete de cobrança", { exact: true })).toBeVisible();
    await expect(page.getByText("Pacote acabando", { exact: true })).toBeVisible();
  });

  test("gastronomia: trocar a área reescreve o fecho do lembrete (\"Boas aulas!\")", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [noPlan("c-1", "Aluna Doce")], (t.charges = [extra("x-1", "c-1", { description: "Avental" })])) });
    await page.goto("/settings");
    await page.getByRole("combobox", { name: /Área do espaço/ }).click();
    await page.getByRole("menuitem", { name: /^Gastronomia/ }).click();
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("Configurações salvas.")).toBeVisible();
    await waitForTenant(page, (t) => t.organization.classSegment === "gastronomy");

    await page.goto("/classes/billing?status=all");
    const link = await openedWhatsApp(page, () => menuAction(page, "Aluna Doce", "Lembrar no WhatsApp"));
    expect(link.text).toBe(
      "Olá, Aluna Doce! Lembrete da cobrança Avental de R$ 250,00 na Academia X, com vencimento em 25/09. Boas aulas!",
    );
  });
});

/** Gera o Pix (ou o link) pelo "Cobrar online" e simula o pagamento. */
async function payOnline(page: Page, name: string, method: "Pix" | "Link de cartão" = "Pix") {
  await menuAction(page, name, "Cobrar online");
  const dialog = page.getByRole("dialog", { name: "Cobrar online" });
  await dialog.getByRole("radio", { name: new RegExp(method) }).click();
  await dialog.getByRole("button", { name: method === "Pix" ? "Gerar Pix" : "Gerar link" }).click();
  await expect(page.getByText(method === "Pix" ? "Pix gerado." : "Link de pagamento gerado.")).toBeVisible();
  await expect(dialog.getByLabel(method === "Pix" ? "Código Pix copia e cola" : "Link de pagamento")).toBeVisible();
  await dialog.getByRole("button", { name: "Simular pagamento" }).click();
  await expect(page.getByText("Pagamento online confirmado.").first()).toBeVisible();
  await expect(dialog).toBeHidden();
}

test.describe("Pro", () => {
  test("Cobrar online em mensalidade, avulsa, curso e pacote: Pix ou link, simular e \"Pago online\" sem desfazer", { tag: "@smoke" }, async ({
    page,
  }) => {
    const pro = await makePro(page);
    await seedAcademy(page, {
      extra: (t) => {
        pro(t);
        t.clients = [student("c-m", "Aluno Mensal"), noPlan("c-1", "Aluna Kimono"), noPlan("c-3", "Aluna Curso"), noPlan("c-5", "Aluno Pacote")];
        t.charges = [
          extra("x-1", "c-1", { installmentGroupId: "g-x", cycleIndex: 1, cycleTotal: 2, amountCents: 12500 }),
          course("k-1", "c-3", { installmentGroupId: "g-k", cycleIndex: 1, cycleTotal: 4, dueDate: "2026-09-26" }),
          pack("pk-1", "c-5", { dueDate: "2026-09-24" }),
        ];
      },
    });
    await page.goto("/classes/billing?status=all");
    expect(await openMenuItems(page, "Aluna Kimono")).toContain("Cobrar online");

    // Texto pronto para mandar pelo WhatsApp, com o que esta sendo cobrado.
    await menuAction(page, "Aluna Kimono", "Cobrar online");
    const dialog = page.getByRole("dialog", { name: "Cobrar online" });
    await expect(dialog).toContainText("Aluna Kimono · R$ 125,00 · vence 25/09");
    await dialog.getByRole("button", { name: "Gerar Pix" }).click();
    await expect(page.getByText("Pix gerado.")).toBeVisible();
    const link = await openedWhatsApp(page, () => dialog.getByRole("button", { name: "Enviar pelo WhatsApp" }).click());
    expect(link.text).toContain('Olá, Aluna! Segue a parcela 1 de 2 de "Kimono" da Academia X no valor de R$ 125,00, com vencimento em 25/09.');
    // A mensagem leva o endereco do GestaraHub (/p/<codigo>), que mostra o Pix enquanto vale.
    const pageUrl = link.text.match(/https?:\/\/\S+\/p\/[A-Za-z0-9]+/)?.[0];
    expect(link.text).toContain("Pague pelo Pix:");
    expect(pageUrl).toBeTruthy();
    await expect(dialog).toContainText("Ainda não aberto pelo aluno.");
    const payPage = await page.context().newPage();
    await payPage.goto(new URL(pageUrl!).pathname);
    await expect(payPage.getByRole("heading", { name: "Kimono" })).toBeVisible();
    await expect(payPage.getByText("R$ 125,00")).toBeVisible();
    await expect(payPage.getByRole("button", { name: "Copiar código Pix" })).toBeVisible();
    await expect(payPage.getByText("Aluna Kimono")).toHaveCount(0);
    await payPage.close();
    // Com o Pix em aberto, o lembrete pelo WhatsApp leva o codigo junto.
    await dialog.getByRole("button", { name: "Fechar" }).last().click();
    await expect(dialog).toBeHidden();
    // O aluno abriu a pagina: a linha da cobranca e o Cobrar online mostram.
    await page.reload();
    await expect(rowOf(page, "Aluna Kimono")).toContainText("link aberto");
    const reminder = await openedWhatsApp(page, () => menuAction(page, "Aluna Kimono", "Lembrar no WhatsApp"));
    expect(reminder.text).toMatch(/Pague pelo link: \S+/);
    await menuAction(page, "Aluna Kimono", "Cobrar online");
    await expect(dialog).toContainText(/Aberto pelo aluno hoje às \d{2}:\d{2}/);
    await dialog.getByRole("button", { name: "Simular pagamento" }).click();
    await expect(page.getByText("Pagamento online confirmado.")).toBeVisible();

    await payOnline(page, "Aluno Mensal");
    await payOnline(page, "Aluna Curso", "Link de cartão");
    await payOnline(page, "Aluno Pacote");

    for (const [name, via] of [
      ["Aluna Kimono", "pago online via Pix"],
      ["Aluno Mensal", "pago online via Pix"],
      ["Aluna Curso", "pago online via Cartão"],
      ["Aluno Pacote", "pago online via Pix"],
    ] as const) {
      const row = rowOf(page, name);
      await expect(row).toContainText("Pago online");
      await expect(row).toContainText(via);
      // Pago online nao se desfaz (seria estorno): sem botao e sem menu de clique direito.
      await expect(row.getByRole("button", { name: "Desfazer pagamento" })).toHaveCount(0);
      await expect(row.getByRole("button", { name: /Ver detalhes do pagamento online/ })).toBeVisible();
      expect(await contextMenuItems(page, row)).toEqual([]);
    }
    const card = page.locator("div.rounded-xl.shadow-2xs").filter({ has: page.getByText("Recebido", { exact: true }) });
    await expect(card).toContainText("R$ 880,00");
  });

  test("Pro com o pagamento online desligado: \"Cobrar online\" travado com o motivo", async ({ page }) => {
    const pro = await makePro(page, { online: false });
    await seedAcademy(page, {
      extra: (t) => {
        pro(t);
        t.clients = [noPlan("c-1", "Aluna Kimono")];
        t.charges = [extra("x-1", "c-1")];
      },
    });
    await page.goto("/classes/billing?status=all");
    await page.getByRole("button", { name: "Ações de Aluna Kimono", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Cobrar online (desligado nas Configurações)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  // Pix Automatico ainda nao tem tabelas no banco (doc 15, fora da retirada do mock): volta quando tiver.
  test.skip("Pix Automático: solicitar no cadastro, simular a autorização e a mensalidade vencida sai paga", async ({ page }) => {
    const pro = await makePro(page);
    await seedAcademy(page, {
      extra: (t) => {
        pro(t);
        t.clients = [student("c-m", "Aluno Automático")];
      },
    });
    await page.goto("/classes/billing?status=all");
    await expect(rowOf(page, "Aluno Automático")).toContainText("Atrasado");
    await waitForTenant(page, (t) => t.charges.length === 1);

    await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Automático", exact: true }).last().click();
    await page.getByRole("menuitem", { name: "Editar cadastro" }).click();
    const form = page.getByRole("dialog");
    const section = form.getByText("Pix Automático", { exact: true });
    if (!(await section.isVisible())) await form.getByRole("button", { name: /Plano e mensalidade/ }).click();
    await form.getByRole("button", { name: "Solicitar Pix Automático" }).click();
    await expect(form.getByLabel("Limite por cobrança")).toHaveValue("150,00");
    await form.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(page.getByText("Solicitação enviada. Aguardando a autorização do aluno.")).toBeVisible();
    await expect(form).toContainText("Limite de R$ 150,00 por cobrança. Falta o aluno autorizar no app do banco.");
    await form.getByRole("button", { name: "Simular autorização" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Simular autorização?" });
    await expect(confirm).toContainText("com limite de R$ 150,00 por cobrança");
    await confirm.getByRole("button", { name: "Simular autorização" }).click();
    await expect(page.getByText("Pix Automático ativo.")).toBeVisible();
    await expect(form).toContainText("Mensalidades até R$ 150,00 são pagas sozinhas no vencimento.");
    await waitForTenant(page, (t) => t.charges[0]?.paidVia === "recurring");

    await page.goto("/classes/billing?status=all");
    const row = rowOf(page, "Aluno Automático");
    await expect(row).toContainText("Pago");
    await expect(row).toContainText("Pix Automático");
    await expect(row.getByRole("img", { name: /Pago pelo Pix Automático/ })).toBeVisible();
    // So a mensalidade usa o Pix Automatico.
    const t = await tenantOf(page);
    expect(t.charges.every((c: { kind: string }) => c.kind === "membership")).toBe(true);
  });
});

test.describe("Dashboard: cobranças em atraso", () => {
  const todoRow = (page: Page, title: string) =>
    page
      .locator("[data-slot=card]")
      .filter({ has: page.getByText("Para fazer hoje", { exact: true }) })
      .getByRole("listitem")
      .filter({ has: page.getByText(title) })
      .first();

  async function openDashboard(page: Page) {
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ seen: true, dismissed: false, tours: {} })), "gestarahub:onboarding:org-academia-x");
    await page.goto("/dashboard");
  }

  test("cobranças atrasadas de todos os tipos entram no bloco; \"Cobrar\" abre todos os atrasos", async ({
    page,
  }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [student("c-m", "Aluno Mensal"), noPlan("c-1", "Aluna Kimono"), noPlan("c-2", "Aluno Curso")];
        // Com turma, o Dashboard sai dos primeiros passos.
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.charges = [
          extra("x-1", "c-1", { dueDate: "2026-09-12" }),
          course("k-1", "c-2", { dueDate: "2026-09-15", installmentGroupId: "g", cycleIndex: 1, cycleTotal: 2 }),
        ];
      },
    });
    await openDashboard(page);
    // O bloco conta todos os tipos e todos os meses (a divida nao some na virada).
    const row = todoRow(page, "3 cobranças em atraso");
    await expect(row).toContainText("até hoje");
    await row.getByRole("link", { name: "Cobrar" }).click();
    await expect(page).toHaveURL(/\/classes\/billing\?overdue=all$/);
    // Em Cobranças, as tres atrasadas.
    await expect(rowOf(page, "Aluno Mensal")).toContainText("Atrasado");
    await expect(rowOf(page, "Aluna Kimono")).toContainText("Atrasado");
    await expect(rowOf(page, "Aluno Curso")).toContainText("Atrasado");
    await expect(page.getByText(/(^|· )3 cobranças$/)).toBeVisible();
  });

  test("sem mensalidade atrasada, avulsa atrasada também cria a pendência", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [noPlan("c-1", "Aluna Kimono")];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.charges = [extra("x-1", "c-1", { dueDate: "2026-09-12" })];
      },
    });
    await openDashboard(page);
    await expect(page.getByText("Nenhuma mensalidade gerada no mês")).toBeVisible();
    await expect(todoRow(page, "1 cobrança em atraso")).toBeVisible();
  });
});
