import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  AREAS,
  CHECKLIST,
  CLASS_BILLING_LABEL,
  CUSTOM_BILLINGS,
  CUSTOM_PROGRESSIONS,
  OPEN_HOURS,
  WELCOME_SETUP,
  freshTenant,
  lessonPackage,
  modality,
  monthlyPlan,
  planlessStudent,
  professional,
  readTenant,
  readyTenant,
  skipWelcomeDialog,
  waitForStore,
  type BillingMode,
  type ExpectedTrack,
  type Tenant,
} from "./areas-helpers";

/**
 * Configuracao inicial e o que ela muda, area por area: passo a passo do
 * assistente, modalidades criadas com a trilha da area, avaliacoes ligadas so
 * em idiomas, musica e cursos livres, padroes da nova turma e do novo aluno,
 * primeiros passos pela forma de cobranca e quando a configuracao comemora.
 * Relogio do navegador: terca 22/09/2026.
 */

// Varias telas por teste (assistente, dashboard, turmas, alunos).
test.describe.configure({ timeout: 90_000 });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const startsWith = (text: string) => new RegExp(`^${escapeRe(text)}`);

/** "19:00" + minutos. */
function endTime(minutes: number): string {
  const total = 19 * 60 + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Pilula do passo 3 (texto "✓ Nome" ou "+ Nome"). */
// O "✓"/"+" do chip e aria-hidden: o nome acessivel e so o da aula.
const pill = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

type Category = Tenant;

function expectTrack(category: Category | undefined, track: ExpectedTrack) {
  expect(category, "modalidade criada no setup").toBeDefined();
  if (track === null) {
    expect(category?.progressionTrack).toBeUndefined();
    return;
  }
  expect(category?.progressionTrack).toMatchObject({ enabled: true, templateKey: track.templateKey, style: track.style });
}

function expectAssessments(category: Category | undefined, enabled: boolean) {
  if (enabled) expect(category?.assessments).toMatchObject({ enabled: true });
  else expect(category?.assessments).toBeUndefined();
}

/** Passo 1 completo: dica, previa ao vivo, unidade atras do link. */
async function fillStepOne(page: Page, name: string) {
  await expect(page.getByText("Dá aula sozinho? Pode usar o seu nome.")).toBeVisible();
  const preview = page.getByText("Assim aparece no topo:");
  await expect(preview).toContainText("Seu espaço");
  await expect(page.getByLabel("Unidade ou filial (opcional)")).toHaveCount(0);
  // Desktop (teclado fisico): o nome ja vem com foco.
  await expect(page.getByLabel("Nome")).toBeFocused();
  // Botao sempre ativo: sem nome, avisa e nao avanca.
  await page.getByRole("button", { name: "Continuar" }).click();
  // Erro pelo id do campo (o anuncio de rota do Next tambem e role=alert).
  await expect(page.locator("#business-name-error")).toHaveText("Informe o nome do espaço.");
  await page.getByLabel("Nome").fill(name);
  await expect(preview).toContainText(name);
  await page.getByRole("button", { name: "Tenho mais de um endereço" }).click();
  await expect(page.getByRole("button", { name: "Tenho mais de um endereço" })).toHaveCount(0);
  await expect(page.getByLabel("Unidade ou filial (opcional)")).toBeFocused();
  await page.getByLabel("Unidade ou filial (opcional)").fill("Centro");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "O que você ensina?" })).toBeVisible();
}

