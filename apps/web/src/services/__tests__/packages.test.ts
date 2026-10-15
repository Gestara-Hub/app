import type {
  Charge,
  ClassGroupView,
  CreateClassGroup,
  CreateLessonPackage,
  LessonPackage,
  SellPackage,
  StudentPackage,
} from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { financeService } from "@/services/financeService";
import { onlinePaymentsService } from "@/services/onlinePaymentsService";
import { packagesService } from "@/services/packagesService";
import { reportsService } from "@/services/reportsService";
import { subscriptionService } from "@/services/subscriptionService";
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
 * Pacote de aulas (doc 20, fase C): cadastro, venda com parcelas, renovacao
 * (regra 6), cancelamento da venda e o gasto de aula na chamada (regra 4).
 * Hoje congelado em 22/09/2026 (terca); as aulas de segunda caem em 14 e 21/09.
 */

/** Moeda formatada usa espaço não separável; os asserts usam espaço comum. */
const plain = (text: string) => text.replace(/ /g, " ");
const lastAudit = () => plain(store.auditLog.at(-1)?.summary ?? "");
const packageCharges = (studentId: string): Charge[] =>
  store.charges
    .filter((c) => c.kind === "package" && c.studentId === studentId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
const owned = (studentId: string): StudentPackage[] =>
  store.studentPackages.filter((p) => p.studentId === studentId);
const stored = (id: string): StudentPackage => store.studentPackages.find((p) => p.id === id)!;

let slotHour = 6;
/** Horario livre por turma (o mesmo professor nao da duas aulas juntas). */
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

function newPackage(over: Partial<CreateLessonPackage> = {}): Promise<LessonPackage> {
  return packagesService.createPackage({
    name: "10 aulas",
    lessons: 10,
    priceCents: 50000,
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
    ...over,
  });
}

function sell(over: Partial<SellPackage> & Pick<SellPackage, "studentId" | "packageId">) {
  return packagesService.sellPackage({
    priceCents: 50000,
    installments: 1,
    firstDueDate: "2026-09-22",
    ...over,
  });
}

async function teacherClass(over: Partial<CreateClassGroup> = {}): Promise<ClassGroupView> {
  const teacher = store.professionals[0] ?? (await createInstructor("Paula"));
  return turmasService.create({
    name: "Pilates manhã",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    meetingSlots: nextSlot(),
    startDate: "2026-09-01",
    billingMode: "package",
    status: "active",
    ...over,
  });
}

/** Aula de segunda da turma (21/09 por padrao). */
const sessionOf = (g: ClassGroupView, date = "2026-09-21") => sessionIdOf(g.id, date, g.meetingSlots[0].start);

/** Gasta `n` aulas direto no pacote (aulas ficticias), para montar saldo. */
function spend(pkgId: string, n: number) {
  const pkg = stored(pkgId);
  for (let i = 0; i < n; i++) {
    pkg.usages.push({ sessionId: `x~2026-09-0${(i % 9) + 1}~0${i}`, classGroupId: "x", date: "2026-09-01", reason: "present" });
  }
  pkg.lessonsUsed = pkg.usages.length;
}

async function rosterEntry(sessionId: string, studentId: string) {
  return (await turmasService.getSession(sessionId)).roster.find((r) => r.studentId === studentId);
}

beforeEach(() => {
  slotHour = 6;
  resetAcademy();
});

describe("pacote: cadastro", () => {
  it("valida nome, aulas de 1 a 200, valor e validade de 1 a 730 dias", async () => {
    await expect(
      newPackage({ name: " ", lessons: 0, priceCents: 0, validityDays: 731 }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [
        { field: "name", message: "Informe o nome do pacote." },
        { field: "lessons", message: "Informe de 1 a 200 aulas." },
        { field: "priceCents", message: "Informe um valor maior que zero." },
        { field: "validityDays", message: "A validade vai de 1 a 730 dias." },
      ],
    });
    await expect(newPackage({ lessons: 201 })).rejects.toMatchObject({ fields: [{ field: "lessons" }] });
    await expect(newPackage({ lessons: 2.5 })).rejects.toMatchObject({ fields: [{ field: "lessons" }] });
    expect(store.lessonPackages).toHaveLength(0);
  });

  it("cria, edita e inativa com auditoria; validade vazia é sem validade", async () => {
    const pkg = await newPackage({ name: "  8 aulas  ", lessons: 8, priceCents: 40000, validityDays: 0 });
    expect(pkg).toMatchObject({ name: "8 aulas", lessons: 8, absenceConsumes: true, status: "active" });
    expect(pkg.validityDays).toBeUndefined();
    expect(lastAudit()).toBe("Ana Ribeiro criou o pacote 8 aulas (8 aulas, R$ 400,00)");

    await packagesService.updatePackage(pkg.id, { priceCents: 42000, validityDays: 60 });
    expect(store.lessonPackages[0]).toMatchObject({ priceCents: 42000, validityDays: 60 });
    expect(lastAudit()).toBe("Ana Ribeiro atualizou o pacote 8 aulas");

    await packagesService.updatePackage(pkg.id, { status: "inactive" });
    expect(lastAudit()).toBe("Ana Ribeiro inativou o pacote 8 aulas");
    expect(await packagesService.listPackages({ status: "active" })).toEqual([]);
  });
});

describe("pacote: venda", () => {
  it("à vista: uma cobrança do pacote e o saldo com a validade", async () => {
    const pkg = await newPackage({ validityDays: 30 });
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });

    expect(sold).toMatchObject({
      studentId: ana.id,
      packageId: pkg.id,
      name: "10 aulas",
      lessonsTotal: 10,
      lessonsUsed: 0,
      purchasedAt: "2026-09-22",
      expiresAt: "2026-10-22",
      status: "active",
      remaining: 10,
      isExpired: false,
      daysToExpire: 30,
    });
    const [charge] = packageCharges(ana.id);
    expect(charge).toMatchObject({
      kind: "package",
      description: "10 aulas",
      studentPackageId: sold.id,
      amountCents: 50000,
      dueDate: "2026-09-22",
      competence: "2026-09",
      status: "pending",
    });
    expect(charge.cycleTotal).toBeUndefined();
    expect(charge.installmentGroupId).toBeUndefined();
    expect(sold.chargeIds).toEqual([charge.id]);
    expect(lastAudit()).toBe("Ana Ribeiro vendeu o pacote 10 aulas para Ana (R$ 500,00)");
  });

  it("valor ajustado na venda e parcelas mensais (resto na primeira)", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id, priceCents: 45001, installments: 3, firstDueDate: "2026-10-05" });

    const charges = packageCharges(ana.id);
    expect(charges.map((c) => `${c.dueDate} ${c.amountCents} ${c.cycleIndex}/${c.cycleTotal}`)).toEqual([
      "2026-10-05 15001 1/3",
      "2026-11-05 15000 2/3",
      "2026-12-05 15000 3/3",
    ]);
    expect(new Set(charges.map((c) => c.installmentGroupId)).size).toBe(1);
    expect(lastAudit()).toBe("Ana Ribeiro vendeu o pacote 10 aulas para Ana (R$ 450,01, em 3 parcelas)");

    await billingService.markPaid(charges[1].id, "pix");
    expect(lastAudit()).toBe(
      'Ana Ribeiro registrou o pagamento da parcela 2 de 3 do pacote "10 aulas" de Ana (R$ 150,00, vence 05/11/2026)',
    );
  });

  it("recusa aluno inativo, pacote inativo, valor zero e parcelas fora de 1 a 12", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await expect(sell({ studentId: ana.id, packageId: pkg.id, priceCents: 0, installments: 13 })).rejects.toMatchObject({
      fields: [
        { field: "priceCents", message: "Informe o valor." },
        { field: "installments", message: "Escolha de 1 a 12 parcelas." },
      ],
    });
    await expect(sell({ studentId: ana.id, packageId: pkg.id, priceCents: 2, installments: 3 })).rejects.toMatchObject({
      fields: [{ field: "installments", message: "Cada parcela precisa de pelo menos R$ 0,01." }],
    });
    await packagesService.updatePackage(pkg.id, { status: "inactive" });
    await expect(sell({ studentId: ana.id, packageId: pkg.id })).rejects.toMatchObject({
      fields: [{ field: "packageId" }],
    });
    await packagesService.updatePackage(pkg.id, { status: "active" });
    store.clients.find((c) => c.id === ana.id)!.status = "inactive";
    await expect(sell({ studentId: ana.id, packageId: pkg.id })).rejects.toMatchObject({
      fields: [{ field: "studentId" }],
    });
    expect(store.studentPackages).toHaveLength(0);
    expect(packageCharges(ana.id)).toHaveLength(0);
  });

  it("mudar o pacote do catálogo não mexe no que já foi vendido", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    await packagesService.updatePackage(pkg.id, { lessons: 20, absenceConsumes: false });
    expect(stored(sold.id)).toMatchObject({ lessonsTotal: 10, absenceConsumes: true });
  });
});

