import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";
import {
  LEVELS_TRACK,
  TS,
  assessment,
  grade,
  gradedSettings,
  jjWhite,
  modality,
  openedWhatsApp,
  progression,
  rowOf,
  skipClientsCoachmark,
  waitForStore,
  type Tenant,
} from "./ficha-notas-fixtures";

/**
 * Ficha do aluno (`/clients/[id]`, doc 22 item 2): por onde se chega, o topo,
 * os cards de resumo, "Editar", "Mais ações" e as abas (`?tab=`).
 * Hoje e terca 22/09/2026; a turma padrao (Jiu-Jitsu) e seg/ter/qua 17h.
 */

const PROFILE = "/clients/c-a";
const NAME = "Aluna Ficha";
/** Faz 36 anos em 24/09 (daqui a 2 dias): hoje tem 35. */
const BIRTH = "1990-09-24";

const present = (sessionId: string, status = "present") => ({
  id: `at-${sessionId}`,
  sessionId,
  studentId: "c-a",
  status,
  markedAt: TS,
});

/**
 * Aluna com plano mensal (R$ 55,00 proporcional vencido em 20/09), faixa
 * branca de Jiu-Jitsu, 3 presencas e 1 falta nos ultimos 30 dias.
 */
async function seedProfile(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [
        student("c-a", NAME, {
          birthDate: BIRTH,
          email: "aluna@ficha.com",
          notes: "Prefere a turma da noite",
          progressions: { "m-jj": jjWhite() },
        }),
      ];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      t.attendances = [
        present("cg-1~2026-09-14~17:00"),
        present("cg-1~2026-09-15~17:00"),
        present("cg-1~2026-09-16~17:00", "absent"),
        present("cg-1~2026-09-21~17:00"),
      ];
      extra?.(t);
    },
  });
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const kpi = (page: Page, label: string) =>
  page.locator("div.rounded-xl").filter({ has: page.getByText(label, { exact: true }) }).first();

