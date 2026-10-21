import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  Charge,
  ClassGroupView,
  Client,
  TeacherPayout,
  TeacherPayoutView,
  WaitlistEntryView,
} from "@gestarahub/contracts";
import { defaultCertificateTemplate } from "@gestarahub/core/certificate";
import type { ActionResult } from "@/services/server/action";
import { createCategoryAction } from "@/services/catalog/categoriesActions";
import { createProfessionalAction } from "@/services/catalog/teamActions";
import { createPlanAction } from "@/services/billing/catalogActions";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { serviceAction } from "../serviceActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant({
    settings: { defaultDueDay: 10, billingTiming: "prepaid", midMonthStrategy: "full_cycle" },
    subscription: { tier: "pro" },
  });
  // Unidade aberta todos os dias (a turma confere o horario de funcionamento).
  await adminClient()
    .from("units")
    .update({
      business_hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        closed: false,
        start: "06:00",
        end: "22:00",
        shifts: [{ start: "06:00", end: "22:00" }],
      })),
    })
    .eq("id", tenant.unitId)
    .throwOnError();
});

afterEach(async () => {
  await tenant.remove();
});

async function unwrap<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const result = await serviceAction(method, args);
  if (!result.ok) throw new Error(`${method}: ${JSON.stringify(result.error)}`);
  return result.data as T;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

describe("mais fluxos de turmas no servidor (doc 15, fatia 2)", () => {
  it("lista de espera, avulsa, substituição, curso, repasse, certificado, relatório e troca de plano", async () => {
    const admin = adminClient();
    const modality = await unwrap(createCategoryAction({ name: "Judô" }));
    const newTeacher = (name: string) =>
      unwrap(
        createProfessionalAction({ name, status: "active", workingHours: [], serviceIds: [], modalityIds: [modality.id] }),
      );
    const teacher = await newTeacher("Prof Caio");
    const substitute = await newTeacher("Prof Dani");
    const planA = await unwrap(createPlanAction({ name: "Plano A", priceCents: 20000, period: "monthly", status: "active" }));
    const planB = await unwrap(createPlanAction({ name: "Plano B", priceCents: 25000, period: "monthly", status: "active" }));
    const weekday = new Date(`${today()}T12:00:00`).getDay();
    const nextWeek = addDays(today(), 7);

    const group = await call<ClassGroupView>("turmas.create", {
      name: "Judô kids",
      modalityId: modality.id,
      instructorId: teacher.id,
      capacity: 1,
      allowDropin: true,
      sessionPriceCents: 4000,
      planId: planA.id,
      billingMode: "membership",
      meetingSlots: [{ weekday, start: "18:00", end: "19:00" }],
      startDate: "2026-01-05",
      status: "active",
    });
    const newStudent = (name: string, planId?: string) =>
      call<Client>("clients.create", {
        name,
        phone: "11977772222",
        status: "active",
        membershipStatus: "active",
        ...(planId ? { planId, planStartDate: `${today().slice(0, 7)}-01` } : {}),
      });
    const first = await newStudent("Edu", planA.id);
    const second = await newStudent("Fabi");
    await call("turmas.enroll", { classGroupId: group.id, studentId: first.id });

    // Turma cheia: o segundo vai para a lista de espera e depois e promovido.
    const waiting = await call<WaitlistEntryView>("turmas.addToWaitlist", { classGroupId: group.id, studentId: second.id });
    await call("turmas.update", group.id, { capacity: 2 });
    await call("turmas.promoteFromWaitlist", waiting.id);
    const { data: enrolled } = await admin.from("enrollments").select("student_id").eq("class_group_id", group.id);
    expect(enrolled).toHaveLength(2);

    // Aula avulsa na semana que vem gera a cobranca da aula.
    const visitor = await newStudent("Gabi");
    const sessionId = `${group.id}~${nextWeek}~18:00`;
    await call("turmas.reserveSession", { classGroupId: group.id, sessionId, studentId: visitor.id, kind: "dropin" });
    const { data: dropin } = await admin.from("charges").select("kind, amount_cents").eq("student_id", visitor.id);
    expect(dropin).toEqual([{ kind: "dropin", amount_cents: 4000 }]);

    // Substituto na aula.
    await call("turmas.substituteInstructor", sessionId, { instructorId: substitute.id, reason: "Viagem" });
    const { data: override } = await admin
      .from("class_session_overrides")
      .select("instructor_id")
      .eq("session_id", sessionId)
      .single();
    expect(override?.instructor_id).toBe(substitute.id);

    // Curso parcelado.
    const course = await call<ClassGroupView>("turmas.create", {
      name: "Curso de arbitragem",
      modalityId: modality.id,
      instructorId: teacher.id,
      capacity: 10,
      allowDropin: false,
      billingMode: "course",
      coursePriceCents: 80000,
      courseMaxInstallments: 4,
      meetingSlots: [{ weekday, start: "20:00", end: "21:00" }],
      startDate: today(),
      endDate: addDays(today(), 60),
      status: "active",
    });
    await call("turmas.enroll", {
      classGroupId: course.id,
      studentId: second.id,
      course: { priceCents: 80000, installments: 4, firstDueDate: addDays(today(), 5) },
    });
    const { data: installments } = await admin.from("charges").select("id").eq("student_id", second.id).eq("kind", "course");
    expect(installments).toHaveLength(4);

    // Repasse do professor: regra, previa, fechamento e pagamento.
    const competence = today().slice(0, 7);
    await call("teacherPay.saveRule", teacher.id, {
      components: [{ kind: "per_student", amountCents: 1000 }],
      startCompetence: competence,
    });
    await call("teacherPay.getPayoutPreview", teacher.id, competence);
    const closed = await call<TeacherPayoutView>("teacherPay.closePayout", teacher.id, competence);
    await call<TeacherPayout>("teacherPay.markPayoutPaid", closed.payout!.id, "pix");
    const { data: payout } = await admin.from("teacher_payouts").select("status").eq("id", closed.payout!.id).single();
    expect(payout?.status).toBe("paid");

    // Modelo do certificado vai para a coluna da organizacao.
    const template = { ...defaultCertificateTemplate(), title: "Certificado de judô" };
    delete (template as { updatedAt?: string }).updatedAt;
    await call("certificates.saveTemplate", template);
    const { data: org } = await admin.from("organizations").select("certificate_template").eq("id", tenant.organizationId).single();
    expect((org?.certificate_template as { title: string }).title).toBe("Certificado de judô");
    await call("certificates.resetTemplate");
    const { data: reset } = await admin.from("organizations").select("certificate_template").eq("id", tenant.organizationId).single();
    expect(reset?.certificate_template).toBeNull();

    // Relatorio le o mesmo banco.
    const report = await call<{ rows?: unknown[] }>("reports.generateReport", "students_roster", {});
    expect(report).toBeTruthy();

    // Troca de plano: a mensalidade em aberto do plano antigo e substituida.
    await call("billing.listCharges", { competence });
    await call("clients.update", first.id, { planId: planB.id, planStartDate: `${competence}-01` });
    const { data: memberships } = await admin
      .from("charges")
      .select("plan_id, status")
      .eq("student_id", first.id)
      .eq("kind", "membership");
    expect(memberships?.filter((c) => c.plan_id === planA.id && c.status !== "canceled")).toEqual([]);
    const after = await call<Charge[]>("billing.listCharges", { competence });
    expect(after.some((c) => c.studentId === first.id && c.planId === planB.id)).toBe(true);
  });
});
