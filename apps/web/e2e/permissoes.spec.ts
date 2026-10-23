import type { Page } from "@playwright/test";
import {
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  profileAlert,
  profileSection,
  seedAcademy,
  student,
  test,
} from "./fixtures";
import {
  ADULT,
  MODULES_TRACK,
  TS,
  assessment,
  grade,
  gradedSettings,
  loginAsUser,
  modality,
  rowOf,
  skipClientsCoachmark,
  user,
  type Tenant,
} from "./ficha-notas-fixtures";

/**
 * Quem pode o que nas notas, na ficha do aluno e no certificado:
 * - professor (Carlos Silva) ve e lanca notas so nas turmas em que e o
 *   titular (escopo do professor, 18/10/2026: a turma dos outros nem abre);
 * - atendente ve, nao lanca nem cobra;
 * - gerente e dono fazem tudo;
 * - certificado e cobrar online so no Plano Profissional.
 * Hoje e terca 22/09/2026.
 */

const PROF = user("usr-prof", "Carlos Silva", "professional", { professionalId: "pr-1" });
const PROF_LINK = { id: "pr-1", name: "Carlos Silva" };
const ATTENDANT = user("usr-att", "Bia Recepção", "attendant");
const MANAGER = user("usr-mgr", "Gil Gerente", "manager");

/**
 * Escola de idiomas com duas turmas de Ingles (avaliacoes ligadas): a do
 * Carlos (cg-own) e a da Paula (cg-other), uma avaliacao em cada, e um curso
 * concluido do Aluno Alfa para o certificado.
 */
async function seedSchool(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.classSegment = "languages";
      t.categories = [
        modality("m-ing", "Inglês", 0, { progressionTrack: MODULES_TRACK, assessments: gradedSettings() }),
      ];
      t.professionals = [
        { ...t.professionals[0], modalityIds: ["m-ing"] },
        {
          id: "pr-2",
          organizationId: "org-academia-x",
          unitId: "unit-academia-x",
          name: "Paula Souza",
          modalityIds: ["m-ing"],
          serviceIds: [],
          workingHours: [],
          status: "active",
          createdAt: TS,
          updatedAt: TS,
        },
      ];
      t.users = [...t.users, PROF, ATTENDANT, MANAGER];
      t.clients = [student("c-a", "Aluno Alfa", { birthDate: ADULT }), student("c-b", "Aluno Beta", { birthDate: ADULT })];
      t.classGroups = [
        classGroup("cg-own", "Inglês Carlos", { modalityId: "m-ing" }),
        classGroup("cg-other", "Inglês Paula", { modalityId: "m-ing", instructorId: "pr-2" }),
        classGroup("cg-course", "Inglês Intensivo", {
          modalityId: "m-ing",
          billingMode: "course",
          coursePriceCents: 30000,
          courseMaxInstallments: 1,
          startDate: "2026-08-03",
          endDate: "2026-09-10",
          allowDropin: false,
          sessionPriceCents: undefined,
        }),
      ];
      t.enrollments = [
        enrollment("e-1", "cg-own", "c-a"),
        enrollment("e-2", "cg-other", "c-b"),
        { ...enrollment("e-course", "cg-course", "c-a"), course: { priceCents: 30000, installments: 1 } },
      ];
      t.assessments = [
        assessment("as-own", "cg-own", "m-ing", "Prova Carlos", { grades: [grade("c-a", 8)] }),
        assessment("as-other", "cg-other", "m-ing", "Prova Paula", { grades: [grade("c-b", 4)] }),
      ];
      extra?.(t);
    },
  });
}

const assessmentsTab = (page: Page) => page.getByRole("tab", { name: /^Avaliações/ });

async function openAssessments(page: Page, classId: string) {
  await page.goto(`/classes/${classId}`);
  await assessmentsTab(page).click();
  await expect(assessmentsTab(page)).toHaveAttribute("aria-selected", "true");
}

