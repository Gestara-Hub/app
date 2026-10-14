import type {
  Charge,
  ClassGroupView,
  CourseReportData,
  CreateClassGroup,
  PackageReportData,
} from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { packagesService } from "@/services/packagesService";
import { reportsService } from "@/services/reportsService";
import { turmasService } from "@/services/turmasService";
import { createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Relatorios "Cursos" e "Pacotes de aulas" (doc 20, fase D): mesmo plano e
 * permissao do extrato de cobrancas, filtro pelo mes, so dados reais.
 * Hoje congelado em 22/09/2026 (terca).
 */

let slotHour = 6;
const nextSlot = () => {
  const start = `${String(slotHour).padStart(2, "0")}:00`;
  const end = `${String(slotHour + 1).padStart(2, "0")}:00`;
  slotHour += 1;
  return [{ weekday: 1 as const, start, end }];
};

async function classWith(over: Partial<CreateClassGroup>): Promise<ClassGroupView> {
  const teacher = store.professionals[0] ?? (await createInstructor("Chef"));
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

const courseClass = (over: Partial<CreateClassGroup> = {}) =>
  classWith({
    name: "Confeitaria",
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 4,
    endDate: "2026-12-15",
    ...over,
  });

const chargesOf = (studentId: string, kind: Charge["kind"]): Charge[] =>
  store.charges
    .filter((c) => c.studentId === studentId && c.kind === kind)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

async function courseReport(competence: string): Promise<CourseReportData> {
  const report = await reportsService.generateReport("course_summary", { competence });
  if (report.type !== "course_summary") throw new Error("relatorio errado");
  return report.data;
}

async function packageReport(competence: string): Promise<PackageReportData> {
  const report = await reportsService.generateReport("package_summary", { competence });
  if (report.type !== "package_summary") throw new Error("relatorio errado");
  return report.data;
}

beforeEach(() => {
  slotHour = 6;
  resetAcademy();
});

describe("catálogo", () => {
  it("Cursos e Pacotes de aulas ficam no mesmo plano do extrato de cobranças", async () => {
    const catalog = await reportsService.getCatalog();
    const statement = catalog.find((r) => r.type === "billing_statement")!;
    for (const type of ["course_summary", "package_summary"] as const) {
      expect(catalog.find((r) => r.type === type)).toMatchObject({
        tierRequired: statement.tierRequired,
        category: statement.category,
      });
    }
  });
});

describe("relatório de cursos", () => {
  it("sem curso: lista vazia e totais zerados", async () => {
    await classWith({ name: "Mensal" });
    expect(await courseReport("2026-09")).toMatchObject({
      totalContractedCents: 0,
      totalReceivedCents: 0,
      totalOpenCents: 0,
      receivedInPeriodCents: 0,
      rows: [],
    });
  });

  it("por curso: matriculados, concluídos, cancelados, contratado, recebido e em aberto", async () => {
    const g = await courseClass();
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    const caio = await createStudent("Caio");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: ana.id,
      course: { priceCents: 80000, installments: 2, firstDueDate: "2026-09-10" },
    });
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: beto.id,
      course: { priceCents: 60000, installments: 1, firstDueDate: "2026-09-15" },
    });
    const caioEnrollment = await turmasService.enroll({
      classGroupId: g.id,
      studentId: caio.id,
      course: { priceCents: 80000, installments: 4, firstDueDate: "2026-09-20" },
    });
    await billingService.markPaid(chargesOf(ana.id, "course")[0].id, "pix");
    await billingService.markPaid(chargesOf(beto.id, "course")[0].id, "cash");
    // Caio sai: a parcela de 20/09 (vencida) fica, as futuras saem.
    await turmasService.cancelEnrollment(caioEnrollment.id);

    const data = await courseReport("2026-09");
    expect(data.rows).toEqual([
      {
        classGroupId: g.id,
        className: "Confeitaria",
        teacherName: "Chef",
        startDate: "2026-09-01",
        endDate: "2026-12-15",
        enrolled: 2,
        completed: 0,
        canceled: 1,
        contractedCents: 80000 + 60000 + 20000,
        receivedCents: 40000 + 60000,
        openCents: 40000 + 20000,
      },
    ]);
    expect(data).toMatchObject({
      totalContractedCents: 160000,
      totalReceivedCents: 100000,
      totalOpenCents: 60000,
      receivedInPeriodCents: 100000,
    });
    // Fora do mes do curso e sem parcela nele, o curso nao aparece.
    expect((await courseReport("2026-08")).rows).toEqual([]);
  });

  it("curso terminado conta os ativos como concluídos e aparece no mês da parcela", async () => {
    const g = await courseClass({ endDate: "2026-12-15" });
    const ana = await createStudent("Ana");
    await turmasService.enroll({
      classGroupId: g.id,
      studentId: ana.id,
      course: { priceCents: 80000, installments: 4, firstDueDate: "2026-09-10" },
    });
    Object.assign(store.classGroups.find((x) => x.id === g.id)!, { endDate: "2026-09-15" });

    expect((await courseReport("2026-09")).rows[0]).toMatchObject({ enrolled: 1, completed: 1, canceled: 0 });
    // Outubro: o curso ja acabou, mas a 2a parcela vence no mes.
    expect((await courseReport("2026-10")).rows).toHaveLength(1);
  });
});

