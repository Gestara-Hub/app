import type { Page } from "@playwright/test";
import {
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  pageAction,
  profileAlert,
  profileSection,
  seedAcademy,
  student,
  test,
  type ProfileSectionTitle,
} from "./fixtures";
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
 * Ficha do aluno (`/clients/[id]`, doc 22 item 2, doc 07 §1.8): por onde se
 * chega, o topo (so nome e situacao), os avisos do que pede acao, a sanfona de
 * secoes com o resumo de cada uma (`?tab=` abre uma), "Editar" e o menu ⋮.
 * Hoje e terca 22/09/2026, 12h; a turma padrao (Jiu-Jitsu) e seg/ter/qua 17h.
 */

const PROFILE = "/clients/c-a";
const NAME = "Aluna Ficha";
/** Faz 36 anos em 24/09 (daqui a 2 dias, fora do aviso de aniversario): hoje tem 35. */
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

/** Cobranca da aluna gravada direto no mundo (padrao: R$ 250,00 pendente, vence 25/09). */
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

const moreAction = (page: Page, item: string) => pageAction(page, "Mais ações do aluno", item);

test.describe("por onde se chega na ficha", () => {
  test("Alunos: nome, linha, 'Abrir ficha', card e o link de volta", async ({ page }) => {
    await seedProfile(page);
    await skipClientsCoachmark(page);
    await page.goto("/clients");

    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(PROFILE);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    // "Voltar" volta para a tela anterior do app (aqui, a lista de Alunos).
    await page.getByRole("link", { name: "Voltar", exact: true }).click();
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

  test("turma (linha), chamada (menu do aluno) e Cobranças (nome) levam à ficha", async ({ page }) => {
    await seedProfile(page);
    await page.goto("/classes/cg-1");
    // Na turma o nome nao e link: tocar na linha abre a ficha.
    const classRow = page.getByRole("main").getByText(NAME, { exact: true });
    await expect(classRow).toBeVisible();
    await expect(page.getByRole("link", { name: NAME })).toHaveCount(0);
    await classRow.click();
    await expect(page).toHaveURL(PROFILE);

    // Na chamada tocar na linha marca presenca: a ficha fica no menu do aluno.
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
    const sessionMenu = page.getByRole("button", { name: `Ações de ${NAME}`, exact: true });
    await expect(sessionMenu).toBeVisible();
    await expect(page.getByRole("link", { name: NAME })).toHaveCount(0);
    await sessionMenu.click();
    await page.getByRole("menuitem", { name: "Abrir ficha", exact: true }).click();
    await expect(page).toHaveURL(PROFILE);

    await page.goto("/classes/billing?status=all");
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

test.describe("topo e resumos das seções", () => {
  test("topo só com nome e situação; contato, idade e 'Aluno desde' no resumo do Cadastro", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await expect(page.locator("h1").locator("..")).toContainText("Ativo");

    // Tudo fechado, cada linha com o resumo dela. Sem pacote ativo, sem "Pacotes".
    for (const title of ["Turmas", "Cobranças", "Evolução", "Mensagens", "Cadastro"] as const) {
      await expect(profileSection(page, title)).toHaveAttribute("aria-expanded", "false");
    }
    await expect(profileSection(page, "Pacotes")).toHaveCount(0);
    await expect(profileSection(page, "Turmas")).toContainText("1 turma · próxima hoje, 17:00");
    // Mensalidade proporcional de 20 a 30/09 (R$ 55,00), vencida em 20/09.
    await expect(profileSection(page, "Cobranças")).toContainText("1 em aberto · R$ 55,00 · 1 atrasada");
    await expect(profileSection(page, "Evolução")).toContainText("Faixa Branca");
    await expect(profileSection(page, "Mensagens")).toContainText("Nenhuma mensagem");
    await expect(profileSection(page, "Cadastro")).toContainText("(11) 97777-0000 · 35 anos · Aluno desde 01/09/2026");

    // Aniversario daqui a 2 dias nao vira aviso (so hoje ou amanha).
    await expect(page.getByText(/^Faz aniversário/)).toHaveCount(0);

    // A mensalidade do plano fica no Cadastro.
    const data = await openProfileSection(page, "Cadastro");
    await expect(data).toContainText("Mensal Jiu-Jitsu");
    await expect(data).toContainText("R$ 150,00/mês");
  });

  test("Turmas: atalho 'Próxima aula' para a chamada e a presença na linha da turma", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    const classes = await openProfileSection(page, "Turmas");
    // A secao abre ali mesmo: a URL nao muda.
    await expect(page).toHaveURL(PROFILE);
    const row = classes.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" });
    // 3 presencas e 1 falta: 75%.
    await expect(row).toContainText("75%");
    await expect(row).toContainText("Carlos Silva");

    const next = classes.getByRole("link", { name: /^Próxima aula/ });
    await expect(next).toContainText("Hoje, 17:00 · Jiu-Jitsu Adulto");
    await next.click();
    await expect(page).toHaveURL(/\/classes\/sessions\/cg-1~2026-09-22~17(%3A|:)00$/);
  });

  test("Pilates: nível em palavras de níveis; sem chamada, sem presença na linha", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.categories = [modality("m-pil", "Pilates", 0, { progressionTrack: LEVELS_TRACK })];
      t.classGroups = [classGroup("cg-1", "Pilates Manhã", { modalityId: "m-pil" })];
      t.attendances = [];
      t.clients[0].progressions = { "m-pil": progression("m-pil", "Pilates", "lvl-gen-int", "Intermediário") };
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Evolução")).toContainText("Intermediário");

    const classes = await openProfileSection(page, "Turmas");
    const row = classes.getByRole("button", { name: "Abrir turma Pilates Manhã" });
    await expect(row).toContainText("Carlos Silva");
    await expect(row).not.toContainText("%");
    await expect(row).not.toContainText("Presença baixa");

    // O card da modalidade fala em "Níveis", nao em "Graduação".
    const evolution = await openProfileSection(page, "Evolução");
    const card = evolution.locator("section").filter({ has: page.getByRole("heading", { name: "Pilates" }) });
    await expect(card).toContainText("Intermediário");
    await expect(card.getByRole("button", { name: "Níveis" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Graduação" })).toHaveCount(0);
  });

  test("bolsa parcial e mensalidade trancada no Cadastro, matrícula 'Trancada' em Turmas", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].discount = { type: "percentage", value: 50, scholarship: true, reason: "Atleta" };
      t.clients[0].membershipStatus = "paused";
      t.enrollments = [{ ...enrollment("e-1", "cg-1", "c-a"), status: "paused" }];
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Turmas")).toContainText("Nenhuma turma ativa");
    const classes = await openProfileSection(page, "Turmas");
    // Trancada segue em andamento (na lista, sem "Mostrar encerradas").
    await expect(classes.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" })).toContainText("Trancada");

    const data = await openProfileSection(page, "Cadastro");
    await expect(data).toContainText("50% · Atleta");
    await expect(data).toContainText("R$ 75,00/mês");
    // Preco de tabela riscado ao lado.
    await expect(data).toContainText("R$ 150,00");
    await expect(data).toContainText("Trancada");
  });

  test("bolsista integral sem plano: bolsa 'Integral' no Cadastro", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.clients[0].discount = { type: "percentage", value: 100, scholarship: true };
    });
    await page.goto(PROFILE);
    const data = await openProfileSection(page, "Cadastro");
    // A tela mostra a bolsa (nao "Sem mensalidade").
    await expect(data).toContainText("Integral");
  });

  test("sem plano, pacote ou curso: 'Sem mensalidade' no Cadastro e nada em aberto", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Cobranças")).toContainText("Nada em aberto");
    // Sem cobranca, sem aviso de atraso.
    await expect(page.getByText(/atrasadas?$/)).toHaveCount(0);
    const data = await openProfileSection(page, "Cadastro");
    await expect(data).toContainText("Sem mensalidade");
  });

  test("pacote em uso: seção Pacotes com o saldo no resumo", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.studentPackages = [studentPackage("sp-1", { lessonsUsed: 2, usages: usages(2) })];
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Pacotes")).toContainText("Pacote 10 aulas · 8 aulas restantes");
    const packages = await openProfileSection(page, "Pacotes");
    await expect(packages).toContainText("Restam 8 de 10");
    await expect(packages).toContainText("vale até 30/11/26");
  });
});