describe("pacote: renovação (regra 6)", () => {
  it("o saldo passa para o pacote novo, com a validade dele; o antigo fica Renovado", async () => {
    const pkg = await newPackage({ validityDays: 30 });
    const big = await newPackage({ name: "20 aulas", lessons: 20, validityDays: 90 });
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    spend(first.id, 7);

    const renewed = await sell({ studentId: ana.id, packageId: big.id });
    expect(renewed).toMatchObject({
      lessonsTotal: 23,
      carriedOverLessons: 3,
      renewedFromId: first.id,
      expiresAt: "2026-12-21",
      remaining: 23,
    });
    expect(stored(first.id)).toMatchObject({ status: "renewed", renewedIntoId: renewed.id, lessonsUsed: 7 });
    expect((await packagesService.listStudentPackages({ studentId: ana.id })).find((p) => p.id === first.id)?.remaining).toBe(0);
    expect(lastAudit()).toBe(
      "Ana Ribeiro vendeu o pacote 20 aulas para Ana (R$ 500,00), com 3 aulas trazidas do pacote anterior",
    );
  });

  it("modalidades diferentes: os dois continuam valendo", async () => {
    const pilates = await createInstructor("Paula");
    const yoga = await createInstructor("Yara");
    const a = await newPackage({ name: "Pilates", modalityIds: [pilates.modalityIds![0]] });
    const b = await newPackage({ name: "Yoga", modalityIds: [yoga.modalityIds![0]] });
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: a.id });
    const second = await sell({ studentId: ana.id, packageId: b.id });
    expect(second.lessonsTotal).toBe(10);
    expect(owned(ana.id).map((p) => p.status)).toEqual(["active", "active"]);
  });

  it("vencido perde o saldo e usado até o fim não tem o que levar", async () => {
    const pkg = await newPackage({ validityDays: 30 });
    const ana = await createStudent("Ana");
    const expired = await sell({ studentId: ana.id, packageId: pkg.id });
    Object.assign(stored(expired.id), { purchasedAt: "2026-08-01", expiresAt: "2026-08-31" });
    const usedUp = await sell({ studentId: ana.id, packageId: pkg.id });
    spend(usedUp.id, 10);
    const third = await sell({ studentId: ana.id, packageId: pkg.id });
    expect(third.lessonsTotal).toBe(10);
    expect(third.carriedOverLessons).toBeUndefined();
    expect(stored(expired.id).status).toBe("active");
    expect(stored(usedUp.id).status).toBe("active");
  });

  it("desmarcar uma aula do pacote renovado devolve a aula no pacote novo", async () => {
    const g = await teacherClass();
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(first.id).lessonsUsed).toBe(1);

    const renewed = await sell({ studentId: ana.id, packageId: pkg.id });
    expect(renewed.lessonsTotal).toBe(19);
    await turmasService.clearAttendance({ sessionId: sessionOf(g), studentId: ana.id });
    expect(stored(first.id).lessonsUsed).toBe(0);
    expect(stored(renewed.id)).toMatchObject({ lessonsTotal: 20, carriedOverLessons: 10 });
  });
});

