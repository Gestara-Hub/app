import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";
import { gradedSettings, loginAsUser, modality, user } from "./ficha-notas-fixtures";
import { TS, pick, waitWorld, type Tenant } from "./geral-fixtures";

/**
 * Auditoria (docs/product/06): eventos das acoes principais de cada modulo,
 * filtro por tipo e busca, detalhe imutavel e a visao restrita do gerente.
 * Hoje e terca 22/09/2026.
 */

const ORG = "org-academia-x";
const MANAGER = user("usr-mgr", "Gil Gerente", "manager");
const ATTENDANT = user("usr-att", "Bia Recepção", "attendant");

const auditRow = (page: Page, summary: string | RegExp) =>
  page.getByRole("button", { name: typeof summary === "string" ? `Detalhes: ${summary}` : summary });

async function filterType(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const hasLog = (needle: string) => (t: Tenant) =>
  (t.auditLog ?? []).some((e: { summary: string }) => e.summary.includes(needle));

/** Evento gravado direto no mundo (para a visibilidade do gerente). */
function entry(id: string, over: Record<string, unknown>) {
  return {
    id,
    organizationId: ORG,
    unitId: "unit-academia-x",
    timestamp: "2026-09-21T15:00:00.000Z",
    actor: { userId: "usr-ac-ana", name: "Ana Ribeiro", profile: "owner" },
    action: "updated",
    target: { type: "client", id: "c-a", label: "Aluno A20" },
    summary: "Ana Ribeiro atualizou o aluno Aluno A20",
    security: false,
    ...over,
  };
}

async function seedAudit(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.users = [...t.users, MANAGER, ATTENDANT];
      t.categories.push(
        modality("m-yoga", "Yoga", 1),
        modality("m-ing", "Inglês", 2, { assessments: gradedSettings() }),
      );
      t.professionals[0].modalityIds = ["m-jj", "m-ing"];
      t.clients = [
        student("c-a", "Aluno A20"),
        student("c-s", "Aluno Saindo", { planId: undefined }),
        student("c-p", "Aluna Pacote", { planId: undefined }),
      ];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto"), classGroup("cg-ing", "Inglês Noite", { modalityId: "m-ing" })];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-ing", "c-a")];
      t.lessonPackages = [
        { id: "lp-10", organizationId: ORG, name: "10 aulas", lessons: 10, priceCents: 50000, modalityIds: [], absenceConsumes: true, status: "active", createdAt: TS, updatedAt: TS },
      ];
      extra?.(t);
    },
  });
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
}

