import { test, type Page } from "@playwright/test";
import { editWorld } from "../../e2e/fixtures";
import { freshTenant, OPEN_HOURS, ORG, readTenant, skipWelcomeDialog } from "../../e2e/areas-helpers";

/**
 * Telas reais do app para a landing (doc 08, secao 3.11), nos temas claro e
 * escuro. Monta um espaco de demonstracao pelo proprio assistente (Lutas, para
 * vir com a trilha de faixas) e grava o resto direto no mundo do mock, com as
 * datas em volta de hoje. Usa o relogio real: com o relogio congelado, o
 * servidor e o navegador discordam da data e a hidratacao falha.
 */
const OUT = `${__dirname}/../../src/assets/landing`;
const TS = "2026-03-01T12:00:00.000Z";
const UNIT = "unit-academia-x";
const base = { organizationId: ORG, status: "active", createdAt: TS, updatedAt: TS };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date();
const TODAY = iso(NOW);
const MONTH = TODAY.slice(0, 7);
// Aula de Jiu-Jitsu em andamento agora (chamada pela metade).
const START = `${pad(NOW.getHours())}:00`;
const END = `${pad(NOW.getHours() + 1)}:30`;
const JJ_DAYS = [...new Set([1, 3, NOW.getDay()])];
const PAST: string[] = [];
for (let k = 1; PAST.length < 6; k++) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - k);
  if (JJ_DAYS.includes(d.getDay())) PAST.push(iso(d));
}

// id, nome, turma principal, dia de vencimento
const STUDENTS: [string, string, string, number][] = [
  ["s-lucas", "Lucas Ferreira", "cg-jj", 10],
  ["s-mariana", "Mariana Lopes", "cg-jj", 10],
  ["s-pedro", "Pedro Henrique Alves", "cg-jj", 10],
  ["s-camila", "Camila Duarte", "cg-jj", 10],
  ["s-rafael", "Rafael Moura", "cg-jj", 10],
  ["s-beatriz", "Beatriz Santana", "cg-jj", 25],
  ["s-gustavo", "Gustavo Rezende", "cg-jj", 10],
  ["s-thiago", "Thiago Barros", "cg-mt", 10],
  ["s-larissa", "Larissa Campos", "cg-mt", 25],
  ["s-diego", "Diego Nunes", "cg-mt", 10],
  ["s-helena", "Helena Martins", "cg-yg", 10],
  ["s-sofia", "Sofia Ribeiro", "cg-yg", 25],
];
const PLAN_OF: Record<string, [string, number]> = { "cg-jj": ["p-jj", 16000], "cg-mt": ["p-mt", 14000], "cg-yg": ["p-yg", 12000] };
// Mensalidade do mes: paga, atrasada (venceu dia 10) ou em aberto (vence dia 25).
const PAID = new Set(["s-lucas", "s-mariana", "s-camila", "s-rafael", "s-thiago", "s-helena", "s-diego"]);