test.describe("professor", () => {
  test("lança notas só na própria turma; a dos outros não abre", { tag: "@smoke" }, async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, PROF, PROF_LINK);

    await openAssessments(page, "cg-own");
    await expect(page.getByRole("button", { name: "Nova avaliação" })).toBeVisible();
    await page.getByRole("button", { name: "Ações de Prova Carlos", exact: true }).click();
    await page.getByRole("menuitem", { name: "Lançar notas" }).click();
    const sheet = page.getByRole("dialog", { name: "Lançar notas" });
    await sheet.getByLabel("Aluno Alfa").fill("9,5");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(rowOf(page, "Prova Carlos")).toContainText("9,5");

    // Nova avaliacao na propria turma.
    await page.getByRole("button", { name: "Nova avaliação" }).click();
    const form = page.getByRole("dialog", { name: "Nova avaliação" });
    await form.getByLabel("Nome").fill("Prova 2");
    await form.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Avaliação criada.")).toBeVisible();

    // Turma da Paula: fora do escopo do professor, nem aparece.
    await page.goto("/classes/cg-other");
    await expect(page.getByText("Turma não encontrada", { exact: true })).toBeVisible();
    await expect(assessmentsTab(page)).toHaveCount(0);
    await expect(page.getByText("Prova Paula")).toHaveCount(0);
  });

  test("vê o boletim dos alunos pela turma e pela chamada", async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, PROF, PROF_LINK);
    // So na turma dele (a da Paula nao abre para o professor).
    await page.goto("/classes/cg-own");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Cancelar matrícula" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Notas" }).click();
    const dialog = page.getByRole("dialog", { name: "Notas" });
    await expect(dialog).toContainText("Prova Carlos");
    await expect(dialog).toContainText("8");
    await page.keyboard.press("Escape");

    await page.goto(`/classes/sessions/${encodeURIComponent("cg-own~2026-09-21~17:00")}`);
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    await expect(page.getByRole("dialog", { name: "Notas" })).toContainText("Prova Carlos");
  });

  test("sem acesso a Alunos: a turma e a chamada não abrem a ficha do aluno", async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, PROF, PROF_LINK);
    await page.goto("/classes/cg-own");
    await expect(page.getByText("Aluno Alfa", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aluno Alfa" })).toHaveCount(0);
    // A linha da turma so e clicavel (abre a ficha) com acesso a Alunos.
    await expect(page.getByRole("button", { name: /^Aluno Alfa/ })).toHaveCount(0);
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-own~2026-09-21~17:00")}`);
    await expect(page.getByText("Aluno Alfa", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Aluno Alfa" })).toHaveCount(0);
    // Na chamada, o menu do aluno fica sem "Abrir ficha".
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Abrir ficha" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    // Abrir a ficha pelo endereco volta para a primeira tela do perfil.
    await page.goto("/clients/c-a");
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/clients/c-a");
  });
});