async function moreAction(page: Page, item: string) {
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

test.describe("por onde se chega na ficha", () => {
  test("Alunos: nome, linha, 'Abrir ficha', card e o link de volta", async ({ page }) => {
    await seedProfile(page);
    await skipClientsCoachmark(page);
    await page.goto("/clients");

    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await page.getByRole("link", { name: "Alunos" }).first().click();
    await expect(page).toHaveURL("/clients");

    // Clicar na linha (fora do nome e do menu) tambem abre.
    await rowOf(page, NAME).getByText("(11) 97777-0000").click();
    await expect(page).toHaveURL(PROFILE);
    await page.goBack();

    await page.getByRole("button", { name: `Ações de ${NAME}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Abrir ficha" }).click();
    await expect(page).toHaveURL(PROFILE);
    await page.goBack();

    await page.getByRole("radio", { name: "Visualização em cartões" }).or(page.getByRole("button", { name: "Visualização em cartões" })).click();
    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  });

  test("turma, chamada e Cobranças levam à ficha pelo nome", async ({ page }) => {
    await seedProfile(page);
    await page.goto("/classes/cg-1");
    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);

    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);

    await page.goto("/classes/billing");
    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  });

  test("link de aluno inexistente mostra 'Aluno não encontrado'", async ({ page }) => {
    await seedProfile(page);
    await page.goto("/clients/xyz");
    await expect(page.getByText("Aluno não encontrado")).toBeVisible();
    await expect(page.getByText("O cadastro pode ter sido removido ou o link está incorreto.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "Alunos" }).click();
    await expect(page).toHaveURL("/clients");
  });
});

test.describe("topo e resumo", () => {
  test("contato, idade, aluno desde, mensalidade, aniversário e os cards", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    const header = page.locator("h1").locator("../..");
    await expect(header).toContainText("Ativo");
    await expect(header).toContainText("Aniversário em 2 dias");
    await expect(header).toContainText("(11) 97777-0000 · 35 anos · Aluno desde 01/09/2026");
    await expect(header).toContainText(/Mensal Jiu-Jitsu\s*·\s*R\$\s150,00\/mês/);

    // Mensalidade proporcional de 20 a 30/09 (R$ 55,00), vencida em 20/09.
    const open = kpi(page, "Em aberto");
    await expect(open).toContainText("R$ 55,00");
    await expect(open).toContainText("R$ 55,00 em atraso");
    const freq = kpi(page, "Frequência 30 dias");
    await expect(freq).toContainText("75%");
    await expect(freq).toContainText("3 presenças · 1 falta");
    const level = kpi(page, "Faixa atual");
    await expect(level).toContainText("Faixa Branca");
    await expect(level).toContainText("Jiu-Jitsu");
    // Sem pacote, sem o card.
    await expect(page.getByText("Pacote", { exact: true })).toHaveCount(0);
  });

  test("'Em aberto' zera depois de pagar pela aba Cobranças", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    await tab(page, "Cobranças").click();
    await expect(page).toHaveURL(`${PROFILE}?tab=charges`);
    const row = rowOf(page, "Mensalidade");
    await expect(row).toContainText("Atrasado");
    await page.getByRole("button", { name: `Ações de ${NAME}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Marcar pago" }).click();
    const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
    await pay.getByRole("radio", { name: "Pix" }).click();
    await pay.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();

    const open = kpi(page, "Em aberto");
    await expect(open).toContainText("R$ 0,00");
    await expect(open).toContainText("Nada em aberto");
    await expect(row).toContainText("Pago");
  });

  test("sem chamada no período e nível em palavras de níveis (Pilates)", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.categories = [modality("m-pil", "Pilates", 0, { progressionTrack: LEVELS_TRACK })];
      t.classGroups = [classGroup("cg-1", "Pilates Manhã", { modalityId: "m-pil" })];
      t.attendances = [];
      t.clients[0].progressions = { "m-pil": progression("m-pil", "Pilates", "lvl-gen-int", "Intermediário") };
    });
    await page.goto(PROFILE);
    await expect(kpi(page, "Frequência 30 dias")).toContainText("Sem chamada no período");
    await expect(kpi(page, "Frequência 30 dias")).toContainText("—");
    await expect(kpi(page, "Nível atual")).toContainText("Intermediário");
    await expect(page.getByText("Faixa atual", { exact: true })).toHaveCount(0);
  });

  test("bolsa parcial e mensalidade trancada no selo do topo, matrícula 'Trancada' na aba", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].discount = { type: "percentage", value: 50, scholarship: true, reason: "Atleta" };
      t.clients[0].membershipStatus = "paused";
      t.enrollments = [{ ...enrollment("e-1", "cg-1", "c-a"), status: "paused" }];
    });
    await page.goto(PROFILE);
    const header = page.locator("h1").locator("../..");
    await expect(header).toContainText(/Bolsa 50%\s*·\s*R\$\s75,00\/mês/);
    await expect(header).toContainText("Trancado");
    await expect(page.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" })).toContainText("Trancada");
    await tab(page, "Dados").click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("50% · Atleta");
    await expect(panel).toContainText("R$ 150,00");
  });

  test("bolsista integral sem plano: selo 'Bolsista integral'", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.clients[0].discount = { type: "percentage", value: 100, scholarship: true };
    });
    await page.goto(PROFILE);
    await expect(page.locator("h1").locator("../..")).toContainText("Bolsista integral");
  });

  test("sem plano, pacote ou curso: selo 'Sem mensalidade'", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
    });
    await page.goto(PROFILE);
    await expect(page.locator("h1").locator("../..")).toContainText("Sem mensalidade");
    await expect(kpi(page, "Em aberto")).toContainText("Nada em aberto");
  });

  test("pacote em uso: selo no topo e card 'Pacote' com o saldo", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.studentPackages = [studentPackage("sp-1", { lessonsUsed: 2, usages: usages(2) })];
    });
    await page.goto(PROFILE);
    const header = page.locator("h1").locator("../..");
    await expect(header).toContainText("Pacote 8 de 10");
    await expect(header).not.toContainText("Sem mensalidade");
    const card = kpi(page, "Pacote");
    await expect(card).toContainText("8 aulas");
    await expect(card).toContainText("Pacote 10 aulas · vale até 30/11/2026");
  });
});