test.describe("eventos das ações principais", () => {
  test("cadastros: plano com valor antes e depois, modalidade e aluno inativados", async ({ page }) => {
    test.slow();
    await seedAudit(page);

    await page.goto("/classes/plans");
    await page.getByRole("button", { name: "Ações de Mensal Jiu-Jitsu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const planForm = page.getByRole("dialog");
    await planForm.getByLabel("Valor").fill("18000");
    await planForm.getByRole("button", { name: "Salvar" }).click();
    // Mudar o valor de plano com aluno pede confirmacao.
    await page.getByRole("alertdialog", { name: "Mudar o valor do plano?" }).getByRole("button", { name: "Mudar o valor" }).click();
    await expect(page.getByText("Plano atualizado.")).toBeVisible();

    await page.goto("/classes/modalities");
    await page.getByRole("button", { name: "Ações de Yoga", exact: true }).click();
    await page.getByRole("menuitem", { name: "Inativar" }).click();
    await page.getByRole("alertdialog", { name: "Inativar modalidade?" }).getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Modalidade inativada.")).toBeVisible();

    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Saindo", exact: true }).last().click();
    await page.getByRole("menuitem", { name: "Inativar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Aluno inativado.")).toBeVisible();
    await waitWorld(page, ORG, hasLog("inativou o aluno Aluno Saindo"));

    await page.goto("/audit");
    await expect(auditRow(page, "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu")).toContainText("Valor:");
    await expect(auditRow(page, "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu")).toContainText("R$ 150,00");
    await expect(auditRow(page, "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu")).toContainText("R$ 180,00");
    await expect(auditRow(page, "Ana Ribeiro inativou a modalidade Yoga")).toContainText("Inativou");
    await expect(auditRow(page, "Ana Ribeiro inativou a modalidade Yoga")).toContainText("Modalidade");
    await expect(auditRow(page, "Ana Ribeiro inativou o aluno Aluno Saindo")).toContainText("Aluno");
    // Autor e perfil na linha.
    await expect(auditRow(page, "Ana Ribeiro inativou o aluno Aluno Saindo")).toContainText("Ana Ribeiro · Proprietário");
  });

  test("dinheiro: pagamento de mensalidade e venda de pacote", { tag: "@smoke" }, async ({ page }) => {
    test.slow();
    await seedAudit(page);

    await page.goto("/classes/billing?status=all");
    await page.getByRole("button", { name: "Ações de Aluno A20", exact: true }).click();
    await page.getByRole("menuitem", { name: "Marcar pago" }).click();
    const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
    await pay.getByRole("radio", { name: "Dinheiro" }).click();
    await pay.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado (Dinheiro).")).toBeVisible();

    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluna Pacote", exact: true }).last().click();
    await page.getByRole("menuitem", { name: "Vender pacote" }).click();
    const sell = page.getByRole("dialog", { name: "Vender pacote" });
    await pick(page, sell, "Pacote", "10 aulas");
    await sell.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Pacote vendido.")).toBeVisible();
    await waitWorld(page, ORG, hasLog("vendeu o pacote 10 aulas"));

    await page.goto("/audit");
    await expect(auditRow(page, /^Detalhes: Ana Ribeiro registrou o pagamento da mensalidade de Aluno A20 \(R\$ 55,00, vence 20\/09\/2026\)$/)).toContainText("Mudou status");
    await expect(auditRow(page, "Ana Ribeiro vendeu o pacote 10 aulas para Aluna Pacote (R$ 500,00)")).toContainText("Pacote de aulas");

    await filterType(page, "Pacote de aulas");
    await expect(page.getByText("1 evento registrado")).toBeVisible();
  });

  test("avaliação criada e modelo de certificado salvo (Pro)", async ({ page }) => {
    test.slow();
    await seedAudit(page, (t) => {
      t.organization.subscription = { tier: "pro" };
    });

    await page.goto("/classes/cg-ing");
    await page.getByRole("tab", { name: /^Avaliações/ }).click();
    await page.getByRole("button", { name: "Nova avaliação" }).first().click();
    const form = page.getByRole("dialog", { name: "Nova avaliação" });
    await form.getByLabel("Nome").fill("Prova oral");
    await form.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Avaliação criada.")).toBeVisible();

    await page.goto("/settings?tab=certificado");
    await page.getByLabel("Título").fill("Certificado de Formatura");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
    await waitWorld(page, ORG, hasLog("atualizou o modelo de certificado"));

    await page.goto("/audit");
    await expect(auditRow(page, "Ana Ribeiro criou a avaliação Prova oral da turma Inglês Noite")).toContainText("Avaliação");
    await expect(auditRow(page, "Ana Ribeiro atualizou o modelo de certificado")).toBeVisible();
  });

});

test.describe("tela de auditoria", () => {
  const LOG = [
    entry("a-1", {}),
    entry("a-2", {
      timestamp: "2026-09-21T16:00:00.000Z",
      target: { type: "plan", id: "p-m", label: "Mensal Jiu-Jitsu" },
      summary: "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu",
      changes: [{ field: "priceCents", label: "Valor", before: "R$ 150,00", after: "R$ 180,00" }],
    }),
    entry("a-3", {
      timestamp: "2026-09-21T17:00:00.000Z",
      action: "created",
      target: { type: "user", id: "usr-att", label: "Bia Recepção", profile: "attendant" },
      summary: "Ana Ribeiro criou o usuário Bia Recepção (Atendente)",
      security: true,
    }),
    entry("a-4", {
      timestamp: "2026-09-21T18:00:00.000Z",
      action: "updated",
      target: { type: "user", id: "usr-mgr", label: "Gil Gerente", profile: "manager" },
      summary: "Ana Ribeiro atualizou o usuário Gil Gerente",
      security: true,
    }),
    entry("a-5", {
      timestamp: "2026-09-21T19:00:00.000Z",
      target: { type: "settings", label: "Horário de funcionamento" },
      summary: "Ana Ribeiro atualizou o horário de funcionamento",
      security: true,
    }),
  ];

  test("filtro por tipo, busca e limpar filtros", async ({ page }) => {
    await seedAudit(page, (t) => (t.auditLog = LOG));
    await page.goto("/audit");
    await expect(page.getByText("5 eventos registrados")).toBeVisible();
    // Mais recente primeiro.
    await expect(page.getByRole("button", { name: /^Detalhes:/ }).first()).toHaveAccessibleName(
      "Detalhes: Ana Ribeiro atualizou o horário de funcionamento",
    );

    await filterType(page, "Plano");
    await expect(page.getByText("1 evento registrado")).toBeVisible();
    await expect(auditRow(page, "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu")).toBeVisible();
    await filterType(page, "Usuário");
    await expect(page.getByText("2 eventos registrados")).toBeVisible();
    await expect(auditRow(page, "Ana Ribeiro criou o usuário Bia Recepção (Atendente)")).toContainText("Sensível");

    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await expect(page.getByText("5 eventos registrados")).toBeVisible();
    await page.getByLabel("Buscar no log de auditoria").fill("gil gerente");
    await expect(page.getByText("1 evento registrado")).toBeVisible();
    await page.getByLabel("Buscar no log de auditoria").fill("nada disso");
    await expect(page.getByRole("button", { name: /^Detalhes:/ })).toHaveCount(0);
  });

  test("detalhe mostra alvo e alterações, sem editar", async ({ page }) => {
    await seedAudit(page, (t) => (t.auditLog = LOG));
    await page.goto("/audit");
    await auditRow(page, "Ana Ribeiro atualizou o plano Mensal Jiu-Jitsu").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Atualizou · Plano");
    await expect(dialog).toContainText("Alvo");
    await expect(dialog).toContainText("Mensal Jiu-Jitsu");
    await expect(dialog).toContainText("Alterações");
    await expect(dialog).toContainText("R$ 150,00");
    await expect(dialog).toContainText("R$ 180,00");
    await expect(dialog).toContainText("Registro imutável: não pode ser editado nem removido.");
    await dialog.getByRole("button", { name: "Detalhes técnicos" }).click();
    await expect(dialog).toContainText("ID do registro");
    // Registro imutavel: nada de campos editaveis.
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Editar|Excluir|Salvar/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Fechar" }).last().click();
    await expect(dialog).toBeHidden();
  });

  test("gerente vê só eventos operacionais e de atendente/profissional", async ({ page }) => {
    await seedAudit(page, (t) => (t.auditLog = LOG));
    await loginAsUser(page, MANAGER);
    await page.goto("/audit");
    await expect(page.getByText("3 eventos registrados")).toBeVisible();
    await expect(auditRow(page, "Ana Ribeiro atualizou o aluno Aluno A20")).toBeVisible();
    await expect(auditRow(page, "Ana Ribeiro criou o usuário Bia Recepção (Atendente)")).toBeVisible();
    await expect(auditRow(page, "Ana Ribeiro atualizou o usuário Gil Gerente")).toHaveCount(0);
    await expect(auditRow(page, "Ana Ribeiro atualizou o horário de funcionamento")).toHaveCount(0);
  });

  test("gerente que age aparece como autor com o perfil", async ({ page }) => {
    await seedAudit(page);
    await loginAsUser(page, MANAGER);
    await page.goto("/classes/plans");
    await page.getByRole("button", { name: "Ações de Mensal Jiu-Jitsu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill("Mensal JJ");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Plano atualizado.")).toBeVisible();
    await waitWorld(page, ORG, hasLog("Gil Gerente atualizou o plano Mensal JJ"));
    await page.goto("/audit");
    await expect(auditRow(page, "Gil Gerente atualizou o plano Mensal JJ")).toContainText("Gil Gerente · Gerente");
  });

  test("sem eventos mostra o guia vazio", async ({ page }) => {
    await seedAudit(page, (t) => (t.auditLog = []));
    await page.goto("/audit");
    await expect(page.getByText("Nenhum evento registrado.")).toBeVisible();
  });

  test("atendente não abre a auditoria", async ({ page }) => {
    await seedAudit(page);
    await loginAsUser(page, ATTENDANT);
    await page.goto("/audit");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/classes/calendar");
  });
});

