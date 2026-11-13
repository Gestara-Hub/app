import type { Page } from "@playwright/test";
import {
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  pageAction,
  readAcademy,
  rowMenuAction,
  seedAcademy,
  student,
  test,
} from "./fixtures";
import { LEVELS_TRACK, assessment, grade, gradedSettings, jjWhite, modality, progression } from "./ficha-notas-fixtures";
import { pick } from "./geral-fixtures";

/**
 * Graduacao em grupo e troca de turma (doc product/30, 13/11/2026): "Apto"
 * com notas, "Mudar de turma", "Graduar vários" na turma e o evento de
 * graduacao. Relogio fixo em terca 22/09/2026.
 */

const TS = "2026-09-01T12:00:00.000Z";
const ORG = "org-academia-x";
const UNIT = "unit-academia-x";
/** Nascido em 10/05/1990: 36 anos hoje (adulto, pula as faixas infantis). */
const ADULT = "1990-05-10";

/** Faixa Branca desde 01/03 (mais de 6 meses) com 30 aulas: apto pela trilha de Jiu-Jitsu. */
const aptoWhite = () => jjWhite({ initialAttendanceOffset: 30 });
/** Faixa Branca com 5 aulas: faltam 25. */
const earlyWhite = () => jjWhite({ initialAttendanceOffset: 5 });

const adult = (id: string, name: string, over: Record<string, unknown> = {}) => student(id, name, { birthDate: ADULT, ...over });

/** Abre a selecao em lote da turma e marca os alunos. */
async function selectInClass(page: Page, classId: string, names: string[]) {
  await page.goto(`/classes/${classId}`);
  await expect(page.getByText(names[0], { exact: true })).toBeVisible();
  await pageAction(page, "Mais ações da turma", "Selecionar alunos");
  for (const name of names) await page.getByRole("checkbox", { name: `Selecionar ${name}` }).click();
  await expect(page.getByText(`${names.length} selecionado${names.length > 1 ? "s" : ""}`)).toBeVisible();
}

test("Turma: mudar dois alunos de turma num passo, subindo de faixa junto", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [adult("c-a", "Ana Lima", { progressions: { "m-jj": aptoWhite() } }), adult("c-b", "Bruno Reis", { progressions: { "m-jj": aptoWhite() } })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Iniciante"), classGroup("cg-2", "Jiu-Jitsu Avançado", { meetingSlots: [{ weekday: 4, start: "19:00", end: "20:00" }] })];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-1", "c-b")];
    },
  });
  await selectInClass(page, "cg-1", ["Ana Lima", "Bruno Reis"]);
  await page.getByRole("button", { name: "Mudar de turma", exact: true }).click();

  const drawer = page.getByRole("dialog", { name: "Mudar de turma" });
  await expect(drawer).toContainText("2 alunos saem de Jiu-Jitsu Iniciante.");
  // Sem destino: o erro aparece no campo e nada muda.
  await drawer.getByRole("button", { name: "Mudar de turma", exact: true }).click();
  await expect(drawer.getByText("Escolha a turma de destino.")).toBeVisible();

  await pick(page, drawer, /Turma de destino/, /Jiu-Jitsu Avançado · 10 vagas/);
  await drawer.getByRole("switch", { name: /Subir de faixa junto/ }).click();
  await drawer.getByRole("button", { name: "Mudar de turma", exact: true }).click();

  await expect(page.getByText("2 alunos mudaram para Jiu-Jitsu Avançado; 2 subiram de faixa.")).toBeVisible();
  await expect(drawer).toBeHidden();
  // Selecao fecha e a turma fica sem os dois.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("main").getByText("Ana Lima", { exact: true })).toHaveCount(0);

  const world = await readAcademy();
  const old = world.enrollments.find((e: { id: string }) => e.id === "e-1");
  expect(old).toMatchObject({ status: "canceled", movedToClassGroupId: "cg-2", cancellationReason: "Mudou para Jiu-Jitsu Avançado" });
  expect(world.enrollments.filter((e: { classGroupId: string; status: string }) => e.classGroupId === "cg-2" && e.status === "active")).toHaveLength(2);
  const ana = world.clients.find((c: { id: string }) => c.id === "c-a");
  expect(ana.progressions["m-jj"]).toMatchObject({ levelName: "Faixa Azul", subLevel: 0 });

  // Na ficha, a matricula antiga diz que foi mudanca, nao saida.
  await page.goto("/clients/c-a");
  const section = await openProfileSection(page, "Turmas");
  await section.getByRole("button", { name: /Mostrar encerradas/ }).click();
  await expect(section.getByText(/Mudou para Jiu-Jitsu Avançado em \d{2}\/\d{2}/)).toBeVisible();
});