describe("pacote: cancelar a venda", () => {
  it("sem aula usada: cancela as cobranças em aberto (e o Pix); as pagas ficam", async () => {
    await subscriptionService.setTier("pro");
    await onlinePaymentsService.updateSettings({ enabled: true });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id, installments: 2 });
    const [first, second] = packageCharges(ana.id);
    await billingService.markPaid(first.id, "cash");
    const pix = await onlinePaymentsService.createForCharge(second.id, "pix");

    const canceled = await packagesService.cancelStudentPackage(sold.id);
    expect(canceled).toMatchObject({ status: "canceled", remaining: 0 });
    expect(store.charges.find((c) => c.id === first.id)?.status).toBe("paid");
    expect(store.charges.find((c) => c.id === second.id)).toMatchObject({
      status: "canceled",
      canceledBy: "system",
      cancelReason: "Pacote cancelado",
    });
    expect(store.onlinePayments.find((p) => p.id === pix.id)?.status).toBe("canceled");
    expect(lastAudit()).toBe("Ana Ribeiro cancelou o pacote 10 aulas de Ana e 1 cobrança em aberto");
    await expect(packagesService.cancelStudentPackage(sold.id)).rejects.toMatchObject({
      message: "Este pacote já foi cancelado.",
    });
  });

  it("com aula usada é recusado", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    spend(sold.id, 1);
    await expect(packagesService.cancelStudentPackage(sold.id)).rejects.toMatchObject({
      httpStatus: 409,
      message: "O pacote já tem aulas usadas.",
    });
    expect(stored(sold.id).status).toBe("active");
  });

  it("cancelar a renovação devolve o saldo ao pacote anterior", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    spend(first.id, 4);
    const renewed = await sell({ studentId: ana.id, packageId: pkg.id });
    await expect(packagesService.cancelStudentPackage(first.id)).rejects.toMatchObject({ httpStatus: 409 });
    await packagesService.cancelStudentPackage(renewed.id);
    expect(stored(first.id)).toMatchObject({ status: "active", lessonsUsed: 4 });
    expect(stored(first.id).renewedIntoId).toBeUndefined();
  });
});