test.describe("avisos do topo", () => {
  test("atraso único: o aviso diz o que é, 'Cobrar' abre o WhatsApp e 'Marcar pago' tira o aviso", async ({ page }) => {
    await seedProfile(page);
    await page.goto(PROFILE);
    const overdue = profileAlert(page, "Mensalidade de setembro atrasada");
    await expect(overdue).toContainText("R$ 55,00 · venceu 20/09");

    const link = await openedWhatsApp(page, () => overdue.getByRole("button", { name: "Cobrar" }).click());
    expect(link.phone).toBe("5511977770000");
    expect(link.text).not.toContain("{");

    await overdue.getByRole("button", { name: "Marcar pago" }).click();
    const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
    await pay.getByRole("radio", { name: "Pix" }).click();
    await pay.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
    await expect(overdue).toHaveCount(0);
    await expect(profileSection(page, "Cobranças")).toContainText("Nada em aberto");
  });

  test("várias atrasadas: um aviso só, 'Ver cobranças' abre a seção Cobranças", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.charges = [charge("ch-kimono", { kind: "extra", description: "Kimono", competence: "2026-09", dueDate: "2026-09-15" })];
    });
    await page.goto(PROFILE);
    const overdue = profileAlert(page, "2 cobranças atrasadas");
    await expect(overdue).toContainText("R$ 305,00 · a mais antiga venceu 15/09");
    await expect(overdue.getByRole("button", { name: "Marcar pago" })).toHaveCount(0);
    await expect(profileSection(page, "Cobranças")).toContainText("2 em aberto · R$ 305,00 · 2 atrasadas");

    await overdue.getByRole("button", { name: "Ver cobranças" }).click();
    await expect(profileSection(page, "Cobranças")).toHaveAttribute("aria-expanded", "true");
    await expect(rowOf(page, "Kimono")).toContainText("Atrasado");
  });

  test("faltas seguidas e aniversário amanhã: avisos com a mensagem pronta", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].birthDate = "1990-09-23";
      t.attendances = [
        present("cg-1~2026-09-14~17:00"),
        present("cg-1~2026-09-15~17:00", "absent"),
        present("cg-1~2026-09-16~17:00", "absent"),
        present("cg-1~2026-09-21~17:00", "absent"),
      ];
    });
    await page.goto(PROFILE);
    const absence = profileAlert(page, "Faltou nas últimas 3 aulas");
    await expect(absence).toContainText("Desde 15/09 · Jiu-Jitsu Adulto");
    await expect(absence.getByRole("button", { name: "Mandar mensagem" })).toBeVisible();

    const birthday = profileAlert(page, "Faz aniversário amanhã");
    await expect(birthday).toContainText("36 anos em 23/09");
    await expect(birthday.getByRole("button", { name: "Mandar parabéns" })).toBeVisible();

    // 1 presenca em 4 chamadas: a linha da turma avisa.
    const classes = await openProfileSection(page, "Turmas");
    await expect(classes.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" })).toContainText("Presença baixa");
  });

  test("pacote na última aula: aviso com 'Avisar' e 'Vender pacote' já com o pacote", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].planId = undefined;
      t.lessonPackages = [lessonPackage];
      t.studentPackages = [studentPackage("sp-1", { lessonsUsed: 9 })];
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Pacotes")).toContainText("Pacote 10 aulas · 1 aula restante");
    const ending = profileAlert(page, "Pacote Pacote 10 aulas");
    await expect(ending).toContainText("Resta 1 aula");
    await expect(ending.getByRole("button", { name: "Avisar" })).toBeVisible();

    await ending.getByRole("button", { name: "Vender pacote" }).click();
    const sell = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(sell).toContainText(`Pacote de aulas para ${NAME}.`);
    await expect(sell.getByRole("combobox", { name: "Pacote" })).toContainText("Pacote 10 aulas");
    await sell.getByRole("button", { name: "Cancelar" }).click();
    await expect(sell).toHaveCount(0);
  });
});