describe("relatório de pacotes de aulas", () => {
  async function newPackage(name: string, lessons: number, priceCents: number) {
    return packagesService.createPackage({
      name,
      lessons,
      priceCents,
      modalityIds: [],
      absenceConsumes: true,
      status: "active",
    });
  }

  it("sem pacote vendido: lista vazia e totais zerados", async () => {
    await newPackage("10 aulas", 10, 50000);
    expect(await packageReport("2026-09")).toEqual(
      expect.objectContaining({
        totalSold: 0,
        totalLessonsUsed: 0,
        totalLessonsRemaining: 0,
        totalReceivedCents: 0,
        rows: [],
      }),
    );
  });

  it("por pacote: vendidos, aulas vendidas e usadas no mês, saldo de hoje e recebido no mês", async () => {
    const ten = await newPackage("10 aulas", 10, 50000);
    const four = await newPackage("4 aulas", 4, 20000);
    const g = await classWith({ name: "Pilates", billingMode: "package" });
    const ana = await createStudent("Ana");
    const beto = await createStudent("Beto");
    const caio = await createStudent("Caio");

    await packagesService.sellPackage({ studentId: ana.id, packageId: ten.id, priceCents: 50000, installments: 2, firstDueDate: "2026-09-14" });
    await packagesService.sellPackage({ studentId: beto.id, packageId: ten.id, priceCents: 45000, installments: 1, firstDueDate: "2026-09-14" });
    const canceled = await packagesService.sellPackage({ studentId: caio.id, packageId: four.id, priceCents: 20000, installments: 1, firstDueDate: "2026-09-14" });
    await packagesService.cancelStudentPackage(canceled.id);

    await turmasService.enroll({ classGroupId: g.id, studentId: ana.id });
    for (const date of ["2026-09-14", "2026-09-21"]) {
      await turmasService.markAttendance({
        sessionId: sessionIdOf(g.id, date, g.meetingSlots[0].start),
        studentId: ana.id,
        status: "present",
      });
    }
    await billingService.markPaid(chargesOf(ana.id, "package")[0].id, "pix");
    await billingService.markPaid(chargesOf(beto.id, "package")[0].id, "cash");

    const data = await packageReport("2026-09");
    expect(data.rows).toEqual([
      {
        packageId: ten.id,
        packageName: "10 aulas",
        sold: 2,
        lessonsSold: 20,
        lessonsUsed: 2,
        lessonsRemaining: 18,
        receivedCents: 25000 + 45000,
      },
    ]);
    expect(data).toMatchObject({ totalSold: 2, totalLessonsUsed: 2, totalLessonsRemaining: 18, totalReceivedCents: 70000 });

    // Outubro: nada vendido nem usado, mas o saldo de hoje continua aparecendo.
    expect((await packageReport("2026-10")).rows).toEqual([
      expect.objectContaining({ sold: 0, lessonsSold: 0, lessonsUsed: 0, lessonsRemaining: 18, receivedCents: 0 }),
    ]);
  });

  it("aulas trazidas na renovação não contam como vendidas de novo", async () => {
    const ten = await newPackage("10 aulas", 10, 50000);
    const ana = await createStudent("Ana");
    const sale = () =>
      packagesService.sellPackage({ studentId: ana.id, packageId: ten.id, priceCents: 50000, installments: 1, firstDueDate: "2026-09-14" });
    await sale();
    await sale(); // leva as 10 do primeiro: 20 de saldo
    expect((await packageReport("2026-09")).rows[0]).toMatchObject({ sold: 2, lessonsSold: 20, lessonsRemaining: 20 });
  });
});