describe("pacote: vender de novo", () => {
  it("vender com um pacote em uso funciona: renova e traz o saldo inteiro", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    const second = await sell({ studentId: ana.id, packageId: pkg.id });
    expect(second).toMatchObject({ status: "active", lessonsTotal: 20, carriedOverLessons: 10, remaining: 20 });
    expect(stored(first.id)).toMatchObject({ status: "renewed", renewedIntoId: second.id });
    expect(packageCharges(ana.id)).toHaveLength(2);

    // E uma terceira venda em seguida, sobre a renovação.
    const third = await sell({ studentId: ana.id, packageId: pkg.id });
    expect(third).toMatchObject({ lessonsTotal: 30, carriedOverLessons: 20, renewedFromId: second.id });
    expect(owned(ana.id).map((p) => p.status).sort()).toEqual(["active", "renewed", "renewed"]);
  });

  it("depois de cancelar, vende outro pacote do zero", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    await packagesService.cancelStudentPackage(first.id);

    const again = await sell({ studentId: ana.id, packageId: pkg.id, priceCents: 45000 });
    expect(again).toMatchObject({ status: "active", lessonsTotal: 10, remaining: 10 });
    expect(again.carriedOverLessons).toBeUndefined();
    expect(again.renewedFromId).toBeUndefined();
    expect(stored(first.id).status).toBe("canceled");
    expect(packageCharges(ana.id).map((c) => [c.amountCents, c.status])).toEqual([
      [50000, "canceled"],
      [45000, "pending"],
    ]);
    const list = await packagesService.listStudentPackages({ studentId: ana.id });
    expect(list.map((p) => p.status).sort()).toEqual(["active", "canceled"]);
  });

  it("cancelar a renovação e vender outro: o anterior volta e o saldo dele vem de novo", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const first = await sell({ studentId: ana.id, packageId: pkg.id });
    spend(first.id, 3);
    const renewed = await sell({ studentId: ana.id, packageId: pkg.id });
    await packagesService.cancelStudentPackage(renewed.id);

    const again = await sell({ studentId: ana.id, packageId: pkg.id });
    expect(again).toMatchObject({ lessonsTotal: 17, carriedOverLessons: 7, renewedFromId: first.id });
    expect(stored(first.id)).toMatchObject({ status: "renewed", renewedIntoId: again.id });
  });
});