test.describe("atendente", () => {
  test("vê avaliações e boletim, sem criar nem lançar", async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, ATTENDANT);
    await openAssessments(page, "cg-own");
    await expect(rowOf(page, "Prova Carlos")).toContainText("1 de 1 lançadas");
    await expect(page.getByRole("button", { name: "Nova avaliação" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ações de Prova Carlos", exact: true })).toHaveCount(0);
    await rowOf(page, "Prova Carlos").click();
    await expect(page.getByRole("dialog", { name: "Lançar notas" })).toHaveCount(0);

    await skipClientsCoachmark(page);
    await page.goto("/clients");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notas" }).click();
    await expect(page.getByRole("dialog", { name: "Notas" })).toContainText("Prova Carlos");
  });

  test("ficha: vê cobranças sem ações, edita o cadastro, não cobra nem vende", { tag: "@smoke" }, async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, ATTENDANT);
    await page.goto("/clients/c-a");
    await expect(page.getByRole("heading", { level: 1, name: "Aluno Alfa" })).toBeVisible();
    // Ve o que esta em aberto (resumo de Cobranças e aviso de atraso), sem "Marcar pago".
    await expect(profileSection(page, "Cobranças")).toContainText("1 em aberto · R$ 55,00 · 1 atrasada");
    await expect(profileAlert(page, "Mensalidade de setembro atrasada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar pago" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mais ações do aluno", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Editar cadastro" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Inativar" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const charges = await openProfileSection(page, "Cobranças");
    await expect(rowOf(page, "Mensalidade")).toContainText("Atrasado");
    await expect(charges.getByRole("button", { name: "Ações de Aluno Alfa", exact: true })).toHaveCount(0);

    // Sem pacote ativo, sem a secao Pacotes (e nada de vender).
    await expect(profileSection(page, "Pacotes")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Vender pacote" })).toHaveCount(0);

    // Ve o boletim; registros de aula e graduacao pedem progression:manage (a atendente nao tem).
    await openProfileSection(page, "Evolução");
    await expect(page.getByRole("button", { name: "Notas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registros de aula" })).toHaveCount(0);
  });
});

test.describe("gerente", () => {
  test("lança notas em qualquer turma e cobra pela ficha", async ({ page }) => {
    await seedSchool(page);
    await loginAsUser(page, MANAGER);
    await openAssessments(page, "cg-other");
    await expect(page.getByRole("button", { name: "Nova avaliação" })).toBeVisible();
    await page.getByRole("button", { name: /^Prova Paula/ }).first().click();
    const sheet = page.getByRole("dialog", { name: "Lançar notas" });
    await sheet.getByLabel("Aluno Beta").fill("6");
    await sheet.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await expect(rowOf(page, "Prova Paula")).toContainText("6");

    await page.goto("/clients/c-b");
    await page.getByRole("button", { name: "Mais ações do aluno", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Nova cobrança" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Vender pacote" })).toBeVisible();
  });
});

test.describe("Plano Profissional", () => {
  test("grátis: certificado com cadeado na ficha e cobrar online bloqueado", async ({ page }) => {
    await seedSchool(page);
    await page.goto("/clients/c-a");
    // O curso concluido fica nas encerradas da secao Turmas.
    await openProfileSection(page, "Turmas");
    await page.getByRole("button", { name: "Mostrar encerradas (1)" }).click();
    await page.getByRole("button", { name: "Ações da matrícula em Inglês Intensivo", exact: true }).click();
    await page.getByRole("menuitem", { name: "Certificado (Plano Profissional)" }).click();
    await expect(page.getByText("Faz parte do Plano Profissional. Imprima ou salve em PDF no fim do curso.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toHaveCount(0);

    await page.goto("/clients/c-a?tab=charges");
    await page.getByRole("button", { name: "Ações de Aluno Alfa", exact: true }).click();
    // Pagamento online vale no Gratis; sem ligar nas Configuracoes, fica travado.
    await expect(page.getByRole("menuitem", { name: "Cobrar online (desligado nas Configurações)" })).toBeDisabled();
  });

  test("Pro: o certificado abre com o PDF, também para a atendente", { tag: "@smoke" }, async ({ page }) => {
    await seedSchool(page, (t) => {
      t.organization.subscription = { tier: "pro" };
    });
    await page.goto("/clients/c-a");
    await openProfileSection(page, "Turmas");
    await page.getByRole("button", { name: "Mostrar encerradas (1)" }).click();
    await page.getByRole("button", { name: "Ações da matrícula em Inglês Intensivo", exact: true }).click();
    await page.getByRole("menuitem", { name: "Certificado", exact: true }).click();
    await expect(page).toHaveURL("/classes/cg-course/certificate/e-course");
    await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Aluno Alfa");

    await loginAsUser(page, ATTENDANT);
    await page.goto("/classes/cg-course/certificate/e-course");
    await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();
  });
});