test.describe("Editar e o menu ⋮ do aluno", () => {
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

  test("Nova cobrança com a aluna fixa entra no extrato e no resumo de Cobranças", async ({ page }) => {
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
    await expect(profileSection(page, "Cobranças")).toContainText("2 em aberto · R$ 135,00 · 1 atrasada");
    // A nova nao esta atrasada: o aviso segue so com a mensalidade.
    await expect(profileAlert(page, "Mensalidade de setembro atrasada")).toContainText("R$ 55,00");
  });

  test("Vender pacote pelo menu: a seção Pacotes aparece com o pacote", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.lessonPackages = [lessonPackage];
    });
    await page.goto(PROFILE);
    // Sem pacote ativo, sem a secao.
    await expect(profileSection(page, "Pacotes")).toHaveCount(0);
    await moreAction(page, "Vender pacote");
    const dialog = page.getByRole("dialog", { name: "Vender pacote" });
    await expect(dialog).toContainText(`Pacote de aulas para ${NAME}.`);
    await dialog.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await expect(dialog.getByLabel("Valor")).toHaveValue("400,00");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();

    await expect(profileSection(page, "Pacotes")).toContainText("Pacote 10 aulas · 10 aulas restantes");
    await expect(profileSection(page, "Cobranças")).toContainText("R$ 455,00");
    await openProfileSection(page, "Pacotes");
    await expect(rowOf(page, "Pacote 10 aulas")).toContainText("Restam 10 de 10");
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

    const header = page.locator("h1").locator("..");
    await expect(header).toContainText("Inativo");
    await expect(profileSection(page, "Cobranças")).toContainText("Nada em aberto");
    await expect(profileAlert(page, "Mensalidade de setembro atrasada")).toHaveCount(0);
    // Inativo: sem cobrar nem vender pelo menu do topo.
    await page.getByRole("button", { name: "Mais ações do aluno", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    const reactivate = page.getByRole("alertdialog");
    await expect(reactivate).toContainText("Reativar aluno?");
    await reactivate.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Aluno reativado.")).toBeVisible();
    await expect(header).toContainText("Ativo");

    // A mensalidade cancelada fica no extrato como cancelada (reabrivel).
    await openProfileSection(page, "Cobranças");
    await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
    await page.getByRole("combobox", { name: "Filtrar por situação" }).click();
    await page.getByRole("option", { name: /Canceladas/ }).click();
    const row = rowOf(page, "Mensalidade");
    await expect(row).toContainText("Cancelado");
    await expect(row).toContainText("Aluno inativado");
  });
});

