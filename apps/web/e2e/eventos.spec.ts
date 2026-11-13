import type { Page } from "@playwright/test";
import {
  editAcademy,
  expect,
  expectActiveTab,
  expectOverdueRow,
  readAcademy,
  seedAcademy,
  statCard,
  statusTab,
  student,
  test,
} from "./fixtures";

/**
 * Eventos e seminarios (doc product/29). Relogio fixo em 22/09/2026: os dias
 * dos eventos ficam em outubro (ainda nao aconteceram).
 */

const TS = "2026-09-01T12:00:00.000Z";
const ORG = "org-academia-x";
const UNIT = "unit-academia-x";

function event(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: UNIT,
    name,
    modalityId: "m-jj",
    instructors: [{ id: `${id}-i1`, guestName: "Mestre Convidado", guestOrigin: "Academia Sul, Curitiba" }],
    billingMode: "fixed",
    priceCents: 20000,
    maxInstallments: 1,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

function day(id: string, eventId: string, date: string) {
  return { id, eventId, date, start: "09:00", end: "12:00", status: "scheduled", createdAt: TS, updatedAt: TS };
}

/** Aluno sem plano: o evento e a unica cobranca dele. */
const visitor = (id: string, name: string) => student(id, name, { planId: undefined, phone: `1197777${id.slice(-4).padStart(4, "0")}` });

async function openEvent(page: Page, name: string) {
  await page.goto("/events");
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function pickStudents(page: Page, names: string[]) {
  const drawer = page.getByRole("dialog", { name: "Inscrever alunos" });
  for (const name of names) {
    await drawer.getByRole("option", { name: new RegExp(name) }).click();
    await expect(drawer.getByRole("option", { name: new RegExp(name) })).toHaveAttribute("aria-selected", "true");
  }
  return drawer;
}

test("Eventos: novo evento com convidado, um dia e valor fechado", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/events");
  await page.getByRole("button", { name: "Novo evento" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Novo evento" });

  // Sem nada: o primeiro erro aparece e nada e salvo.
  await drawer.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(drawer.getByText(/Informe o nome/).first()).toBeVisible();

  await drawer.getByLabel("Nome").fill("Seminário de Guarda");
  await drawer.getByRole("radio", { name: "Convidado" }).click();
  await drawer.getByLabel("Nome do convidado").fill("Mestre Convidado");
  await drawer.locator('input[name="sessions.0.date"]').fill("2026-10-03");
  await drawer.getByRole("spinbutton", { name: "Vagas", exact: true }).fill("20");
  await drawer.getByLabel("Valor do evento").fill("15000");
  await drawer.getByRole("button", { name: "Adicionar", exact: true }).click();

  await expect(drawer).toBeHidden();
  await expect(page.getByText("Seminário de Guarda").first()).toBeVisible();
  const world = await readAcademy();
  const created = (world.events ?? []).find((e: { name: string }) => e.name === "Seminário de Guarda");
  expect(created).toMatchObject({ billingMode: "fixed", priceCents: 15000, capacity: 20 });
  expect(created.instructors).toEqual([expect.objectContaining({ guestName: "Mestre Convidado" })]);
  expect((world.eventSessions ?? []).filter((s: { eventId: string }) => s.eventId === created.id)).toHaveLength(1);
});

test("Eventos: inscrever três de uma vez com duas vagas, um vai para a espera e é promovido", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [visitor("c-0001", "Aluna Um"), visitor("c-0002", "Aluno Dois"), visitor("c-0003", "Aluna Três")];
      t.events = [event("ev-1", "Seminário Lotado", { capacity: 2 })];
      t.eventSessions = [day("evs-1", "ev-1", "2026-10-03")];
      t.eventRegistrations = [];
    },
  });
  await openEvent(page, "Seminário Lotado");
  await page.getByRole("button", { name: "Inscrever", exact: true }).first().click();
  const drawer = await pickStudents(page, ["Aluna Um", "Aluno Dois", "Aluna Três"]);
  await expect(drawer.getByText("Você escolheu 3 para 2 vagas.", { exact: false })).toBeVisible();
  await expect(drawer.getByText("Cobrança de cada aluno")).toBeVisible();
  await expect(drawer.getByText("Vale para cada aluno.", { exact: false })).toBeVisible();
  await drawer.getByRole("button", { name: "Inscrever 3 alunos" }).click();

  await expect(page.getByText("2 inscritos e 1 na lista de espera.")).toBeVisible();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("tab", { name: /Inscritos \(2\)/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Espera \(1\)/ })).toBeVisible();

  let world = await readAcademy();
  const regs = (world.eventRegistrations ?? []) as { studentId: string; status: string }[];
  expect(regs.filter((r) => r.status === "confirmed")).toHaveLength(2);
  const waiting = regs.find((r) => r.status === "waitlist");
  expect(waiting).toBeTruthy();
  // Cada inscrito confirmado tem a sua cobranca do evento; a espera nao cobra.
  const eventCharges = (world.charges ?? []).filter((c: { kind: string }) => c.kind === "event");
  expect(eventCharges).toHaveLength(2);
  expect(eventCharges.every((c: { amountCents: number }) => c.amountCents === 20000)).toBe(true);
  expect(eventCharges.some((c: { studentId: string }) => c.studentId === waiting!.studentId)).toBe(false);

  // Abriu uma vaga (mais vagas no evento): promover cobra e confirma.
  await editAcademy((t) => {
    t.events[0].capacity = 3;
  });
  await page.reload();
  await page.getByRole("tab", { name: /Espera \(1\)/ }).click();
  const waitingName = ["Aluna Um", "Aluno Dois", "Aluna Três"].find(
    (n) => (world.clients as { id: string; name: string }[]).find((c) => c.name === n)?.id === waiting!.studentId,
  )!;
  await page.getByRole("button", { name: `Ações de ${waitingName}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Promover" }).click();
  const promote = page.getByRole("dialog", { name: "Promover da espera" });
  await expect(promote.getByText(`${waitingName} sai da lista de espera.`)).toBeVisible();
  await promote.getByRole("button", { name: "Inscrever" }).click();
  await expect(page.getByText(`${waitingName} saiu da lista de espera e está inscrito.`)).toBeVisible();
  await expect(page.getByRole("tab", { name: /Inscritos \(3\)/ })).toBeVisible();

  world = await readAcademy();
  expect((world.charges ?? []).filter((c: { kind: string }) => c.kind === "event")).toHaveLength(3);
});

test("Eventos: por dia, o valor acompanha os dias marcados e zero pede confirmação", async ({ page }) => {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [visitor("c-0004", "Aluno Dia"), visitor("c-0005", "Aluna Grátis")];
      t.events = [event("ev-2", "Seminário por Dia", { billingMode: "per_day", priceCents: undefined, dayPriceCents: 5000 })];
      t.eventSessions = [day("evs-2a", "ev-2", "2026-10-03"), day("evs-2b", "ev-2", "2026-10-04")];
      t.eventRegistrations = [];
    },
  });
  await openEvent(page, "Seminário por Dia");
  await page.getByRole("button", { name: "Inscrever", exact: true }).first().click();
  let drawer = await pickStudents(page, ["Aluno Dia"]);
  await drawer.getByRole("radio", { name: "Só alguns dias" }).click();
  const value = drawer.getByLabel("Valor");
  await expect(value).toHaveValue("0,00");
  const days = drawer.getByRole("checkbox");
  await days.nth(0).click();
  await expect(value).toHaveValue("50,00");
  await days.nth(1).click();
  await expect(value).toHaveValue("100,00");
  await days.nth(1).click();
  await expect(value).toHaveValue("50,00");
  await drawer.getByRole("button", { name: "Inscrever" }).click();
  await expect(page.getByText("Aluno inscrito.")).toBeVisible();
  await expect(drawer).toBeHidden();

  let world = await readAcademy();
  const reg = (world.eventRegistrations ?? []).find((r: { studentId: string }) => r.studentId === "c-0004");
  expect(reg).toMatchObject({ scope: "days", sessionIds: ["evs-2a"], amountCents: 5000, status: "confirmed" });

  // Cortesia: valor zero pergunta antes de inscrever sem cobranca.
  await page.getByRole("button", { name: "Inscrever", exact: true }).first().click();
  drawer = await pickStudents(page, ["Aluna Grátis"]);
  await drawer.getByLabel("Valor").fill("0");
  await drawer.getByRole("button", { name: "Inscrever" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Inscrever sem cobrança?");
  await confirm.getByRole("button", { name: "Inscrever sem cobrança" }).click();
  await expect(drawer).toBeHidden();

  // O aviso do primeiro inscrito ainda pode estar na tela: espera a gravacao no banco.
  await expect
    .poll(async () => ((await readAcademy()).eventRegistrations ?? []).some((r: { studentId: string }) => r.studentId === "c-0005"))
    .toBe(true);
  world = await readAcademy();
  const free = (world.eventRegistrations ?? []).find((r: { studentId: string }) => r.studentId === "c-0005");
  expect(free).toMatchObject({ amountCents: 0, status: "confirmed" });
  expect((world.charges ?? []).filter((c: { studentId: string; kind: string }) => c.kind === "event" && c.studentId === "c-0005")).toHaveLength(0);
});

test("Eventos: aba Financeiro com os cartões e a lista de Cobranças, o pagamento e os lançamentos do evento", async ({ page }) => {
  const reg = (id: string, studentId: string) => ({
    id,
    eventId: "ev-fin",
    studentId,
    scope: "full",
    status: "confirmed",
    amountCents: 20000,
    installments: 1,
    registeredAt: TS,
  });
  const evCharge = (id: string, studentId: string, registrationId: string, over: Record<string, unknown> = {}) => ({
    id,
    organizationId: ORG,
    unitId: UNIT,
    studentId,
    kind: "event",
    eventId: "ev-fin",
    eventRegistrationId: registrationId,
    description: "Seminário de Caixa",
    competence: "2026-09",
    dueDate: "2026-09-30",
    amountCents: 20000,
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  });
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [visitor("c-0011", "Ana Paga"), visitor("c-0012", "Bruno Atrasado"), visitor("c-0013", "Carla Pendente")];
      t.events = [event("ev-fin", "Seminário de Caixa")];
      t.eventSessions = [day("evs-fin", "ev-fin", "2026-10-03")];
      t.eventRegistrations = [reg("reg-ana", "c-0011"), reg("reg-bruno", "c-0012"), reg("reg-carla", "c-0013")];
      t.charges = [
        evCharge("ch-ana", "c-0011", "reg-ana", { status: "paid", paidAt: "2026-09-10T12:00:00.000Z", method: "pix" }),
        // Venceu em 15/09 (o relogio do teste e 22/09): em atraso.
        evCharge("ch-bruno", "c-0012", "reg-bruno", { dueDate: "2026-09-15" }),
        evCharge("ch-carla", "c-0013", "reg-carla"),
      ];
      t.financialEntries = [
        {
          id: "fe-cache",
          organizationId: ORG,
          unitId: UNIT,
          type: "expense",
          categoryId: `fcat-${ORG}-utilities`,
          description: "Cachê do convidado",
          amountCents: 50000,
          dueDate: "2026-09-30",
          status: "pending",
          eventId: "ev-fin",
          createdAt: TS,
          updatedAt: TS,
        },
      ];
    },
  });
  await openEvent(page, "Seminário de Caixa");
  await page.getByRole("tab", { name: /Financeiro/ }).click();

  // Os cartoes de Cobrancas, com os numeros do evento.
  await expect(statCard(page, "Recebido")).toContainText("R$ 200,00");
  await expect(statCard(page, "A receber")).toContainText("R$ 400,00");
  await expect(statCard(page, "A receber")).toContainText("R$ 200,00 em atraso");
  await expect(statCard(page, "Saídas")).toContainText("R$ 500,00");
  await expect(statCard(page, "Resultado")).toContainText("R$ 200,00");

  // A lista abre em "A receber", como em Cobrancas: o atraso em vermelho na linha, sem selo; a paga fica de fora.
  const row = (id: string) => page.locator(`[data-record-id="${id}"]`);
  await expectActiveTab(page, "A receber");
  await expectOverdueRow(row("ch-bruno"), "15/09");
  await expect(row("ch-bruno").getByText("Atrasado", { exact: true })).toHaveCount(0);
  await expect(row("ch-carla")).toContainText("vence 30/09");
  await expect(row("ch-ana")).toHaveCount(0);

  // O link do cartao filtra a lista e marca a aba.
  await statCard(page, "Recebido").getByText("Ver pagas").click();
  await expectActiveTab(page, "Pagas");
  await expect(row("ch-ana")).toContainText("pago via Pix");
  await expect(row("ch-bruno")).toHaveCount(0);

  // Todas e a busca por aluno.
  await statusTab(page, "Todas").click();
  await expect(row("ch-ana")).toBeVisible();
  await page.getByLabel("Buscar aluno").fill("Carla");
  await expect(row("ch-carla")).toBeVisible();
  await expect(row("ch-bruno")).toHaveCount(0);
  await page.getByLabel("Buscar aluno").fill("");

  // As acoes de Cobrancas na linha: marcar pago atualiza os cartoes.
  await statusTab(page, "A receber").click();
  await page.getByRole("button", { name: "Ações de Bruno Atrasado", exact: true }).click();
  await page.getByRole("menuitem", { name: "Marcar pago" }).click();
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await pay.getByRole("radio", { name: "Pix" }).click();
  await pay.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
  await expect(statCard(page, "Recebido")).toContainText("R$ 400,00");
  await expect(statCard(page, "A receber")).toContainText("R$ 200,00");
  await expect(statCard(page, "A receber")).not.toContainText("em atraso");
  await expect(row("ch-bruno")).toHaveCount(0);

  // Lancamentos do evento: linha do Financeiro, sem selo, e "Abrir no Financeiro" no mes do vencimento.
  await expect(row("fe-cache")).toContainText("Saída · vence 30/09");
  await expect(row("fe-cache")).toContainText("− R$ 500,00");
  await page.getByRole("button", { name: "Ações de Cachê do convidado", exact: true }).click();
  await page.getByRole("menuitem", { name: "Abrir no Financeiro" }).click();
  await expect(page).toHaveURL(/\/finance\?tab=lancamentos&month=2026-09/);
});
