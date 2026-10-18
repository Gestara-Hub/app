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
  await page.getByRole("radio", { name: /^Lutas/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Concluir e Começar" }).click();
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
      { id: "cg-jj", name: "Jiu-Jitsu Adulto", modalityId: jj, instructorId: "pr-1", capacity: 20, meetingSlots: slots(JJ_DAYS, START, END) },
      { id: "cg-mt", name: "Muay Thai", modalityId: mt, instructorId: "pr-2", capacity: 15, meetingSlots: slots([1, 3], "18:00", "19:00") },
      { id: "cg-yg", name: "Yoga Manhã", modalityId: "m-yg", instructorId: "pr-3", capacity: 10, meetingSlots: slots([2, 4], "07:00", "08:00") },
    ].map((g) => ({ ...base, unitId: UNIT, allowDropin: true, sessionPriceCents: 4000, startDate: "2026-03-02", billingMode: "membership", ...g }));
    t.clients = STUDENTS.map(([id, name, cg, dueDay], i) => ({
      ...base,
      id,
      name,
      phone: `1198${String(1234567 + i * 7919).slice(0, 7)}`,
      birthDate: `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`,
      planId: PLAN_OF[cg][0],
      planStartDate: "2026-03-01",
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
        evaluations: [],
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
        dueDate: `${MONTH}-${dueDay}`,
        periodStart: `${MONTH}-01`,
        periodEnd: lastDay,
        amountCents,
        status: paid ? "paid" : "pending",
        ...(paid ? { paidAt: `${MONTH}-0${(i % 8) + 1}T14:00:00.000Z`, method: i % 3 ? "pix" : "cash", paidVia: "manual" } : {}),
        createdAt: TS,
        updatedAt: TS,
      };
    });
    // Lucas vem a todas; os outros faltam de vez em quando. Hoje: 5 presentes, 2 a marcar.
    const jjStudents = STUDENTS.filter(([, , cg]) => cg === "cg-jj").map(([id]) => id);
    t.attendances = [];
    PAST.forEach((date, k) => {
      jjStudents.forEach((sid, i) => {
        const absent = sid !== "s-lucas" && (i + k) % 4 === 3;
        t.attendances.push({ id: `a-${date}-${sid}`, sessionId: `cg-jj~${date}~${START}`, studentId: sid, status: absent ? "absent" : "present", markedAt: `${date}T22:00:00.000Z` });
      });
    });
    ["s-lucas", "s-mariana", "s-pedro", "s-camila", "s-rafael"].forEach((sid) =>
      t.attendances.push({ id: `a-today-${sid}`, sessionId: `cg-jj~${TODAY}~${START}`, studentId: sid, status: "present", markedAt: new Date().toISOString() }),
    );
  });
  await skipWelcomeDialog(page);
}

async function shoot(page: Page, name: string, url: string, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((th) => localStorage.setItem("gestarahub:theme", th), theme);
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Some o selo de desenvolvimento do Next.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(1500);
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
  await shoot(page, "attendance", `/classes/sessions/${encodeURIComponent(`cg-jj~${TODAY}~${START}`)}`, { width: 390, height: 844 });
  await shoot(page, "billing", "/classes/billing", { width: 1280, height: 800 });
  await shoot(page, "student", "/clients/s-lucas", { width: 1280, height: 800 });
});