describe("pacote: a chamada gasta aula (regra 4)", () => {
  it("presença gasta uma; falta conforme o pacote; justificada devolve; idempotente", async () => {
    const g = await teacherClass();
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    const session = sessionOf(g);
    const mark = (status: "present" | "absent" | "justified") =>
      turmasService.markAttendance({ sessionId: session, studentId: ana.id, status });

    await mark("present");
    expect(stored(sold.id).usages).toEqual([
      { sessionId: session, classGroupId: g.id, date: "2026-09-21", reason: "present" },
    ]);
    await mark("present");
    expect(stored(sold.id).lessonsUsed).toBe(1);
    await mark("absent");
    expect(stored(sold.id).lessonsUsed).toBe(1);
    expect(stored(sold.id).usages[0].reason).toBe("absent");
    await mark("justified");
    expect(stored(sold.id).lessonsUsed).toBe(0);
    await mark("present");
    expect(stored(sold.id).lessonsUsed).toBe(1);
    await turmasService.clearAttendance({ sessionId: session, studentId: ana.id });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect(store.attendances.filter((a) => a.sessionId === session)).toHaveLength(0);
  });

  it("pacote que não gasta na falta: falta sem justificativa não gasta", async () => {
    const g = await teacherClass();
    const pkg = await newPackage({ absenceConsumes: false });
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "absent" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(1);
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "absent" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
  });

  it("turma de mensalidade não gasta o pacote do matriculado", async () => {
    const g = await teacherClass({ billingMode: "membership" });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect((await rosterEntry(sessionOf(g), ana.id))?.packageRemaining).toBeUndefined();
  });

  it("só pacote da modalidade da turma (ou de todas); sem pacote: nada gasto e o aviso", async () => {
    const g = await teacherClass();
    const yoga = await createInstructor("Yara");
    const other = await newPackage({ name: "Yoga", modalityIds: [yoga.modalityIds![0]] });
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: other.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect(await rosterEntry(sessionOf(g), ana.id)).toMatchObject({ kind: "enrolled", noPackage: true });

    const beto = await createStudent("Beto");
    await turmasService.enroll({ classGroupId: g.id, studentId: beto.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: beto.id, status: "present" });
    expect(await rosterEntry(sessionOf(g), beto.id)).toMatchObject({ noPackage: true });
  });

  it("usa o pacote que vence primeiro", async () => {
    const g = await teacherClass();
    const pkg = await newPackage({ name: "Sem validade" });
    const ana = await createStudent("Ana");
    const open = await sell({ studentId: ana.id, packageId: pkg.id });
    // Segundo pacote valido ao mesmo tempo (comprar outro renovaria o primeiro).
    store.studentPackages.push({
      ...structuredClone(stored(open.id)),
      id: "pkg-mensal",
      name: "Mensal",
      expiresAt: "2026-10-15",
      chargeIds: [],
    });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored("pkg-mensal").lessonsUsed).toBe(1);
    expect(stored(open.id).lessonsUsed).toBe(0);
  });

  it("pacote vencido na data da aula não é usado", async () => {
    const g = await teacherClass();
    const pkg = await newPackage({ validityDays: 30 });
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    Object.assign(stored(sold.id), { purchasedAt: "2026-08-20", expiresAt: "2026-09-19" });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect(await rosterEntry(sessionOf(g), ana.id)).toMatchObject({ noPackage: true });
    // Chamada atrasada de uma aula de quando ainda valia: gasta.
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(1);
  });

  it("saldo na chamada: 'N de M', última aula e sem saldo", async () => {
    const g = await teacherClass();
    const pkg = await newPackage({ lessons: 2 });
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id });
    const enrollment = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    // Matriculada desde o comeco do mes: aparece nas chamadas de 14 e 21/09.
    store.enrollments.find((e) => e.id === enrollment.id)!.enrolledAt = "2026-09-01T12:00:00.000Z";
    const s14 = sessionOf(g, "2026-09-14");
    const s21 = sessionOf(g, "2026-09-21");

    expect(await rosterEntry(s14, ana.id)).toMatchObject({ packageRemaining: 2, packageTotal: 2, packageLastLesson: false });
    await turmasService.markAttendance({ sessionId: s14, studentId: ana.id, status: "present" });
    expect(await rosterEntry(s14, ana.id)).toMatchObject({ packageRemaining: 1, packageLastLesson: false });
    expect(await rosterEntry(s21, ana.id)).toMatchObject({ packageRemaining: 1, packageLastLesson: true });
    await turmasService.markAttendance({ sessionId: s21, studentId: ana.id, status: "present" });
    expect(await rosterEntry(s21, ana.id)).toMatchObject({ packageRemaining: 0, packageLastLesson: true });
    const s28 = sessionOf(g, "2026-09-28");
    expect(await rosterEntry(s28, ana.id)).toMatchObject({ noPackage: true });
    const [view] = await packagesService.listStudentPackages({ studentId: ana.id });
    expect(view).toMatchObject({ remaining: 0, isUsedUp: true });
  });
});

