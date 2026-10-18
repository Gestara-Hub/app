import type {
  Charge,
  ClassGroupView,
  CreateClassGroup,
  ProfessionalView,
  TeacherPayoutLine,
} from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { packagesService } from "@/services/packagesService";
import { teacherPayService } from "@/services/teacherPayService";
import { turmasService } from "@/services/turmasService";
import {
  createInstructor,
  createPlan,
  createStudent,
  enrollStudent,
  resetAcademy,
  sessionIdOf,
} from "@/test/academy";

/**
 * Repasse do professor com "% do que os alunos pagaram" (decisao 7 do doc 20):
 * mensalidades como antes, parcelas de curso pagas para o titular do curso e
 * aulas de pacote dadas pelo valor de cada aula (pacote pago por inteiro).
 * Hoje congelado em 22/09/2026 (terca); as aulas de segunda caem em 14 e 21/09.
 */

const plain = (text: string) => text.replace(/ /g, " ");

let slotHour = 6;
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

function classOf(teacher: ProfessionalView, over: Partial<CreateClassGroup>): Promise<ClassGroupView> {
  return turmasService.create({
    name: "Turma",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    meetingSlots: nextSlot(),
    startDate: "2026-09-01",
    status: "active",
    ...over,
  });
}

const sessionOf = (g: ClassGroupView, date: string) => sessionIdOf(g.id, date, g.meetingSlots[0].start);

const chargesOf = (studentId: string, kind: Charge["kind"]): Charge[] =>
  store.charges
    .filter((c) => c.studentId === studentId && c.kind === kind)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

async function payAll(charges: Charge[]) {
  for (const c of charges) await billingService.markPaid(c.id, "pix");
}

async function newPackage(lessons: number, priceCents: number) {
  return packagesService.createPackage({
    name: `${lessons} aulas`,
    lessons,
    priceCents,
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
  });
}

const percentRule = (value: number) => ({
  components: [{ kind: "percent_of_memberships" as const, percent: value }],
  startCompetence: "2026-09",
});

const brief = (lines: TeacherPayoutLine[]) =>
  lines.map((l) => ({ source: l.source, label: plain(l.label), amountCents: l.amountCents }));

async function linesOf(professionalId: string, competence = "2026-09") {
  const view = (await teacherPayService.listPayouts(competence)).find((p) => p.professionalId === professionalId);
  return view ? brief(view.lines) : [];
}

interface World {
  paula: ProfessionalView;
  bruno: ProfessionalView;
  packageClass: ClassGroupView;
}

/**
 * Paula da a turma de mensalidade, o curso e a turma de pacote. Bruno substitui
 * a aula de 21/09 da turma de pacote. Pagos: a mensalidade de R$ 200, a 1a
 * parcela do curso (R$ 400, vence em setembro) e o pacote de 10 aulas (R$ 500).
 */
async function mixedWorld(): Promise<World> {
  const paula = await createInstructor("Paula");
  const bruno = await createInstructor("Bruno", paula.modalityIds?.[0]);
  const plan = await createPlan("monthly", 20000);
  const membershipClass = await classOf(paula, { name: "Mensal" });
  const course = await classOf(paula, {
    name: "Curso",
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 2,
    endDate: "2026-12-15",
  });
  const packageClass = await classOf(paula, { name: "Pacote", billingMode: "package" });

  const ana = await enrollStudent({ plan, name: "Ana", startDate: "2026-09-01", strategy: "full_cycle" });
  await turmasService.enroll({ classGroupId: membershipClass.id, studentId: ana.id });
  await payAll(chargesOf(ana.id, "membership"));

  const beto = await createStudent("Beto");
  await turmasService.enroll({
    classGroupId: course.id,
    studentId: beto.id,
    course: { priceCents: 80000, installments: 2, firstDueDate: "2026-09-10" },
  });
  await payAll(chargesOf(beto.id, "course").slice(0, 1));

  const caio = await createStudent("Caio");
  const pkg = await newPackage(10, 50000);
  await packagesService.sellPackage({
    studentId: caio.id,
    packageId: pkg.id,
    priceCents: 50000,
    installments: 1,
    firstDueDate: "2026-09-14",
  });
  await turmasService.enroll({ classGroupId: packageClass.id, studentId: caio.id });
  await turmasService.substituteInstructor(sessionOf(packageClass, "2026-09-21"), { instructorId: bruno.id });
  for (const date of ["2026-09-14", "2026-09-21"]) {
    await turmasService.markAttendance({ sessionId: sessionOf(packageClass, date), studentId: caio.id, status: "present" });
  }
  await payAll(chargesOf(caio.id, "package"));

  await teacherPayService.saveRule(paula.id, percentRule(30));
  await teacherPayService.saveRule(bruno.id, percentRule(30));
  return { paula, bruno, packageClass };
}

beforeEach(() => {
  slotHour = 6;
  resetAcademy();
});