async function buildDemo(page: Page) {
  await freshTenant(page);
  await page.getByLabel("Nome").fill("Espaço Movimento");
  await page.getByRole("button", { name: "Continuar" }).click();
  // Escolher a area ja avanca para as aulas.
  await page.getByRole("radio", { name: /^Lutas/ }).click();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForTimeout(800);
  const modalities = (await readTenant(page)).categories as { id: string; name: string }[];
  const jj = modalities.find((c) => c.name === "Jiu-Jitsu")!.id;
  const mt = modalities.find((c) => c.name === "Muay Thai")!.id;

  await editWorld(page, ORG, (t) => {
    t.organization.settings = {
      onboardingCompleted: true,
      modalitiesReviewed: true,
      defaultDueDay: 10,
      billingTiming: "prepaid",
      midMonthStrategy: "prorated",
    };
    t.unit.businessHours = OPEN_HOURS;
    t.categories.push({ ...base, id: "m-yg", name: "Yoga", position: 2 });
    const pros: [string, string, string[]][] = [
      ["pr-1", "Carlos Silva", [jj]],
      ["pr-2", "Rafael Costa", [mt]],
      ["pr-3", "Juliana Prado", ["m-yg"]],
    ];
    t.professionals = pros.map(([id, name, modalityIds]) => ({ ...base, id, unitId: UNIT, name, modalityIds, serviceIds: [], workingHours: [] }));
    const plans: [string, string, number][] = [
      ["p-jj", "Mensal Jiu-Jitsu", 16000],
      ["p-mt", "Mensal Muay Thai", 14000],
      ["p-yg", "Mensal Yoga", 12000],
    ];
    t.plans = plans.map(([id, name, priceCents]) => ({ ...base, id, name, priceCents, period: "monthly" }));
    const slots = (days: number[], start: string, end: string) => days.map((weekday) => ({ weekday, start, end }));
    t.classGroups = [
      { id: "cg-jj", name: "Jiu-Jitsu Adulto", modalityId: jj, instructorId: "pr-1", capacity: 20, meetingSlots: slots([...new Set([...JJ_DAYS, 5])], START, END) },
      { id: "cg-mt", name: "Muay Thai", modalityId: mt, instructorId: "pr-2", capacity: 15, meetingSlots: slots([1, 3, 5], "18:00", "19:00") },
      { id: "cg-yg", name: "Yoga Manhã", modalityId: "m-yg", instructorId: "pr-3", capacity: 10, meetingSlots: slots([2, 4, 6], "07:00", "08:00") },
    ].map((g) => ({ ...base, unitId: UNIT, allowDropin: true, sessionPriceCents: 4000, startDate: "2026-03-02", billingMode: "membership", ...g }));
    t.clients = STUDENTS.map(([id, name, cg, dueDay], i) => ({
      ...base,
      id,
      name,
      phone: `1198${String(1234567 + i * 7919).slice(0, 7)}`,
      birthDate: `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`,
      planId: PLAN_OF[cg][0],
      // Plano a partir deste mes: os meses antes nao geram mensalidade atrasada.
      planStartDate: `${MONTH}-01`,
      billingStrategy: "prorated",
      cyclePaymentTiming: "prepaid",
      dueDay,
      membershipStatus: "active",
    }));
    t.clients[0].progressions = {
      [jj]: {
        modalityId: jj,
        modalityName: "Jiu-Jitsu",
        levelId: "lvl-blue",
        levelName: "Faixa Azul",
        levelColor: "blue",
        subLevel: 2,
        maxSubLevels: 4,
        promotedAt: "2026-03-14",
        strengths: ["Guarda fechada", "Raspagens", "Passagem de guarda"],
        goals: [],
        // Registros de aula recentes (ficha com historico, nao vazia).
        evaluations: [
          { tone: "positive", note: "Boa base na guarda fechada.", classNote: "Raspagens da guarda aberta" },
          { tone: "attention", note: "Ajustar a postura na passagem de guarda." },
          { tone: "positive", note: "Finalizou bem no treino de posição." },
        ].map((e, k) => ({
          id: `ev-${k}`,
          date: PAST[k],
          classGroupId: "cg-jj",
          classGroupName: "Jiu-Jitsu Adulto",
          sessionId: `cg-jj~${PAST[k]}~${START}`,
          authorName: "Carlos Silva",
          createdAt: `${PAST[k]}T22:00:00.000Z`,
          ...e,
        })),
        promotionHistory: [],
        updatedAt: TS,
      },
    };
    t.enrollments = STUDENTS.map(([id, , cg], i) => ({ id: `e-${i}`, classGroupId: cg, studentId: id, status: "active", enrolledAt: TS }));
    t.enrollments.push(
      { id: "e-x1", classGroupId: "cg-yg", studentId: "s-camila", status: "active", enrolledAt: TS },
      { id: "e-x2", classGroupId: "cg-mt", studentId: "s-lucas", status: "active", enrolledAt: TS },
    );
    const lastDay = iso(new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0));
    t.charges = STUDENTS.map(([id, , cg, dueDay], i) => {
      const [planId, amountCents] = PLAN_OF[cg];
      const paid = PAID.has(id);
      return {
        id: `ch-${i}`,
        organizationId: ORG,
        unitId: UNIT,
        studentId: id,
        kind: "membership",
        planId,
        competence: MONTH,
        dueDate: `${MONTH}-${pad(dueDay)}`,
        periodStart: `${MONTH}-01`,
        periodEnd: lastDay,
        amountCents,
        status: paid ? "paid" : "pending",
        ...(paid ? { paidAt: `${MONTH}-0${(i % 8) + 1}T14:00:00.000Z`, method: i % 3 ? "pix" : "cash", paidVia: "manual" } : {}),
        createdAt: TS,
        updatedAt: TS,
      };
    });
    // Segunda cobranca para Gustavo e Beatriz (mostra o agrupamento por aluno em Cobrancas).
    t.charges.push(
      {
        id: "ch-extra-gustavo",
        organizationId: ORG,
        unitId: UNIT,
        studentId: "s-gustavo",
        kind: "package",
        description: "Pacote 8 aulas · Muay Thai",
        competence: MONTH,
        dueDate: `${MONTH}-25`,
        amountCents: 18000,
        status: "pending",
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: "ch-extra-beatriz",
        organizationId: ORG,
        unitId: UNIT,
        studentId: "s-beatriz",
        kind: "extra",
        description: "Kimono trançado azul",
        competence: MONTH,
        dueDate: `${MONTH}-25`,
        amountCents: 22000,
        status: "pending",
        createdAt: TS,
        updatedAt: TS,
      },
    );
    // Financeiro: categorias de despesa, lancamentos do mes e regras dos professores.
    t.financialCategories.push(
      { ...base, id: "fc-rent", type: "expense", name: "Aluguel e estrutura" },
      { ...base, id: "fc-util", type: "expense", name: "Contas e internet" },
      { ...base, id: "fc-equip", type: "expense", name: " Tatame e equipamentos" },
    );
    t.financialEntries = [
      {
        ...base,
        id: "fe-1",
        unitId: UNIT,
        type: "expense",
        categoryId: "fc-rent",
        description: "Aluguel do espaço",
        amountCents: 18000,
        dueDate: `${MONTH}-05`,
        status: "paid",
        paidAt: `${MONTH}-05T10:00:00.000Z`,
        method: "pix",
      },
      {
        ...base,
        id: "fe-2",
        unitId: UNIT,
        type: "expense",
        categoryId: "fc-util",
        description: "Energia elétrica e internet fibra",
        amountCents: 6500,
        dueDate: `${MONTH}-10`,
        status: "paid",
        paidAt: `${MONTH}-09T15:00:00.000Z`,
        method: "pix",
      },
      {
        ...base,
        id: "fe-3",
        unitId: UNIT,
        type: "expense",
        categoryId: "fc-equip",
        description: "Higienização e manutenção do tatame",
        amountCents: 4500,
        dueDate: `${MONTH}-25`,
        status: "pending",
      },
    ];
    t.teacherPayRules = [
      {
        ...base,
        id: "tpr-1",
        professionalId: "pr-1",
        components: [{ kind: "percent_of_memberships", percent: 40 }],
        paymentDay: 5,
        startCompetence: "2026-01",
      },
      {
        ...base,
        id: "tpr-2",
        professionalId: "pr-2",
        components: [{ kind: "per_session", amountCents: 5000 }],
        paymentDay: 5,
        startCompetence: "2026-01",
      },
      {
        ...base,
        id: "tpr-3",
        professionalId: "pr-3",
        components: [{ kind: "fixed_monthly", amountCents: 15000 }],
        paymentDay: 5,
        startCompetence: "2026-01",
      },
    ];
    // Lucas vem a todas; Gustavo faltou nas ultimas (aparece em Alunos sumindo no Painel). Hoje: 5 presentes, 2 a marcar.
    const jjStudents = STUDENTS.filter(([, , cg]) => cg === "cg-jj").map(([id]) => id);
    t.attendances = [];
    PAST.forEach((date, k) => {
      jjStudents.forEach((sid, i) => {
        const absent = sid === "s-gustavo" || (sid !== "s-lucas" && (i + k) % 4 === 3);
        t.attendances.push({ id: `a-${date}-${sid}`, sessionId: `cg-jj~${date}~${START}`, studentId: sid, status: absent ? "absent" : "present", markedAt: `${date}T22:00:00.000Z` });
      });
    });
    ["s-lucas", "s-mariana", "s-pedro", "s-camila", "s-rafael"].forEach((sid) =>
      t.attendances.push({ id: `a-today-${sid}`, sessionId: `cg-jj~${TODAY}~${START}`, studentId: sid, status: "present", markedAt: new Date().toISOString() }),
    );
  });
  await skipWelcomeDialog(page);
}