describe("pacote: aluno entra na aula pelo pacote", () => {
  it("em qualquer turma da modalidade, sem cobrança; gasta na chamada e devolve ao sair", async () => {
    const g = await teacherClass({ billingMode: "membership", allowDropin: false });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    const session = sessionOf(g);

    const detail = await turmasService.getSession(session);
    expect(detail.packageCandidates).toEqual([{ studentId: ana.id, studentName: "Ana", remaining: 10 }]);

    const chargesBefore = store.charges.length;
    await turmasService.reserveSession({ classGroupId: g.id, sessionId: session, studentId: ana.id, kind: "package" });
    expect(store.charges).toHaveLength(chargesBefore);
    expect(lastAudit()).toBe("Ana Ribeiro inscreveu Ana na aula de 21/09/2026 da turma Pilates manhã (usa 1 aula do pacote)");
    expect(await rosterEntry(session, ana.id)).toMatchObject({ kind: "package", packageRemaining: 10, packageTotal: 10 });
    expect((await turmasService.getSession(session)).packageCandidates).toEqual([]);

    await turmasService.markAttendance({ sessionId: session, studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(1);
    await turmasService.cancelReservation({ sessionId: session, studentId: ana.id });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect(lastAudit()).toBe("Ana Ribeiro removeu Ana da aula e devolveu a aula do pacote");
  });

  it("sem pacote válido para a modalidade é recusado", async () => {
    const g = await teacherClass({ billingMode: "membership" });
    const yoga = await createInstructor("Yara");
    const other = await newPackage({ modalityIds: [yoga.modalityIds![0]] });
    const ana = await createStudent("Ana");
    await expect(
      turmasService.reserveSession({ classGroupId: g.id, sessionId: sessionOf(g), studentId: ana.id, kind: "package" }),
    ).rejects.toMatchObject({ message: "Ana não tem pacote com aulas para esta modalidade." });
    await sell({ studentId: ana.id, packageId: other.id });
    await expect(
      turmasService.reserveSession({ classGroupId: g.id, sessionId: sessionOf(g), studentId: ana.id, kind: "package" }),
    ).rejects.toMatchObject({ httpStatus: 422 });
    expect((await turmasService.getSession(sessionOf(g))).packageCandidates).toEqual([]);
  });

  it("avulso numa turma de pacote paga a aula avulsa e não gasta o pacote", async () => {
    const g = await teacherClass({ allowDropin: true, sessionPriceCents: 4000 });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.reserveSession({ classGroupId: g.id, sessionId: sessionOf(g), studentId: ana.id, kind: "dropin" });
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(0);
    expect(store.charges.filter((c) => c.kind === "dropin" && c.studentId === ana.id)).toHaveLength(1);
  });
});

describe("pacote: aluno de pacote em turma de mensalidade", () => {
  const membershipClass = () => teacherClass({ billingMode: "membership" });

  it("matrícula paga com pacote gasta na chamada e mostra o saldo", async () => {
    const g = await membershipClass();
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    const e = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id, paysWithPackage: true });
    expect(e.paysWithPackage).toBe(true);
    expect(lastAudit()).toBe("Ana Ribeiro matriculou Ana na turma Pilates manhã (paga com pacote)");

    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(1);
    expect(await rosterEntry(sessionOf(g), ana.id)).toMatchObject({
      kind: "enrolled",
      packageRemaining: 9,
      packageTotal: 10,
    });
  });

  it("recusa sem pacote válido; nas outras formas de cobrança a escolha é ignorada", async () => {
    const g = await membershipClass();
    const ana = await createStudent("Ana");
    await expect(
      turmasService.enroll({ classGroupId: g.id, studentId: ana.id, paysWithPackage: true }),
    ).rejects.toMatchObject({
      fields: [{ field: "paysWithPackage", message: "Ana não tem pacote com aulas para esta modalidade." }],
    });
    expect(store.enrollments).toHaveLength(0);

    const free = await teacherClass({ billingMode: "free" });
    const e = await turmasService.enroll({ classGroupId: free.id, studentId: ana.id, paysWithPackage: true });
    expect(e.paysWithPackage).toBeUndefined();
  });

  it("trocar como paga: com pacote e de volta para a mensalidade", async () => {
    const g = await membershipClass();
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const sold = await sell({ studentId: ana.id, packageId: pkg.id });
    const e = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await turmasService.markAttendance({ sessionId: sessionOf(g, "2026-09-14"), studentId: ana.id, status: "present" });
    expect(stored(sold.id).lessonsUsed).toBe(0);

    await turmasService.setEnrollmentPayment(e.id, true);
    expect(lastAudit()).toBe("Ana Ribeiro passou Ana a pagar a turma Pilates manhã com pacote");
    await turmasService.markAttendance({ sessionId: sessionOf(g), studentId: ana.id, status: "present" });
    // A aula de 14/09 (antes da troca) continua sem gastar.
    expect(stored(sold.id).lessonsUsed).toBe(1);

    const back = await turmasService.setEnrollmentPayment(e.id, false);
    expect(back.paysWithPackage).toBeUndefined();
    expect(lastAudit()).toBe("Ana Ribeiro passou Ana a pagar a turma Pilates manhã com mensalidade");
  });

  it("trocar é recusado fora da turma de mensalidade e sem pacote", async () => {
    const ana = await createStudent("Ana");
    const g = await membershipClass();
    const e = await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    await expect(turmasService.setEnrollmentPayment(e.id, true)).rejects.toMatchObject({
      fields: [{ field: "paysWithPackage" }],
    });

    const pkgClass = await teacherClass();
    const e2 = await turmasService.enroll({ classGroupId: pkgClass.id, studentId: ana.id });
    await expect(turmasService.setEnrollmentPayment(e2.id, true)).rejects.toMatchObject({
      message: "Só a turma de mensalidade permite escolher como o aluno paga.",
    });
  });

  it("quem paga com pacote não gera mensalidade pelo plano legado da turma", async () => {
    const plan = await createPlan("monthly", 15000);
    const g = await teacherClass({ billingMode: "membership", planId: plan.id });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id, paysWithPackage: true });
    await billingService.listCharges({ competence: "2026-09" });
    expect(store.charges.filter((c) => c.studentId === ana.id).map((c) => c.kind)).toEqual(["package"]);
  });

  it("da lista de espera: sem plano e com pacote, entra pagando com pacote", async () => {
    const g = await teacherClass({ billingMode: "membership", capacity: 1 });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    await sell({ studentId: beto.id, packageId: pkg.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    const w = await turmasService.addToWaitlist({ classGroupId: g.id, studentId: beto.id });
    const promoted = await turmasService.promoteFromWaitlist(w.id);
    expect(promoted.paysWithPackage).toBe(true);
  });
});