/** Pacote de 10 aulas do catalogo e a compra da aluna. */
const lessonPackage = {
  id: "lp-10",
  organizationId: "org-academia-x",
  name: "Pacote 10 aulas",
  lessons: 10,
  priceCents: 40000,
  validityDays: 90,
  modalityIds: [],
  absenceConsumes: true,
  status: "active",
  createdAt: TS,
  updatedAt: TS,
};

function usages(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    sessionId: `cg-1~2026-09-${14 + i}~17:00`,
    classGroupId: "cg-1",
    date: `2026-09-${14 + i}`,
    reason: i === 1 ? "absent" : "present",
  }));
}

function studentPackage(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org-academia-x",
    studentId: "c-a",
    packageId: "lp-10",
    name: "Pacote 10 aulas",
    lessonsTotal: 10,
    lessonsUsed: 0,
    purchasedAt: "2026-09-01",
    expiresAt: "2026-11-30",
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
    chargeIds: [],
    usages: [],
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

test.describe("Editar e Mais ações", () => {
  test("Editar salva e a ficha mostra o nome novo", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    await page.getByRole("button", { name: "Editar", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Editar aluno" });
    await dialog.getByLabel("Nome").fill("Aluna Ficha Editada");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Aluno atualizado com sucesso.")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Aluna Ficha Editada" })).toBeVisible();
  });

  test("Nova cobrança com a aluna fixa entra no extrato e no 'Em aberto'", async ({ page }) => {
    await seedProfile(page);
    await page.goto(`${PROFILE}?tab=charges`);
    await moreAction(page, "Nova cobrança");
    const dialog = page.getByRole("dialog", { name: "Nova cobrança" });
    await expect(dialog).toContainText(`Cobrança avulsa para ${NAME}, à vista ou parcelada.`);
    await expect(dialog.getByRole("combobox", { name: "Aluno" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "+ Exame de faixa" }).click();
    await dialog.getByLabel("Valor").fill("8000");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Cobrança lançada.")).toBeVisible();

    await expect(rowOf(page, "Exame de faixa")).toContainText("R$ 80,00");
    await expect(kpi(page, "Em aberto")).toContainText("R$ 135,00");
    await expect(kpi(page, "Em aberto")).toContainText("R$ 55,00 em atraso");
  });

  test("Vender pacote: o pacote aparece na aba Pacotes, no topo e no card", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.lessonPackages = [lessonPackage];
    });
    await page.goto(`${PROFILE}?tab=packages`);
    await expect(page.getByText("Nenhum pacote ainda.")).toBeVisible();
    await moreAction(page, "Vender pacote");
    const dialog = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(dialog).toContainText(`Pacote de aulas para ${NAME}.`);
    await dialog.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await expect(dialog.getByLabel("Valor")).toHaveValue("400,00");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();

    await expect(rowOf(page, "Pacote 10 aulas")).toContainText("0 de 10 aulas usadas");
    await expect(kpi(page, "Pacote")).toContainText("10 aulas");
    await expect(page.locator("h1").locator("../..")).toContainText("Pacote 10 de 10");
  });

  test("Inativar com mensalidade em aberto: cancelar a cobrança e depois reativar", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    await moreAction(page, "Inativar");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Inativar aluno?");
    await expect(confirm).toContainText("1 mensalidade em aberto · R$ 55,00");
    await expect(confirm.getByRole("radio", { name: /Manter para receber/ })).toHaveAttribute("aria-checked", "true");
    await confirm.getByRole("radio", { name: /Cancelar a cobrança/ }).click();
    await confirm.getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Aluno inativado.")).toBeVisible();

    const header = page.locator("h1").locator("../..");
    await expect(header).toContainText("Inativo");
    await expect(kpi(page, "Em aberto")).toContainText("Nada em aberto");
    // Inativo: sem cobrar nem vender pelo topo.
    await page.getByRole("button", { name: "Mais ações" }).click();
    await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    const reactivate = page.getByRole("alertdialog");
    await expect(reactivate).toContainText("Reativar aluno?");
    await reactivate.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Aluno reativado.")).toBeVisible();
    await expect(header).toContainText("Ativo");

    // A mensalidade cancelada fica no extrato como cancelada (reabrivel).
    await tab(page, "Cobranças").click();
    await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Filtrar por situação" }).click();
    await page.getByRole("option", { name: /Canceladas/ }).click();
    const row = rowOf(page, "Mensalidade");
    await expect(row).toContainText("Cancelado");
    await expect(row).toContainText("Aluno inativado");
  });
});