describe("% do que os alunos pagaram: prévia com várias fontes", () => {
  it("mensalidade, parcela de curso e aula de pacote em linhas separadas; substituto recebe a aula dele", async () => {
    const { paula, bruno } = await mixedWorld();

    expect(await linesOf(paula.id)).toEqual([
      { source: "memberships", label: "30% de R$ 200,00 em mensalidades", amountCents: 6000 },
      { source: "courses", label: "30% de R$ 400,00 em cursos", amountCents: 12000 },
      { source: "packages", label: "30% de R$ 50,00 em pacotes (1 aula)", amountCents: 1500 },
    ]);
    expect(await linesOf(bruno.id)).toEqual([
      { source: "packages", label: "30% de R$ 50,00 em pacotes (1 aula)", amountCents: 1500 },
    ]);
    const view = (await teacherPayService.listPayouts("2026-09")).find((p) => p.professionalId === paula.id);
    expect(view?.totalCents).toBe(19500);
    expect(view?.ruleSummary).toBe("30% do que os alunos pagaram");
  });

  it("parcela de curso entra no mês de vencimento dela, quando paga", async () => {
    const { paula } = await mixedWorld();
    expect((await linesOf(paula.id, "2026-10")).find((l) => l.source === "courses")).toBeUndefined();
    const beto = store.clients.find((c) => c.name === "Beto")!;
    await payAll(chargesOf(beto.id, "course").slice(1));
    expect((await linesOf(paula.id, "2026-10")).find((l) => l.source === "courses")).toMatchObject({
      amountCents: 12000,
    });
  });

  it("pacote em aberto ou pago em parte não entra; pago por inteiro entra na prévia", async () => {
    const paula = await createInstructor("Paula");
    const g = await classOf(paula, { billingMode: "package" });
    const ana = await createStudent("Ana");
    const pkg = await newPackage(4, 40000);
    await packagesService.sellPackage({
      studentId: ana.id,
      packageId: pkg.id,
      priceCents: 40000,
      installments: 2,
      firstDueDate: "2026-09-14",
    });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id, status: "present" });
    await teacherPayService.saveRule(paula.id, percentRule(50));

    expect(await linesOf(paula.id)).toEqual([{ source: undefined, label: "50% de R$ 0,00", amountCents: 0 }]);
    const [first, second] = chargesOf(ana.id, "package");
    await payAll([first]);
    expect(await linesOf(paula.id)).toEqual([{ source: undefined, label: "50% de R$ 0,00", amountCents: 0 }]);
    await payAll([second]);
    expect(await linesOf(paula.id)).toEqual([
      { source: "packages", label: "50% de R$ 100,00 em pacotes (1 aula)", amountCents: 5000 },
    ]);
  });

  it("aula trazida na renovação vale o preço da aula do pacote de onde veio", async () => {
    const paula = await createInstructor("Paula");
    const g = await classOf(paula, { billingMode: "package" });
    const ana = await createStudent("Ana");
    // Renova o mesmo pacote com desconto: a 1a compra sai a R$ 50 a aula, a 2a a R$ 30.
    const pkg = await newPackage(10, 50000);
    const sale = (packageId: string, priceCents: number) =>
      packagesService.sellPackage({ studentId: ana.id, packageId, priceCents, installments: 1, firstDueDate: "2026-09-14" });

    await sale(pkg.id, 50000);
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id, status: "present" });
    const renewed = await sale(pkg.id, 30000);
    expect(store.studentPackages.find((p) => p.id === renewed.id)?.carriedFrom).toEqual([
      { fromPackageId: store.studentPackages[0].id, lessons: 9 },
    ]);
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-21"), studentId: ana.id, status: "present" });
    await teacherPayService.saveRule(paula.id, percentRule(100));

    // So o pacote novo pago: a aula de 21/09 veio do pacote antigo (em aberto) e nao entra.
    const [oldCharge, newCharge] = chargesOf(ana.id, "package");
    await payAll([newCharge]);
    expect(await linesOf(paula.id)).toEqual([{ source: undefined, label: "100% de R$ 0,00", amountCents: 0 }]);
    await payAll([oldCharge]);
    expect(await linesOf(paula.id)).toEqual([
      { source: "packages", label: "100% de R$ 100,00 em pacotes (2 aulas)", amountCents: 10000 },
    ]);
  });

  it("aula devolvida a um pacote renovado leva a origem para o pacote novo", async () => {
    const paula = await createInstructor("Paula");
    const g = await classOf(paula, { billingMode: "package" });
    const ana = await createStudent("Ana");
    const pkg = await newPackage(10, 50000);
    const first = await packagesService.sellPackage({
      studentId: ana.id, packageId: pkg.id, priceCents: 50000, installments: 1, firstDueDate: "2026-09-14",
    });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id, status: "present" });
    const renewed = await packagesService.sellPackage({
      studentId: ana.id, packageId: pkg.id, priceCents: 20000, installments: 1, firstDueDate: "2026-09-14",
    });
    await turmasService.clearAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id });
    expect(store.studentPackages.find((p) => p.id === renewed.id)).toMatchObject({
      lessonsTotal: 20,
      carriedOverLessons: 10,
      carriedFrom: [{ fromPackageId: first.id, lessons: 10 }],
    });
  });
});

describe("% do que os alunos pagaram: fechamento", () => {
  it("fechar congela as linhas por fonte; aula e pagamento depois não mudam; reabrir recalcula", async () => {
    const { paula, packageClass } = await mixedWorld();
    const closed = await teacherPayService.closePayout(paula.id, "2026-09");
    expect(closed).toMatchObject({ status: "closed", totalCents: 19500 });
    expect(closed.lines.map((l) => l.source)).toEqual(["memberships", "courses", "packages"]);

    // Depois do fechamento: Bruno devolve a aula para Paula e a 2a parcela do curso e paga.
    await turmasService.restorePrimaryInstructor(sessionOf(packageClass, "2026-09-21"));
    const beto = store.clients.find((c) => c.name === "Beto")!;
    await payAll(chargesOf(beto.id, "course").slice(1));
    const frozen = (await teacherPayService.listPayouts("2026-09")).find((p) => p.professionalId === paula.id);
    expect(frozen).toMatchObject({ status: "closed", totalCents: 19500 });

    await teacherPayService.reopenPayout(frozen!.payout!.id);
    expect((await linesOf(paula.id)).find((l) => l.source === "packages")).toEqual({
      source: "packages",
      label: "30% de R$ 100,00 em pacotes (2 aulas)",
      amountCents: 3000,
    });
  });
});