describe("pacote: turma de pacote", () => {
  it("não pede plano nem valor e nunca gera mensalidade (nem com plano legado)", async () => {
    const plan = await createPlan("monthly", 15000);
    const g = await teacherClass({ planId: plan.id, coursePriceCents: 1000, courseMaxInstallments: 2 });
    expect(g).toMatchObject({ billingMode: "package" });
    expect(g.planId).toBeUndefined();
    expect(g.coursePriceCents).toBeUndefined();

    const ana = await createStudent("Ana");
    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    store.classGroups.find((x) => x.id === g.id)!.planId = plan.id; // dado legado
    await billingService.listCharges({ competence: "2026-09" });
    expect(store.charges.filter((c) => c.studentId === ana.id)).toEqual([]);
  });
});

describe("pacote: cobranças, financeiro e professores", () => {
  it("pagar, desfazer, cancelar e reabrir como as avulsas; filtro por tipo", async () => {
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id });
    const [charge] = packageCharges(ana.id);

    await billingService.markPaid(charge.id, "pix");
    expect(lastAudit()).toBe(
      'Ana Ribeiro registrou o pagamento da compra do pacote "10 aulas" de Ana (R$ 500,00, vence 22/09/2026)',
    );
    await billingService.markPending(charge.id);
    await billingService.cancelCharge(charge.id, "Lançada por engano");
    expect(store.charges.find((c) => c.id === charge.id)).toMatchObject({ status: "canceled", canceledBy: "user" });
    await billingService.reopenCharge(charge.id);
    expect(store.charges.find((c) => c.id === charge.id)?.status).toBe("pending");

    const list = await billingService.listCharges({ competence: "2026-09", kind: "package" });
    expect(list.map((c) => `${c.studentName} ${c.description}`)).toEqual(["Ana 10 aulas"]);
  });

  it("pagamento online (Pro) vale para a cobrança do pacote", async () => {
    await subscriptionService.setTier("pro");
    await onlinePaymentsService.updateSettings({ enabled: true });
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id, installments: 2 });
    const [first] = packageCharges(ana.id);
    const pix = await onlinePaymentsService.createForCharge(first.id, "pix");
    expect(pix).toMatchObject({ status: "awaiting", amountCents: 25000 });
    expect(lastAudit()).toBe(
      'Ana Ribeiro gerou a cobrança online por Pix da parcela 1 de 2 do pacote "10 aulas" de Ana (R$ 250,00)',
    );
    await onlinePaymentsService.simulatePaid(pix.id);
    expect(store.charges.find((c) => c.id === first.id)).toMatchObject({ status: "paid", paidVia: "online" });
  });

  it("categoria de sistema Pacotes de aulas, linha agregada, resumo e resultado do mês", async () => {
    await subscriptionService.setTier("pro");
    const pkg = await newPackage();
    const ana = await createStudent("Ana");
    await sell({ studentId: ana.id, packageId: pkg.id, installments: 2, firstDueDate: "2026-09-10" });
    const [first] = packageCharges(ana.id);
    await billingService.markPaid(first.id, "pix");

    const category = store.financialCategories.find((c) => c.systemKey === "packages");
    expect(category).toMatchObject({ name: "Pacotes de aulas", type: "income", system: true });
    const rows = await financeService.listEntries({ competence: "2026-09" });
    expect(rows.find((r) => r.id === "charges:package:2026-09")).toMatchObject({
      source: "charge",
      categoryId: category!.id,
      categoryName: "Pacotes de aulas",
      amountCents: 25000,
      chargeCounts: { paid: 1, pending: 0, overdue: 0 },
    });
    expect((await financeService.getSummary("2026-09")).incomePaidCents).toBe(25000);

    const report = await reportsService.generateReport("financial_income_statement", { competence: "2026-09" });
    if (report.type !== "financial_income_statement") throw new Error("relatorio errado");
    expect(report.data.incomeCategories).toEqual([{ name: "Pacotes de aulas", amountCents: 25000, percent: 100 }]);
  });

  it("o % do professor não conta pacote vendido sem aula usada", async () => {
    const teacher = await createInstructor("Paula");
    const plan = await createPlan("monthly", 20000);
    const student = await enrollStudent({ plan, name: "Edu", startDate: "2026-09-01", strategy: "full_cycle" });
    const g = await teacherClass({ instructorId: teacher.id, modalityId: teacher.modalityIds?.[0], billingMode: "membership", planId: plan.id });
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    const pkg = await newPackage();
    await sell({ studentId: student.id, packageId: pkg.id, firstDueDate: "2026-09-01" });
    for (const c of store.charges) await billingService.markPaid(c.id, "pix");
    await teacherPayService.saveRule(teacher.id, {
      components: [{ kind: "percent_of_memberships", percent: 40 }],
      startCompetence: "2026-09",
    });
    const payout = (await teacherPayService.listPayouts("2026-09")).find((p) => p.professionalId === teacher.id);
    expect(payout?.lines).toMatchObject([{ kind: "percent_of_memberships", baseCents: 20000, amountCents: 8000 }]);
  });
});