test.describe("abas", () => {
  test("a aba fica na URL; a primeira sai dela; ?tab= abre direto", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    const names = ["Turmas e cursos", "Cobranças", "Pacotes", "Evolução", "Mensagens", "Dados"];
    for (const name of names) await expect(tab(page, name)).toBeVisible();
    await expect(tab(page, "Turmas e cursos")).toHaveAttribute("aria-selected", "true");

    const expected: Record<string, string> = {
      Cobranças: "charges",
      Pacotes: "packages",
      Evolução: "evolution",
      Mensagens: "messages",
      Dados: "data",
    };
    for (const [name, value] of Object.entries(expected)) {
      await tab(page, name).click();
      await expect(page).toHaveURL(`${PROFILE}?tab=${value}`);
      await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
    }
    await tab(page, "Turmas e cursos").click();
    await expect(page).toHaveURL(PROFILE);

    await page.goto(`${PROFILE}?tab=evolution`);
    await expect(tab(page, "Evolução")).toHaveAttribute("aria-selected", "true");
    // Aba desconhecida cai na primeira.
    await page.goto(`${PROFILE}?tab=xyz`);
    await expect(tab(page, "Turmas e cursos")).toHaveAttribute("aria-selected", "true");
  });

  test("Turmas e cursos: situações, curso concluído com certificado, busca e filtro", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.classGroups = [
        classGroup("cg-1", "Jiu-Jitsu Adulto"),
        classGroup("cg-old", "Jiu-Jitsu Kids"),
        classGroup("cg-course", "Defesa Pessoal", {
          billingMode: "course",
          coursePriceCents: 30000,
          courseMaxInstallments: 3,
          startDate: "2026-08-03",
          endDate: "2026-09-10",
          allowDropin: false,
          sessionPriceCents: undefined,
        }),
      ];
      t.enrollments = [
        enrollment("e-1", "cg-1", "c-a"),
        { ...enrollment("e-old", "cg-old", "c-a"), status: "canceled", canceledAt: "2026-09-05T12:00:00.000Z" },
        { ...enrollment("e-course", "cg-course", "c-a"), course: { priceCents: 30000, installments: 3 } },
      ];
    });
    await page.goto(PROFILE);
    await expect(page.getByText("3 matrículas")).toBeVisible();
    const active = page.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" });
    await expect(active).toContainText("Ativa");
    await expect(active).toContainText("Jiu-Jitsu · com Carlos Silva · desde 01/09/2026 · frequência 75%");
    const done = page.getByRole("button", { name: "Abrir turma Defesa Pessoal" });
    await expect(done).toContainText("Concluído");
    await expect(done).toContainText("Curso");
    await expect(done).toContainText("R$ 300,00 em 3x · 0 de 3 parcelas pagas");
    const canceled = page.getByRole("button", { name: "Abrir turma Jiu-Jitsu Kids" });
    await expect(canceled).toContainText("Cancelada");
    await expect(canceled).toContainText("saiu em 05/09/2026");

    // Concluído: "Certificado" no menu, com o aviso do Plano Pro no grátis (como na turma).
    await page.getByRole("button", { name: "Ações da matrícula em Defesa Pessoal", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Certificado (Plano Pro)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ações da matrícula em Jiu-Jitsu Adulto", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Certificado/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("combobox", { name: "Filtrar por situação" }).click();
    await page.getByRole("option", { name: "Concluídas" }).click();
    await expect(page.getByText("1 matrícula")).toBeVisible();
    await expect(done).toBeVisible();
    await expect(active).toHaveCount(0);
    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByLabel("Buscar turma").fill("kids");
    await expect(canceled).toBeVisible();
    await expect(page.getByText("1 matrícula")).toBeVisible();
    await page.getByLabel("Buscar turma").fill("natação");
    await expect(page.getByText("Nenhuma turma para esta busca.")).toBeVisible();

    // Clicar na linha abre a turma.
    await page.getByLabel("Buscar turma").fill("");
    await active.click();
    await expect(page).toHaveURL("/classes/cg-1");

    // O item do certificado leva a tela bloqueada do grátis.
    await page.goBack();
    await page.getByRole("button", { name: "Ações da matrícula em Defesa Pessoal", exact: true }).click();
    await page.getByRole("menuitem", { name: "Certificado (Plano Pro)" }).click();
    await expect(page).toHaveURL("/classes/cg-course/certificate/e-course");
    await expect(page.getByText("Certificado de conclusão no Plano Pro.")).toBeVisible();
  });

  test("Cobranças: extrato de todos os tipos, filtros, busca e substituídas com 'Mostrar'", async ({ page }) => {
    const charge = (id: string, over: Record<string, unknown>) => ({
      id,
      organizationId: "org-academia-x",
      unitId: "unit-academia-x",
      studentId: "c-a",
      dueDate: "2026-09-25",
      amountCents: 25000,
      status: "pending",
      createdAt: TS,
      updatedAt: TS,
      ...over,
    });
    await seedProfile(page, (t) => {
      t.charges = [
        charge("ch-kimono", { kind: "extra", description: "Kimono", competence: "2026-09" }),
        charge("ch-aug", {
          kind: "membership",
          planId: "p-m",
          competence: "2026-08",
          dueDate: "2026-08-10",
          amountCents: 15000,
          status: "paid",
          paidAt: "2026-08-10T12:00:00.000Z",
          method: "pix",
        }),
        charge("ch-old", {
          kind: "membership",
          planId: "p-m",
          competence: "2026-07",
          dueDate: "2026-07-10",
          amountCents: 15000,
          status: "canceled",
          canceledBy: "system",
          replaced: true,
          notes: "Substituída pela troca de plano",
        }),
      ];
    });
    await page.goto(`${PROFILE}?tab=charges`);
    // Setembro (gerada ao abrir) + kimono + agosto; julho substituida fica oculta.
    await expect(page.getByText("3 cobranças")).toBeVisible();
    await expect(page.getByText("1 cobrança substituída por troca de plano ou regra está oculta.")).toBeVisible();
    await expect(rowOf(page, "Kimono")).toContainText("R$ 250,00");
    await expect(rowOf(page, "Mensalidade 08/2026")).toContainText("Pago");

    await page.getByRole("button", { name: "Mostrar" }).click();
    await expect(page.getByRole("combobox", { name: "Filtrar por situação" })).toContainText("Substituídas");
    await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
    await expect(rowOf(page, "Mensalidade 07/2026")).toContainText("Substituída");

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
    await page.getByRole("option", { name: "Cobranças avulsas" }).click();
    await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
    await expect(rowOf(page, "Kimono")).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByLabel("Buscar cobrança").fill("08/2026");
    await expect(page.getByText("1 cobrança", { exact: true })).toBeVisible();
    // Desfazer o pagamento de agosto pede confirmacao.
    await rowOf(page, "Mensalidade 08/2026").getByTitle("Desfazer pagamento").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer pagamento" }).click();
    await expect(page.getByText("Pagamento desfeito.")).toBeVisible();
    await expect(rowOf(page, "Mensalidade 08/2026")).toContainText("Atrasado");
    await page.getByLabel("Buscar cobrança").fill("xyz");
    await expect(page.getByText("Nenhuma cobrança para esta busca.")).toBeVisible();
  });

  test("Pacotes: aulas usadas, renovar e cancelar só sem aula usada", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.lessonPackages = [lessonPackage];
      t.studentPackages = [
        studentPackage("sp-used", { lessonsUsed: 2, usages: usages(2) }),
        studentPackage("sp-old", { status: "renewed", purchasedAt: "2026-06-01", expiresAt: "2026-08-30" }),
      ];
    });
    await page.goto(`${PROFILE}?tab=packages`);
    await expect(page.getByText("2 pacotes")).toBeVisible();
    const used = page.locator("div.group").filter({ hasText: "2 de 10 aulas usadas" });
    await expect(used).toContainText("comprado 01/09/26 · vale até 30/11/26 · todas as modalidades");
    await expect(page.getByText("Renovado")).toBeVisible();

    // Clicar na linha mostra as aulas usadas.
    await used.click();
    await expect(page.getByText("15/09/2026 · Jiu-Jitsu Adulto")).toBeVisible();
    await expect(page.getByText("Falta sem justificativa")).toBeVisible();
    await expect(page.getByText("Presença", { exact: true })).toBeVisible();

    // Com aula usada nao cancela; renovar abre a venda com o pacote escolhido.
    await page.getByRole("button", { name: "Ações do pacote Pacote 10 aulas", exact: true }).click();

    await expect(page.getByRole("menuitem", { name: "Cancelar pacote" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Ocultar aulas" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Renovar" }).click();
    const sell = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(sell.getByRole("combobox", { name: "Pacote" })).toContainText("Pacote 10 aulas");
    await expect(sell).toContainText("O saldo de 8 aulas do pacote atual passa para este.");
    await sell.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("combobox", { name: "Filtrar por situação" }).click();
    await page.getByRole("option", { name: "Renovados" }).click();
    await expect(page.getByText("1 pacote", { exact: true })).toBeVisible();
    await page.getByLabel("Buscar pacote").fill("xyz");
    await expect(page.getByText("Nenhum pacote para esta busca.")).toBeVisible();
  });

  test("Pacotes: cancelar pacote sem aula usada cancela as cobranças dele", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.lessonPackages = [lessonPackage];
    });
    // Vende pela ficha (gera a cobranca do pacote) e cancela em seguida.
    await page.goto(`${PROFILE}?tab=packages`);
    await page.getByRole("button", { name: "Vender pacote" }).click();
    const sell = page.getByRole("dialog", { name: "Vender pacote" });
    await sell.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await sell.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await expect(kpi(page, "Em aberto")).toContainText("R$ 400,00");

    await page.getByRole("button", { name: "Ações do pacote Pacote 10 aulas", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cancelar pacote" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("O pacote Pacote 10 aulas é cancelado.");
    await confirm.getByRole("button", { name: "Cancelar pacote" }).click();
    await expect(page.getByText("Pacote cancelado.")).toBeVisible();
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(kpi(page, "Em aberto")).toContainText("Nada em aberto");
    await expect(kpi(page, "Pacote")).toHaveCount(0);

    // Cancelado nao trava: o botao da aba continua e vende outro pacote.
    await page.getByRole("button", { name: "Vender pacote" }).click();
    const again = page.getByRole("dialog", { name: "Vender pacote" });
    await again.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await again.getByRole("button", { name: "Adicionar" }).click();
    await expect(again).toHaveCount(0);
    await expect(page.getByText("2 pacotes", { exact: true })).toBeVisible();
    await expect(kpi(page, "Em aberto")).toContainText("R$ 400,00");
  });

  test("Evolução: um card por modalidade; Notas só na modalidade com avaliações", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.categories = [
        modality("m-jj", "Jiu-Jitsu", 0),
        modality("m-ing", "Inglês", 1, { progressionTrack: LEVELS_TRACK, assessments: gradedSettings() }),
      ];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto"), classGroup("cg-ing", "Inglês Noite", { modalityId: "m-ing" })];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-ing", "c-a")];
      t.clients[0].progressions = {
        "m-jj": jjWhite({
          goals: [{ id: "g-1", title: "Passagem de guarda", target: 10, progress: 2, createdAt: TS }],
          evaluations: [
            { id: "ev-1", date: "2026-09-21", tone: "positive", note: "Boa base", createdAt: TS, authorName: "Carlos Silva" },
          ],
        }),
      };
      t.assessments = [assessment("as-1", "cg-ing", "m-ing", "Prova oral", { grades: [grade("c-a", 8.5)] })];
    });
    await page.goto(`${PROFILE}?tab=evolution`);
    const jj = page.locator("section").filter({ has: page.getByRole("heading", { name: "Jiu-Jitsu" }) });
    const ing = page.locator("section").filter({ has: page.getByRole("heading", { name: "Inglês" }) });
    await expect(jj).toContainText("Faixa Branca");
    await expect(jj).toContainText("Graduação em 01/03/2026 · 1 meta em aberto");
    await expect(jj).toContainText("Boa base");
    await expect(jj.getByRole("button", { name: "Notas" })).toHaveCount(0);
    await expect(ing).toContainText("Iniciante");
    await expect(ing).toContainText("Nenhum registro de aula ainda.");
    await expect(ing.getByRole("button", { name: "Níveis" })).toBeVisible();

    await ing.getByRole("button", { name: "Notas" }).click();
    const notes = page.getByRole("dialog", { name: "Notas" });
    await expect(notes).toContainText(NAME);
    await expect(notes).toContainText("Prova oral");
    await expect(notes).toContainText("8,5");
    await page.keyboard.press("Escape");

    await jj.getByRole("button", { name: "Registros de aula" }).click();
    const records = page.getByRole("dialog", { name: "Registros de aula" });
    await expect(records).toContainText(`${NAME} · Jiu-Jitsu`);
    await page.keyboard.press("Escape");
    await jj.getByRole("button", { name: "Graduação" }).click();
    const levels = page.getByRole("dialog");
    await expect(levels.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(levels).toContainText(`${NAME} · Jiu-Jitsu`);
  });

  test("Evolução sem trilha mostra o aviso", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.categories = [modality("m-fun", "Funcional", 0, { progressionTrack: { ...LEVELS_TRACK, enabled: false } })];
      t.classGroups = [classGroup("cg-1", "Funcional", { modalityId: "m-fun" })];
      t.clients[0].progressions = undefined;
    });
    await page.goto(`${PROFILE}?tab=evolution`);
    await expect(page.getByText("Sem trilha de evolução ainda.")).toBeVisible();
    // Sem nivel, sem o card de nivel no topo.
    await expect(page.getByText("Nível atual", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Faixa atual", { exact: true })).toHaveCount(0);
  });

  test("Mensagens: 'Nova mensagem' com a aluna fixa entra no histórico da ficha", async ({ page }) => {
    await seedProfile(page);
    await page.goto(`${PROFILE}?tab=messages`);
    await expect(page.getByText("Nenhuma mensagem ainda.")).toBeVisible();
    await page.getByRole("button", { name: "Nova mensagem" }).first().click();
    const dialog = page.getByRole("dialog", { name: `Mensagem para ${NAME}` });
    await expect(dialog.getByRole("combobox", { name: "Aluno" })).toHaveCount(0);
    await dialog.getByLabel("Mensagem").fill("Aula extra no sábado 🥋");
    const link = await openedWhatsApp(page, () => dialog.getByRole("button", { name: "Abrir no WhatsApp" }).click());
    expect(link.phone).toBe("5511977770000");
    expect(link.text).toBe("Aula extra no sábado 🥋");
    await expect(dialog).toBeHidden();

    await waitForStore(page, (raw) => raw.includes("Aula extra no sábado"));
    const row = page.getByRole("button", { name: /^Mensagem de / });
    await expect(row).toContainText("Mensagem avulsa");
    await expect(row).toContainText("Hoje às");
    await expect(page.getByText("1 mensagem", { exact: true })).toBeVisible();
    await row.click();
    await expect(page.getByRole("dialog")).toContainText("Aula extra no sábado 🥋");
    await page.keyboard.press("Escape");

    // Aparece tambem no Historico da Comunicacao.
    await page.goto("/communication");
    await page.getByRole("tab", { name: "Histórico" }).click();
    await expect(page.getByRole("button", { name: `Mensagem para ${NAME}`, exact: true })).toContainText("Mensagem avulsa");
  });

  test("Mensagens: aluno sem WhatsApp não envia", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].phone = "97777000";
    });
    await page.goto(`${PROFILE}?tab=messages`);
    await page.getByRole("button", { name: "Nova mensagem" }).first().click();
    const dialog = page.getByRole("dialog", { name: `Mensagem para ${NAME}` });
    await expect(dialog.getByText("Este aluno não tem WhatsApp com DDD no cadastro.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Abrir no WhatsApp" })).toBeDisabled();
  });

  test("Dados: cadastro, mensalidade e responsáveis; 'Editar' abre o formulário", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].guardians = [{ name: "Maria Ficha", relationship: "Mãe", phone: "11966660000" }];
    });
    await page.goto(`${PROFILE}?tab=data`);
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("aluna@ficha.com");
    await expect(panel).toContainText("24/09/1990 · 35 anos");
    await expect(panel).toContainText("Prefere a turma da noite");
    await expect(panel).toContainText("Mensal Jiu-Jitsu");
    await expect(panel).toContainText("R$ 150,00/mês");
    await expect(panel).toContainText("Dia 10");
    await expect(panel).toContainText("Antecipado");
    await expect(panel).toContainText("Maria Ficha · Mãe");
    await expect(panel).toContainText("(11) 96666-0000");
    await panel.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("dialog", { name: "Editar aluno" })).toBeVisible();
  });
});