// SHOTS=attendance,student refaz so esses (padrao: todos).
const ONLY = process.env.SHOTS?.split(",").map((s) => s.trim());

async function shoot(
  page: Page,
  name: string,
  url: string,
  size: { width: number; height: number },
  beforeShot?: (page: Page) => Promise<void>,
) {
  if (ONLY && !ONLY.includes(name)) return;
  await page.setViewportSize(size);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => localStorage.setItem("gestarahub:theme", th), theme);
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Some o selo de desenvolvimento do Next.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(1200);
    if (beforeShot) {
      await beforeShot(page);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
  }
}

test("telas da landing", async ({ page }) => {
  // Dicas "Lista ou cards" e tour das abas ja vistos (como no fixture do e2e).
  await page.addInitScript(() => {
    for (const key of ["clients", "turmas", "modalities", "plans", "professionals"]) {
      localStorage.setItem(`gestarahub_coachmark_view_mode_${key}`, "1");
    }
    localStorage.setItem("gestarahub_tour_plans_tabs", "1");
  });
  await buildDemo(page);
  await shoot(
    page,
    "dashboard",
    "/dashboard",
    { width: 1280, height: 800 },
    async (p) => {
      const closeBtn = p.getByRole("button", { name: "Fechar", exact: true });
      if (await closeBtn.isVisible()) await closeBtn.click();
    },
  );
  await shoot(page, "attendance", `/classes/sessions/${encodeURIComponent(`cg-jj~${TODAY}~${START}`)}`, { width: 390, height: 844 });
  await shoot(page, "calendar", "/classes/calendar", { width: 1280, height: 800 });
  await shoot(
    page,
    "billing",
    "/classes/billing",
    { width: 1280, height: 800 },
    async (p) => {
      // Expande o Gustavo para mostrar o agrupamento de cobrancas por aluno aberto.
      const btn = p.getByRole("button", { name: "Ver cobranças" }).first();
      if (await btn.isVisible()) await btn.click();
    },
  );
  await shoot(page, "finance", "/finance", { width: 1280, height: 800 });
  // Ficha em sanfona: abre a evolucao (faixa, graus e pontos fortes).
  await shoot(page, "student", "/clients/s-lucas?tab=evolution", { width: 1280, height: 800 });
});