async function finishSetup(page: Page) {
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Estado do passo "Cadastrar modalidades" logo depois do setup: "review" (criadas
 * com trilha, falta revisar), "done" (criadas sem trilha, nada a revisar, o
 * passo ja conta como feito) ou "none" (nenhuma criada).
 */
type ModalitiesStep = "review" | "done" | "none";

/** Boas-vindas pela forma de cobranca e checklist com os passos da area. */
async function expectWelcomeAndChecklist(page: Page, billing: BillingMode, modalities: ModalitiesStep) {
  const welcome = page.getByRole("dialog", { name: /Bem-vindo/ });
  await expect(welcome).toContainText(WELCOME_SETUP[billing]);
  await welcome.getByRole("button", { name: /Ir para os primeiros passos/ }).click();
  await expect(welcome).toBeHidden();

  const checklist = page.locator("[data-tour=onboarding-checklist]");
  await expect(checklist.getByRole("heading", { name: "Primeiros passos", exact: true })).toBeVisible();
  const { steps, absent, phase1 } = CHECKLIST[billing];
  await expect(checklist).toContainText(`${modalities === "done" ? 1 : 0} de ${steps.length} concluídos`);
  await expect(checklist).toContainText(phase1);
  for (const label of steps) await expect(checklist.getByText(label, { exact: true })).toBeVisible();
  for (const label of absent) await expect(checklist.getByText(label, { exact: true })).toHaveCount(0);
  await expect(checklist.getByText("Falta revisar")).toHaveCount(modalities === "review" ? 1 : 0);
  await expect(checklist).toContainText(billing === "course" ? "Fase 3: Cursos e matrículas" : "Fase 3: Turmas e matrículas");
}

/** Padroes da nova turma (cobranca, vagas, duracao) e do novo aluno. */
async function expectFormDefaults(page: Page, billing: BillingMode, capacity: number, durationMinutes: number) {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
  const form = page.getByRole("dialog", { name: "Nova turma" });
  await expect(form.getByRole("radio", { name: startsWith(CLASS_BILLING_LABEL[billing]) })).toHaveAttribute("aria-checked", "true");
  for (const other of Object.values(CLASS_BILLING_LABEL).filter((l) => l !== CLASS_BILLING_LABEL[billing])) {
    await expect(form.getByRole("radio", { name: startsWith(other) })).toHaveAttribute("aria-checked", "false");
  }
  await expect(form.getByLabel("Capacidade (vagas)")).toHaveValue(String(capacity));
  // Sem horario de funcionamento: comeca as 19:00 com a duracao da area.
  await expect(form.getByLabel("Início do encontro")).toHaveValue("19:00");
  await expect(form.getByLabel("Fim do encontro")).toHaveValue(endTime(durationMinutes));
  await expect(form.getByLabel("Valor do curso")).toHaveCount(billing === "course" ? 1 : 0);
  // Turma gratuita nao oferece avulso.
  await expect(form.getByRole("switch", { name: "Permitir alunos avulsos nesta turma" })).toHaveCount(billing === "free" ? 0 : 1);
  await form.getByRole("button", { name: "Cancelar" }).click();
  await expect(form).toBeHidden();

  await page.goto("/clients");
  await page.getByRole("button", { name: "Novo aluno" }).first().click();
  const student = page.getByRole("dialog", { name: "Novo aluno" });
  const pays = student.getByRole("radio", { name: /^Paga mensalidade/ });
  const pkg = student.getByRole("radio", { name: /^Pacote de aulas/ });
  const none = student.getByRole("radio", { name: /^Não paga mensalidade/ });
  if (billing === "membership") {
    await expect(pays).toHaveAttribute("aria-checked", "true");
    await expect(none).toHaveAttribute("aria-checked", "false");
  } else if (billing === "package") {
    // Area de pacote: o cadastro ja vende o pacote.
    await expect(pkg).toHaveAttribute("aria-checked", "true");
    await expect(pays).toHaveAttribute("aria-checked", "false");
    await expect(student.getByRole("combobox", { name: /Pacote/ })).toBeVisible();
  } else {
    await expect(none).toHaveAttribute("aria-checked", "true");
    await expect(pays).toHaveAttribute("aria-checked", "false");
    await expect(student.getByText("Sem plano e sem mensalidade. Use para curso, aula avulsa ou experimental.")).toBeVisible();
  }
}

// ===========================================================================
// 1. Assistente por area da lista
// ===========================================================================
test.describe("configuração inicial por área", () => {
  for (const area of AREAS) {
    test(`${area.label}: passos, modalidades com a trilha da área e padrões depois`, async ({ page }) => {
      await freshTenant(page);
      const spaceName = `Espaço de ${area.label}`;
      await fillStepOne(page, spaceName);

      // Passo 2: 10 areas + "Outra área", nada marcado.
      const group = page.getByRole("radiogroup", { name: "Área do espaço" });
      await expect(group.getByRole("radio")).toHaveCount(11);
      await expect(group.getByRole("radio", { checked: true })).toHaveCount(0);
      // Area padrao: o clique ja avanca.
      await group.getByRole("radio", { name: startsWith(area.label) }).click();

      // Passo 3: a confirmacao da area e todas as aulas dela; as 2 primeiras ja marcadas.
      await expect(page.getByRole("heading", { name: "Quais aulas você oferece?" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText(area.confirmation);
      await expect(page.getByText(`Aulas de ${area.label}`)).toBeVisible();
      await expect(page.getByText("2 selecionadas")).toBeVisible();
      for (const [i, name] of area.modalities.entries()) {
        await expect(pill(page, name)).toHaveText(new RegExp(`^${i < 2 ? "✓" : "\\+"}\\s*${escapeRe(name)}$`));
      }
      // Marcar e desmarcar uma terceira; adicionar e remover uma aula propria.
      const third = area.modalities[2];
      await pill(page, third).click();
      await expect(page.getByText("3 selecionadas")).toBeVisible();
      await pill(page, third).click();
      await expect(page.getByText("2 selecionadas")).toBeVisible();
      await page.getByLabel("Não encontrou sua aula? Adicione abaixo:").fill("Aula Extra");
      await page.getByLabel("Não encontrou sua aula? Adicione abaixo:").press("Enter");
      await expect(page.getByText("3 selecionadas")).toBeVisible();
      await page.getByRole("button", { name: "Remover Aula Extra", exact: true }).click();
      await expect(pill(page, "Aula Extra")).toHaveCount(0);
      await expect(page.getByText("2 selecionadas")).toBeVisible();

      await finishSetup(page);
      await waitForStore(page, (t) => t.categories.length === 2);
      const tenant = await readTenant(page);
      // Area sem trilha (pilates, funcional) nao tem niveis a revisar (ONB-18).
      const needsReview = Object.values(area.tracks).some((track) => track !== null);
      expect(tenant.organization).toMatchObject({
        name: spaceName,
        segment: area.label,
        classSegment: area.id,
        model: "classes",
        settings: { onboardingCompleted: true },
      });
      expect(tenant.organization.settings.modalitiesReviewed).toBe(needsReview ? false : undefined);
      expect(tenant.organization.customSegmentName).toBeUndefined();
      expect(tenant.organization.customSegmentProgression).toBeUndefined();
      expect(tenant.organization.customSegmentBilling).toBeUndefined();
      expect(tenant.unit.name).toBe("Centro");
      const created: Category[] = tenant.categories;
      expect(created.map((c) => c.name).sort()).toEqual(Object.keys(area.tracks).sort());
      for (const [name, track] of Object.entries(area.tracks)) {
        const category = created.find((c) => c.name === name);
        expectTrack(category, track);
        expectAssessments(category, area.assessments);
      }

      await expectWelcomeAndChecklist(page, area.billing, needsReview ? "review" : "done");
      await expectFormDefaults(page, area.billing, area.capacity, area.durationMinutes);
    });
  }

  test("trocar de área no passo 2 troca as aulas sugeridas; Voltar mantém o nome", async ({ page }) => {
    await freshTenant(page);
    await page.getByLabel("Nome").fill("Casa das Artes");
    // Enter no nome avanca.
    await page.getByLabel("Nome").press("Enter");
    await page.getByRole("radio", { name: /^Lutas/ }).click();
    await expect(page.getByText("Aulas de Lutas")).toBeVisible();
    await pill(page, "Boxe").click();
    await expect(page.getByText("3 selecionadas")).toBeVisible();

    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByRole("radio", { name: /^Lutas/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: /^Música/ }).click();
    await expect(page.getByText("Aulas de Música")).toBeVisible();
    await expect(page.getByText("2 selecionadas")).toBeVisible();
    await expect(pill(page, "Boxe")).toHaveCount(0);
    await expect(pill(page, "Violão")).toHaveText(/^✓\s*Violão$/);

    await page.getByRole("button", { name: "Voltar" }).click();
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByLabel("Nome")).toHaveValue("Casa das Artes");
  });

  test("sem nenhuma aula marcada não cria modalidade e o passo pede para adicionar", async ({ page }) => {
    await freshTenant(page);
    await page.getByLabel("Nome").fill("Estúdio Vazio");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("radio", { name: /^Dança/ }).click();
    await pill(page, "Balé clássico").click();
    await pill(page, "Dança de Salão").click();
    await expect(page.getByText("0 selecionadas")).toBeVisible();
    await expect(page.getByText("Nenhuma aula marcada. Dá para cadastrar depois.")).toBeVisible();
    await finishSetup(page);
    await waitForStore(page, (t) => t.organization.settings?.onboardingCompleted === true);
    const tenant = await readTenant(page);
    expect(tenant.categories).toEqual([]);
    expect(tenant.organization.settings.modalitiesReviewed).toBeUndefined();
    // Sem unidade informada, o nome da unidade fica vazio.
    expect(tenant.unit.name).toBe("");
    await expectWelcomeAndChecklist(page, "membership", "none");
    await expect(page.getByText("Adicione as modalidades ou atividades oferecidas.")).toBeVisible();
  });
});

// ===========================================================================
// 2. "Outra área": nome, como os alunos avancam e como cobra
// ===========================================================================
test.describe("configuração inicial: Outra área", () => {
  test("nome obrigatório, sugestões e Enter para avançar", async ({ page }) => {
    await freshTenant(page);
    await page.getByLabel("Nome").fill("Clube");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("radio", { name: /^Outra área/ }).click();
    const name = page.getByLabel("O que você ensina?");
    const next = page.getByRole("button", { name: "Continuar" });
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(name).toBeFocused();
    // Botao sempre ativo: sem o nome da area, avisa e nao avanca.
    await next.click();
    await expect(page.locator("#custom-segment-error")).toHaveText("Informe o que você ensina.");
    // So espacos nao vale.
    await name.fill("   ");
    await name.press("Enter");
    await expect(page.locator("#custom-segment-error")).toHaveText("Informe o que você ensina.");
    await expect(page.getByRole("heading", { name: "O que você ensina?" })).toBeVisible();

    for (const suggestion of ["Teatro", "Xadrez", "Fotografia", "Autoescola"]) {
      await page.getByRole("button", { name: suggestion, exact: true }).click();
      await expect(name).toHaveValue(suggestion);
    }
    await expect(next).toBeEnabled();
    // Padroes: "Não avançam" e "Mensalidade", com as dicas.
    const progression = page.getByRole("radiogroup", { name: "Como seus alunos avançam?" });
    const billing = page.getByRole("radiogroup", { name: "Como você cobra?" });
    await expect(progression.getByRole("radio")).toHaveText(CUSTOM_PROGRESSIONS.map((p) => p.label));
    await expect(billing.getByRole("radio")).toHaveText(CUSTOM_BILLINGS.map((b) => b.label));
    await expect(progression.getByRole("radio", { name: "Não avançam" })).toHaveAttribute("aria-checked", "true");
    await expect(billing.getByRole("radio", { name: "Mensalidade" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Na dúvida, escolha “Não avançam”. Dá para mudar depois.")).toBeVisible();
    await expect(page.getByText("É só o padrão: cada turma pode cobrar diferente.")).toBeVisible();

    await name.fill("Robótica");
    await name.press("Enter");
    await expect(page.getByRole("heading", { name: "Quais aulas você oferece?" })).toBeVisible();
    await expect(page.getByText("Aulas de Robótica")).toBeVisible();
    // A propria area ja entra como a primeira aula, marcada.
    await expect(page.getByText("1 selecionada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Robótica", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  // Cada trilha com uma forma de cobrar: as 4 de cada lado ficam cobertas.
  for (const [i, progression] of CUSTOM_PROGRESSIONS.entries()) {
    const billing = CUSTOM_BILLINGS[i];
    test(`${progression.label} + ${billing.label}: grava, cria a trilha e ajusta padrões e primeiros passos`, async ({
      page,
    }) => {
      await freshTenant(page);
      await page.getByLabel("Nome").fill("Clube do Tabuleiro");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("radio", { name: /^Outra área/ }).click();
      await page.getByRole("button", { name: "Xadrez", exact: true }).click();
      const progressionRadio = page
        .getByRole("radiogroup", { name: "Como seus alunos avançam?" })
        .getByRole("radio", { name: progression.label, exact: true });
      await progressionRadio.click();
      await expect(progressionRadio).toHaveAttribute("aria-checked", "true");
      const billingRadio = page
        .getByRole("radiogroup", { name: "Como você cobra?" })
        .getByRole("radio", { name: billing.label, exact: true });
      await billingRadio.click();
      await expect(billingRadio).toHaveAttribute("aria-checked", "true");
      await page.getByRole("button", { name: "Continuar" }).click();

      await expect(page.getByText("Aulas de Xadrez")).toBeVisible();
      // A area entra como aula; o cenario troca por uma aula propria.
      await page.getByRole("button", { name: "Remover Xadrez", exact: true }).click();
      await page.getByLabel("Não encontrou sua aula? Adicione abaixo:").fill("Xadrez Iniciante");
      await page.getByRole("button", { name: "Adicionar" }).click();
      await expect(page.getByText("1 selecionada")).toBeVisible();
      await finishSetup(page);

      await waitForStore(page, (t) => t.categories.length === 1);
      const tenant = await readTenant(page);
      expect(tenant.organization).toMatchObject({
        name: "Clube do Tabuleiro",
        segment: "Xadrez",
        classSegment: "custom",
        customSegmentName: "Xadrez",
        customSegmentProgression: progression.value,
        customSegmentBilling: billing.value,
      });
      const category = tenant.categories[0];
      expect(category.name).toBe("Xadrez Iniciante");
      expectTrack(category, progression.track);
      expectAssessments(category, false);

      // "Nao avancam" cria a modalidade sem trilha: nada a revisar.
      await expectWelcomeAndChecklist(page, billing.value, progression.track ? "review" : "done");
      await expectFormDefaults(page, billing.value, 10, 60);
    });
  }
});

// ===========================================================================
// 3. Primeiros passos e comemoracao depois da configuracao inicial
// ===========================================================================

/** Tudo pronto menos a turma: horario, modalidade revisada, professor e aluno. */
function readyExceptClass(t: Tenant, modalityName: string) {
  t.unit.businessHours = OPEN_HOURS;
  t.categories = [modality("m-1", modalityName)];
  t.professionals = [professional(["m-1"])];
  t.clients = [planlessStudent("c-1", "Aluna Primeira")];
}

/** Cria uma turma pela tela de Turmas com a forma de cobranca pedida. */
async function createClass(page: Page, name: string, modalityName: string, billing?: BillingMode): Promise<Locator> {
  await page.goto("/classes");
  await page.getByRole("button", { name: "Nova turma" }).first().click();
  const form = page.getByRole("dialog", { name: "Nova turma" });
  await form.getByLabel("Nome da turma").fill(name);
  await form.getByRole("combobox", { name: /Modalidade/ }).click();
  await page.getByRole("option", { name: modalityName }).click();
  await expect(form.getByRole("combobox", { name: /Professor/ })).toContainText("Carlos Silva");
  if (billing) await form.getByRole("radio", { name: startsWith(CLASS_BILLING_LABEL[billing]) }).click();
  const isCourse = await form.getByRole("radio", { name: /^Curso com valor fechado/ }).getAttribute("aria-checked");
  if (isCourse === "true") {
    await form.getByLabel("Valor do curso").fill("80000");
    await form.getByLabel("Termina em").fill("2026-11-30");
  }
  await form.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(form).toBeHidden();
  return form;
}

const party = (page: Page) => page.getByRole("alertdialog", { name: "Seu espaço está pronto!" });

test.describe("comemoração da configuração inicial", () => {
  const membershipAreas = AREAS.filter((a) => a.billing === "membership");
  for (const area of membershipAreas) {
    test(`${area.label}: a 1ª turma (mensalidade) fecha a configuração e comemora`, async ({ page }) => {
      const modalityName = Object.keys(area.tracks)[0];
      await readyTenant(page, {
        segment: area.id,
        extra: (t) => {
          readyExceptClass(t, modalityName);
          t.organization.settings = { ...t.organization.settings, billingTiming: "prepaid", midMonthStrategy: "prorated", defaultDueDay: 10 };
          t.plans = [monthlyPlan()];
        },
      });
      await skipWelcomeDialog(page);
      await createClass(page, "Turma Inaugural", modalityName);
      await expect(party(page)).toContainText("Agora matricule os alunos da turma “Turma Inaugural”.");
      await party(page).getByRole("button", { name: "Matricular alunos agora" }).click();
      await expect(page).toHaveURL(/\/classes\/[^/?]+\?enroll=true$/);
      await expect(page.getByRole("dialog", { name: "Matricular alunos" })).toBeVisible();
    });
  }

  const courseAreas: { label: string; segment: string; modalityName: string; customBilling?: BillingMode }[] = [
    ...AREAS.filter((a) => a.billing === "course").map((a) => ({
      label: a.label,
      segment: a.id,
      modalityName: Object.keys(a.tracks)[0],
    })),
    { label: "Outra área (curso)", segment: "custom", modalityName: "Xadrez Iniciante", customBilling: "course" },
  ];
  for (const area of courseAreas) {
    test(`${area.label}: criar o curso só avisa; a 1ª matrícula comemora`, async ({ page }) => {
      await readyTenant(page, {
        segment: area.segment,
        customBilling: area.customBilling,
        extra: (t) => readyExceptClass(t, area.modalityName),
      });
      await skipWelcomeDialog(page);
      await page.goto("/dashboard");
      const checklist = page.locator("[data-tour=onboarding-checklist]");
      await expect(checklist).toContainText("4 de 6 concluídos");
      await expect(checklist.getByText("Criar o primeiro curso", { exact: true })).toBeVisible();

      await createClass(page, "Curso de Outubro", area.modalityName);
      await expect(page.getByText('Turma "Curso de Outubro" criada com sucesso.')).toBeVisible();
      await expect(party(page)).toHaveCount(0);
      await page.getByRole("button", { name: "Matricular alunos" }).click();
      await expect(page).toHaveURL(/\/classes\/[^/?]+\?enroll=true$/);
      const enroll = page.getByRole("dialog", { name: "Matricular alunos" });
      await enroll.getByRole("option", { name: /Aluna Primeira/ }).click();
      // O 1º vencimento fica atras de "Alterar" (fechado vale o padrao da turma).
      await enroll.getByRole("button", { name: "Alterar", exact: true }).click();
      await enroll.locator("input[name=firstDueDate]").fill("2026-10-15");
      await enroll.getByRole("button", { name: "Matricular 1 aluno" }).click();
      await expect(page.getByText("Aluno matriculado.")).toBeVisible();
      await expect(party(page)).toContainText("Os alunos já estão no curso “Curso de Outubro”. Veja as parcelas geradas.");
      await party(page).getByRole("button", { name: "Ver as cobranças" }).click();
      await expect(page).toHaveURL(/\/classes\/billing/);
    });
  }

  test("Outra área (pacote): com um pacote no catálogo, a 1ª turma de pacote comemora", async ({ page }) => {
    await readyTenant(page, {
      segment: "custom",
      customBilling: "package",
      extra: (t) => {
        readyExceptClass(t, "Xadrez Iniciante");
        t.lessonPackages = [lessonPackage("lp-1", "10 aulas")];
      },
    });
    await skipWelcomeDialog(page);
    await page.goto("/dashboard");
    const checklist = page.locator("[data-tour=onboarding-checklist]");
    await expect(checklist).toContainText("5 de 6 concluídos");
    await createClass(page, "Xadrez Sábado", "Xadrez Iniciante");
    await expect(party(page)).toContainText("Agora matricule os alunos da turma “Xadrez Sábado”.");
    await waitForStore(page, (t) => t.classGroups.length === 1);
    expect((await readTenant(page)).classGroups[0].billingMode).toBe("package");
  });

  test("Outra área (pacote): sem pacote, a turma não comemora e o passo do pacote segue", async ({ page }) => {
    await readyTenant(page, {
      segment: "custom",
      customBilling: "package",
      extra: (t) => readyExceptClass(t, "Xadrez Iniciante"),
    });
    await skipWelcomeDialog(page);
    await createClass(page, "Xadrez Sábado", "Xadrez Iniciante");
    await expect(page.getByText('Turma "Xadrez Sábado" criada com sucesso.')).toBeVisible();
    await expect(party(page)).toHaveCount(0);
    await waitForStore(page, (t) => t.classGroups.length === 1);
    await page.goto("/dashboard");
    const checklist = page.locator("[data-tour=onboarding-checklist]");
    await expect(checklist).toContainText("5 de 6 concluídos");
    await expect(checklist).toContainText("Criar um pacote de aulas");
  });

  test("Outra área (não cobro): a 1ª turma sem cobrança comemora", async ({ page }) => {
    await readyTenant(page, {
      segment: "custom",
      customBilling: "free",
      extra: (t) => readyExceptClass(t, "Xadrez Iniciante"),
    });
    await skipWelcomeDialog(page);
    await page.goto("/dashboard");
    await expect(page.locator("[data-tour=onboarding-checklist]")).toContainText("4 de 5 concluídos");
    await createClass(page, "Xadrez Livre", "Xadrez Iniciante");
    await expect(party(page)).toContainText("Agora matricule os alunos da turma “Xadrez Livre”.");
    await waitForStore(page, (t) => t.classGroups.length === 1);
    expect((await readTenant(page)).classGroups[0].billingMode).toBe("free");
  });

  test("Outra área (mensalidade): sem regras e planos não comemora", async ({ page }) => {
    await readyTenant(page, {
      segment: "custom",
      customBilling: "membership",
      extra: (t) => readyExceptClass(t, "Xadrez Iniciante"),
    });
    await skipWelcomeDialog(page);
    await createClass(page, "Xadrez Noite", "Xadrez Iniciante");
    await expect(page.getByText('Turma "Xadrez Noite" criada com sucesso.')).toBeVisible();
    await expect(party(page)).toHaveCount(0);
  });
});

test.describe("turma de mensalidade numa área sem mensalidade", () => {
  const cases: { label: string; segment: string; customBilling?: BillingMode; before: string; extra?: (t: Tenant) => void }[] = [
    { label: "Gastronomia (curso)", segment: "gastronomy", before: "4 de 6 concluídos" },
    {
      label: "Outra área (pacote)",
      segment: "custom",
      customBilling: "package",
      before: "5 de 6 concluídos",
      extra: (t) => (t.lessonPackages = [lessonPackage("lp-1", "10 aulas")]),
    },
    { label: "Outra área (não cobro)", segment: "custom", customBilling: "free", before: "4 de 5 concluídos" },
  ];
  for (const c of cases) {
    test(`${c.label}: traz de volta regras da mensalidade e planos, sem comemorar`, async ({ page }) => {
      const modalityName = c.segment === "custom" ? "Xadrez Iniciante" : "Confeitaria";
      await readyTenant(page, {
        segment: c.segment,
        customBilling: c.customBilling,
        extra: (t) => {
          readyExceptClass(t, modalityName);
          c.extra?.(t);
        },
      });
      await skipWelcomeDialog(page);
      await page.goto("/dashboard");
      const checklist = page.locator("[data-tour=onboarding-checklist]");
      await expect(checklist).toContainText(c.before);
      await expect(checklist.getByText("Definir regras da mensalidade", { exact: true })).toHaveCount(0);
      await expect(checklist.getByText("Criar planos de mensalidade", { exact: true })).toHaveCount(0);

      await createClass(page, "Turma Mensal", modalityName, "membership");
      // A turma de mensalidade abre dois passos novos: nao e o fim da configuracao.
      await expect(page.getByText('Turma "Turma Mensal" criada com sucesso.')).toBeVisible();
      await expect(party(page)).toHaveCount(0);
      await waitForStore(page, (t) => t.classGroups.length === 1);

      await page.goto("/dashboard");
      await expect(checklist.getByText("Definir regras da mensalidade", { exact: true })).toBeVisible();
      await expect(checklist.getByText("Criar planos de mensalidade", { exact: true })).toBeVisible();
      await expect(checklist).toContainText("regras da mensalidade");
    });
  }
});