test.describe("comunicação", () => {
  test("modelos 'Lembrete de cobrança' e 'Pacote acabando': prévia com as variáveis e texto editado", async ({ page }) => {
    await seedProfile(page);
    await page.goto("/communication");
    const card = (title: string) =>
      page.locator("div.rounded-xl").filter({ has: page.getByText(title, { exact: true }) }).last();
    const reminder = card("Lembrete de cobrança");
    await expect(reminder).toContainText(
      "Olá, Ana Souza! Lembrete da parcela 2 de 4 do curso Confeitaria de R$ 150,00 na Academia X, com vencimento em 10/11.",
    );
    // Sem pagamento online, a frase do link sai inteira.
    await expect(reminder).not.toContainText("{link_pagamento}");
    await expect(reminder).not.toContainText("Pague pelo link");
    const ending = card("Pacote acabando");
    await expect(ending).toContainText("Oi, Ana Souza! Sobre seu pacote 10 aulas na Academia X: resta 1 aula.");

    await ending.getByRole("button", { name: "Editar texto" }).click();
    const dialog = page.getByRole("dialog", { name: "Pacote acabando" });
    // Chips das variaveis do modelo, com nomes simples.
    await expect(dialog.getByRole("button", { name: "+ Nome do pacote" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+ Aulas e validade" })).toBeVisible();
    await dialog.getByLabel("Texto").fill("{aluno}, seu pacote {pacote}: {restante}. Renova?");
    await expect(dialog).toContainText("Ana Souza, seu pacote 10 aulas: resta 1 aula. Renova?");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Mensagem salva.")).toBeVisible();
    await page.reload();
    await expect(card("Pacote acabando")).toContainText("Ana Souza, seu pacote 10 aulas: resta 1 aula. Renova?");
  });

  test("'Lembrar no WhatsApp' de uma avulsa pela ficha usa o 'Lembrete de cobrança' e entra em Mensagens", async ({
    page,
  }) => {
    await seedProfile(page, (t) => {
      t.charges = [
        {
          id: "ch-kimono",
          organizationId: "org-academia-x",
          unitId: "unit-academia-x",
          studentId: "c-a",
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
    await page.goto(`${PROFILE}?tab=charges`);
    const link = await openedWhatsApp(page, async () => {
      await rowOf(page, "Kimono").getByRole("button", { name: `Ações de ${NAME}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Lembrar no WhatsApp" }).click();
    });
    expect(link.phone).toBe("5511977770000");
    expect(link.text).toContain(`Olá, ${NAME}! Lembrete da cobrança Kimono de R$ 250,00 na Academia X, com vencimento em 25/09.`);
    expect(link.text).not.toContain("{");

    await waitForStore(page, (raw) => raw.includes("charge_reminder"));
    await tab(page, "Mensagens").click();
    const row = page.getByRole("button", { name: /^Mensagem de / });
    await expect(row).toContainText("Lembrete de cobrança");
    await expect(row).toContainText("Aberto no WhatsApp");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Lida" }).click();
    await expect(page.getByText("Nenhum resultado para os filtros aplicados.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(row).toBeVisible();
  });
});