test.describe("seções", () => {
  test("sanfona: tudo fechado, abre e fecha ali mesmo; ?tab= abre uma seção", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.lessonPackages = [lessonPackage];
      t.studentPackages = [studentPackage("sp-1")];
    });
    await page.goto(PROFILE);
    const titles: ProfileSectionTitle[] = ["Turmas", "Cobranças", "Pacotes", "Evolução", "Mensagens", "Cadastro"];
    for (const title of titles) await expect(profileSection(page, title)).toHaveAttribute("aria-expanded", "false");
    const expanded = page.getByRole("main").getByRole("button", { expanded: true });

    // Abre mais de uma ao mesmo tempo, sem mexer na URL.
    const charges = await openProfileSection(page, "Cobranças");
    await expect(charges.getByLabel("Buscar cobrança")).toBeVisible();
    const data = await openProfileSection(page, "Cadastro");
    await expect(data).toContainText("aluna@ficha.com");
    await expect(expanded).toHaveCount(2);
    await expect(page).toHaveURL(PROFILE);

    // Tocar de novo fecha.
    await profileSection(page, "Cobranças").click();
    await expect(profileSection(page, "Cobranças")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Buscar cobrança")).toHaveCount(0);
    await expect(page).toHaveURL(PROFILE);

    // `?tab=` (links antigos e de outras telas) abre so aquela secao.
    const ids: [ProfileSectionTitle, string][] = [
      ["Turmas", "classes"],
      ["Cobranças", "charges"],
      ["Pacotes", "packages"],
      ["Evolução", "evolution"],
      ["Mensagens", "messages"],
      ["Cadastro", "data"],
    ];
    for (const [title, id] of ids) {
      await page.goto(`${PROFILE}?tab=${id}`);
      await expect(profileSection(page, title)).toHaveAttribute("aria-expanded", "true");
      await expect(expanded).toHaveCount(1);
    }
    // Secao desconhecida: tudo fechado.
    await page.goto(`${PROFILE}?tab=xyz`);
    await expect(profileSection(page, "Turmas")).toHaveAttribute("aria-expanded", "false");
    await expect(expanded).toHaveCount(0);
  });

  test("Turmas: em andamento na lista, encerradas atrás de 'Mostrar encerradas', certificado do curso", async ({ page }) => {
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
    // O resumo conta so as ativas.
    await expect(profileSection(page, "Turmas")).toContainText("1 turma · próxima hoje, 17:00");
    await openProfileSection(page, "Turmas");
    const active = page.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" });
    const done = page.getByRole("button", { name: "Abrir turma Defesa Pessoal" });
    const canceled = page.getByRole("button", { name: "Abrir turma Jiu-Jitsu Kids" });
    // Modalidade no nome da turma: a linha diz so o professor.
    await expect(active).toContainText("Carlos Silva");
    await expect(active).not.toContainText("Jiu-Jitsu ·");
    await expect(active).toContainText("75%");
    await expect(done).toHaveCount(0);
    await expect(canceled).toHaveCount(0);

    // Concluidas e canceladas atras do botao.
    await page.getByRole("button", { name: "Mostrar encerradas (2)" }).click();
    await expect(done).toContainText("Jiu-Jitsu · Carlos Silva · Curso até 10/09");
    await expect(done).toContainText("Concluído");
    await expect(canceled).toContainText("Saiu em 05/09");

    // Concluido: "Certificado" no menu, com o aviso do Plano Pro no gratis (como na turma).
    await page.getByRole("button", { name: "Ações da matrícula em Defesa Pessoal", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Certificado (Plano Pro)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ações da matrícula em Jiu-Jitsu Adulto", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Certificado/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Ocultar encerradas" }).click();
    await expect(done).toHaveCount(0);
    await expect(canceled).toHaveCount(0);

    // Clicar na linha abre a turma.
    await active.click();
    await expect(page).toHaveURL("/classes/cg-1");

    // O item do certificado leva a tela bloqueada do gratis.
    await page.goBack();
    await openProfileSection(page, "Turmas");
    await page.getByRole("button", { name: /^Mostrar encerradas/ }).click();
    await page.getByRole("button", { name: "Ações da matrícula em Defesa Pessoal", exact: true }).click();
    await page.getByRole("menuitem", { name: "Certificado (Plano Pro)" }).click();
    await expect(page).toHaveURL("/classes/cg-course/certificate/e-course");
    await expect(page.getByText("Faz parte do Plano Pro. Imprima ou salve em PDF no fim do curso.")).toBeVisible();
  });

  test("Turmas: só encerradas mostra 'Nenhuma turma em andamento.'", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.enrollments = [{ ...enrollment("e-1", "cg-1", "c-a"), status: "canceled", canceledAt: "2026-09-05T12:00:00.000Z" }];
    });
    await page.goto(PROFILE);
    await expect(profileSection(page, "Turmas")).toContainText("Nenhuma turma ativa");
    const classes = await openProfileSection(page, "Turmas");
    await expect(classes.getByText("Nenhuma turma em andamento.")).toBeVisible();
    await classes.getByRole("button", { name: "Mostrar encerradas (1)" }).click();
    await expect(classes.getByRole("button", { name: "Abrir turma Jiu-Jitsu Adulto" })).toContainText("Saiu em 05/09");
  });

  test("Cobranças: extrato de todos os tipos, filtros, busca e substituídas com 'Mostrar'", async ({ page }) => {
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
    await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
    await expect(rowOf(page, "Mensalidade 07/2026")).toContainText("Substituída");

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
    await page.getByRole("option", { name: "Cobranças avulsas" }).click();
    await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
    await expect(rowOf(page, "Kimono")).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await page.getByLabel("Buscar cobrança").fill("08/2026");
    await expect(page.getByText(/(^|· )1 cobrança$/)).toBeVisible();
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
    const used = page.locator("div.group").filter({ hasText: "Restam 8 de 10" });
    await expect(used).toContainText("comprado 01/09/26 · vale até 30/11/26 · todas as turmas");
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
    await expect(sell).toContainText("saldo de 8 aulas será somado a este novo pacote (total de 18 aulas)");
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
    // Vende pelo menu da ficha (gera a cobranca do pacote) e cancela em seguida.
    await page.goto(PROFILE);
    await moreAction(page, "Vender pacote");
    const sell = page.getByRole("dialog", { name: "Vender pacote" });
    await sell.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await sell.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await expect(profileSection(page, "Cobranças")).toContainText("1 em aberto · R$ 400,00");

    await openProfileSection(page, "Pacotes");
    await page.getByRole("button", { name: "Ações do pacote Pacote 10 aulas", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cancelar pacote" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("O pacote Pacote 10 aulas é cancelado.");
    await confirm.getByRole("button", { name: "Cancelar pacote" }).click();
    await expect(page.getByText("Pacote cancelado.")).toBeVisible();
    await expect(profileSection(page, "Cobranças")).toContainText("Nada em aberto");
    // Sem pacote ativo, a secao Pacotes sai da ficha.
    await expect(profileSection(page, "Pacotes")).toHaveCount(0);

    // Cancelado nao trava: vende outro pelo menu e a secao volta com os dois.
    await moreAction(page, "Vender pacote");
    const again = page.getByRole("dialog", { name: "Vender pacote" });
    await again.getByRole("combobox", { name: "Pacote" }).click();
    await page.getByRole("option", { name: /Pacote 10 aulas/ }).click();
    await again.getByRole("button", { name: "Adicionar" }).click();
    await expect(again).toHaveCount(0);
    const packages = await openProfileSection(page, "Pacotes");
    await expect(packages.getByText("2 pacotes", { exact: true })).toBeVisible();
    await expect(packages.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(profileSection(page, "Cobranças")).toContainText("1 em aberto · R$ 400,00");
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
    // Resumo: o nivel da primeira modalidade, quantas mais e o ultimo registro.
    await expect(profileSection(page, "Evolução")).toContainText("Faixa Branca · +1 · último registro 21/09");
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
    // O resumo da secao diz o mesmo.
    await expect(profileSection(page, "Evolução")).toContainText("Sem trilha de evolução");
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
    // O resumo da secao passa a mostrar a ultima.
    await expect(profileSection(page, "Mensagens")).toContainText("Última em 22/09/2026");
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

  test("Cadastro: dados, mensalidade e responsáveis; 'Editar' abre o formulário", async ({ page }) => {
    await seedProfile(page, (t) => {
      t.clients[0].guardians = [{ name: "Maria Ficha", relationship: "Mãe", phone: "11966660000" }];
    });
    await page.goto(`${PROFILE}?tab=data`);
    const panel = await openProfileSection(page, "Cadastro");
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
      t.charges = [charge("ch-kimono", { kind: "extra", description: "Kimono", competence: "2026-09" })];
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
    const messages = await openProfileSection(page, "Mensagens");
    const row = messages.getByRole("button", { name: /^Mensagem de / });
    await expect(row).toContainText("Lembrete de cobrança");
    await expect(row).toContainText("Aberto no WhatsApp");
    await messages.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Lida" }).click();
    await expect(messages.getByText("Nenhum resultado para os filtros aplicados.")).toBeVisible();
    await messages.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(row).toBeVisible();
  });
});