test("Turma: graduar vários com o apto marcado e confirmação de quem não está apto", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [adult("c-a", "Ana Lima", { progressions: { "m-jj": aptoWhite() } }), adult("c-b", "Bruno Reis", { progressions: { "m-jj": earlyWhite() } })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a"), enrollment("e-2", "cg-1", "c-b")];
    },
  });
  await selectInClass(page, "cg-1", ["Ana Lima", "Bruno Reis"]);
  await page.getByRole("button", { name: "Graduar", exact: true }).click();

  const drawer = page.getByRole("dialog", { name: "Graduar alunos" });
  // Apto ja vem marcado; quem nao esta mostra o que falta.
  await expect(drawer.getByRole("checkbox", { name: "Incluir Ana Lima" })).toBeChecked();
  await expect(drawer.getByText("Apto para graduar")).toBeVisible();
  await expect(drawer.getByRole("checkbox", { name: "Incluir Bruno Reis" })).not.toBeChecked();
  await expect(drawer.getByText("Faltam 25 aulas")).toBeVisible();
  // Com graus sobrando, o passo sugerido e o proximo grau (a proxima faixa fica no seletor).
  await expect(drawer.getByRole("combobox", { name: "Para onde Ana Lima vai" })).toHaveText(/1º grau/);

  await drawer.getByRole("checkbox", { name: "Incluir Bruno Reis" }).click();
  await drawer.getByLabel("Quem graduou (opcional)").fill("Mestre Carlos");
  await drawer.getByRole("button", { name: "Graduar 2 alunos" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Graduar 2 alunos?" });
  await expect(confirm).toContainText("1 aluno ainda não está apto.");
  await confirm.getByRole("button", { name: "Graduar", exact: true }).click();

  await expect(page.getByText("Registrado para 2 alunos.")).toBeVisible();
  await expect(drawer).toBeHidden();
  const world = await readAcademy();
  for (const id of ["c-a", "c-b"]) {
    const p = world.clients.find((c: { id: string }) => c.id === id).progressions["m-jj"];
    expect(p).toMatchObject({ levelName: "Faixa Branca", subLevel: 1, promotedAt: "2026-09-22" });
    expect(p.promotionHistory[0]).toMatchObject({ examiner: "Mestre Carlos", toSubLevel: 1 });
  }
});

test("Apto com notas: a média da etapa abaixo da mínima tira o selo e diz por quê", async ({ page }) => {
  const english = (id: string, name: string) =>
    adult(id, name, { progressions: { "m-en": progression("m-en", "Inglês", "lvl-gen-beg", "Iniciante", { initialAttendanceOffset: 24 }) } });
  await seedAcademy(page, {
    extra: (t) => {
      t.categories.push(modality("m-en", "Inglês", 1, { progressionTrack: LEVELS_TRACK, assessments: gradedSettings("zero_ten", 6) }));
      t.clients = [english("c-a", "Ana Lima"), english("c-b", "Bia Souza")];
      t.classGroups = [classGroup("cg-en", "Inglês A1", { modalityId: "m-en" })];
      t.enrollments = [enrollment("e-1", "cg-en", "c-a"), enrollment("e-2", "cg-en", "c-b")];
      t.assessments = [
        assessment("as-1", "cg-en", "m-en", "Prova do módulo", { levelId: "lvl-gen-beg", grades: [grade("c-a", 5), grade("c-b", 8)] }),
      ];
    },
  });

  // Individual: as linhas de nota aparecem e o selo segue a nota.
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
  await page.goto("/clients");
  await rowMenuAction(page, "Ana Lima", "Níveis");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Média neste nível")).toBeVisible();
  await expect(dialog.getByText("5 · mínima 6")).toBeVisible();
  await expect(dialog.getByText("Apto para avançar")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Em lote: Bia apta e marcada; Ana com o motivo, sem marcar.
  await selectInClass(page, "cg-en", ["Ana Lima", "Bia Souza"]);
  await page.getByRole("button", { name: "Avançar", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Avançar alunos" });
  await expect(drawer.getByRole("checkbox", { name: "Incluir Bia Souza" })).toBeChecked();
  await expect(drawer.getByRole("checkbox", { name: "Incluir Ana Lima" })).not.toBeChecked();
  await expect(drawer.getByText("Média 5, mínima 6")).toBeVisible();
});

test.describe("evento de graduação", () => {
  const visitor = (id: string, name: string, over: Record<string, unknown> = {}) =>
    adult(id, name, { planId: undefined, phone: `1197777${id.slice(-4).padStart(4, "0")}`, ...over });
  const reg = (id: string, studentId: string) => ({
    id,
    eventId: "ev-g",
    studentId,
    scope: "full",
    status: "confirmed",
    amountCents: 20000,
    installments: 1,
    registeredAt: TS,
  });
  const present = (id: string, registrationId: string, studentId: string) => ({
    id,
    organizationId: ORG,
    eventId: "ev-g",
    sessionId: "evs-g",
    registrationId,
    studentId,
    status: "present",
    markedAt: "2026-09-22T10:00:00.000Z",
  });
  const charge = (id: string, studentId: string, registrationId: string, over: Record<string, unknown> = {}) => ({
    id,
    organizationId: ORG,
    unitId: UNIT,
    studentId,
    kind: "event",
    eventId: "ev-g",
    eventRegistrationId: registrationId,
    description: "Exame de Faixa",
    competence: "2026-09",
    dueDate: "2026-09-30",
    amountCents: 20000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  });

  async function seedExam(page: Page) {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [
          visitor("c-0021", "Ana Lima", { progressions: { "m-jj": aptoWhite() } }),
          visitor("c-0022", "Bruno Reis", { progressions: { "m-jj": aptoWhite() } }),
          visitor("c-0023", "Carla Dias", { progressions: { "m-jj": aptoWhite() } }),
          adult("c-0024", "Diego Alves", { progressions: { "m-jj": aptoWhite() } }),
        ];
        // Diego treina na turma de Jiu-Jitsu e ainda nao se inscreveu: aparece nos aptos do Inscrever.
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.enrollments = [enrollment("e-1", "cg-1", "c-0024")];
        t.events = [
          {
            id: "ev-g",
            organizationId: ORG,
            unitId: UNIT,
            name: "Exame de Faixa",
            modalityId: "m-jj",
            instructors: [{ id: "ev-g-i1", guestName: "Mestre Convidado" }],
            billingMode: "fixed",
            priceCents: 20000,
            maxInstallments: 1,
            graduation: true,
            federationFeeCents: 6000,
            status: "active",
            createdAt: TS,
            updatedAt: TS,
          },
        ];
        t.eventSessions = [{ id: "evs-g", eventId: "ev-g", date: "2026-09-22", start: "09:00", end: "12:00", status: "scheduled", createdAt: TS, updatedAt: TS }];
        t.eventRegistrations = [reg("reg-ana", "c-0021"), reg("reg-bruno", "c-0022"), reg("reg-carla", "c-0023")];
        // Ana e Bruno vieram; Carla faltou.
        t.eventAttendances = [present("att-ana", "reg-ana", "c-0021"), present("att-bruno", "reg-bruno", "c-0022")];
        t.charges = [
          charge("ch-ana", "c-0021", "reg-ana", { status: "paid", paidAt: "2026-09-10T12:00:00.000Z", method: "pix" }),
          charge("ch-bruno", "c-0022", "reg-bruno"),
          charge("ch-carla", "c-0023", "reg-carla"),
        ];
      },
    });
    await page.goto("/events/ev-g");
    await expect(page.getByRole("heading", { name: "Exame de Faixa" })).toBeVisible();
  }

  test("aba Graduação gradua os presentes com a data e o examinador do evento, e o repasse aparece no Financeiro", async ({ page }) => {
    await seedExam(page);
    await expect(page.getByText("Evento de graduação").first()).toBeVisible();
    await page.getByRole("tab", { name: "Graduação" }).click();
    await expect(page.getByText("3 inscritos · 2 presentes · 0 graduados")).toBeVisible();

    await page.getByRole("button", { name: "Graduar", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Graduar alunos" });
    // So os presentes; a data e o dia do evento e quem conduz vira o examinador.
    await expect(drawer.getByRole("checkbox", { name: "Incluir Ana Lima" })).toBeChecked();
    await expect(drawer.getByRole("checkbox", { name: "Incluir Bruno Reis" })).toBeChecked();
    await expect(drawer.getByRole("checkbox", { name: "Incluir Carla Dias" })).toHaveCount(0);
    await expect(drawer.getByLabel("Data da graduação")).toHaveValue("2026-09-22");
    await expect(drawer.getByLabel("Quem graduou (opcional)")).toHaveValue("Mestre Convidado");
    await expect(drawer.getByText(/200,00 a receber/)).toBeVisible();

    await drawer.getByRole("button", { name: "Graduar 2 alunos" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Graduar 2 alunos?" });
    await expect(confirm).toContainText("1 aluno ainda deve o evento.");
    await confirm.getByRole("button", { name: "Graduar", exact: true }).click();

    await expect(page.getByText("Registrado para 2 alunos.")).toBeVisible();
    await expect(page.getByText("3 inscritos · 2 presentes · 2 graduados")).toBeVisible();
    await expect(page.getByText("Graduado neste evento")).toHaveCount(2);
    const world = await readAcademy();
    const history = world.clients.find((c: { id: string }) => c.id === "c-0021").progressions["m-jj"].promotionHistory;
    expect(history[0]).toMatchObject({ eventId: "ev-g", examiner: "Mestre Convidado", date: "2026-09-22", toSubLevel: 1 });

    // Financeiro do evento: o repasse por aluno graduado, lancado so quando a pessoa pede.
    await page.getByRole("tab", { name: "Financeiro" }).click();
    await expect(page.getByText(/Repasse à federação: 2 graduados × R\$\s60,00 = R\$\s120,00/)).toBeVisible();
    await expect(page.getByText("Ainda não lançado.")).toBeVisible();
    await page.getByRole("button", { name: "Lançar repasse" }).click();
    const entry = page.getByRole("dialog", { name: "Novo lançamento" });
    await expect(entry.getByLabel("Descrição")).toHaveValue("Repasse à federação");
    await expect(entry.getByLabel(/Valor/).first()).toHaveValue(/120,00/);
  });

  test("Inscrever marca os aptos da modalidade que ainda não estão no evento", async ({ page }) => {
    await seedExam(page);
    await page.getByRole("button", { name: "Inscrever" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Inscrever alunos" });
    await drawer.getByRole("button", { name: "Marcar os aptos de Jiu-Jitsu (1)" }).click();
    await expect(drawer.getByRole("option", { name: /Diego Alves/ })).toHaveAttribute("aria-selected", "true");
  });
});
