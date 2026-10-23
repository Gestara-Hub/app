import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ClassGroupView, Client } from "@gestarahub/contracts";
import { createCategoryAction } from "@/services/catalog/categoriesActions";
import { createProfessionalAction } from "@/services/catalog/teamActions";
import type { ActionResult } from "@/services/server/action";
import { adminClient, createTestTenant, sessionClient, signInAs, signOut, type TestTenant } from "@/test/db";
import { recordAuditLogInDb } from "@/services/audit/auditLogBackend";
import { serviceAction } from "../serviceActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
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

const call = <T>(method: string, ...args: unknown[]) => unwrap(serviceAction(method, args) as Promise<ActionResult<T>>);

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function setup() {
  const modality = await unwrap(createCategoryAction({ name: "Muay Thai" }));
  const newTeacher = (name: string) =>
    unwrap(createProfessionalAction({ name, status: "active", workingHours: [], serviceIds: [], modalityIds: [modality.id] }));
  const teacher = await newTeacher("Prof Hugo");
  const other = await newTeacher("Prof Iara");
  const weekday = new Date(`${today()}T12:00:00`).getDay();
  const newGroup = (name: string, instructorId: string, start: string, capacity = 1) =>
    call<ClassGroupView>("turmas.create", {
      name,
      modalityId: modality.id,
      instructorId,
      capacity,
      allowDropin: true,
      sessionPriceCents: 5000,
      billingMode: "free",
      meetingSlots: [{ weekday, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` }],
      startDate: "2026-01-05",
      status: "active",
    });
  const newStudent = (name: string) => call<Client>("clients.create", { name, phone: "11966660000", status: "active" });
  return { teacher, other, newGroup, newStudent };
}

describe("regras no servidor (doc 15, fatia 3)", () => {
  it("duas matrículas ao mesmo tempo na última vaga: uma entra, a outra vê a turma lotada", async () => {
    const { teacher, newGroup, newStudent } = await setup();
    const group = await newGroup("Muay Thai 1", teacher.id, "07:00", 1);
    const [ana, bia] = await Promise.all([newStudent("Ana"), newStudent("Bia")]);
    const results = await Promise.all([
      serviceAction("turmas.enroll", [{ classGroupId: group.id, studentId: ana.id }]),
      serviceAction("turmas.enroll", [{ classGroupId: group.id, studentId: bia.id }]),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const refused = results.find((r) => !r.ok);
    expect(refused && !refused.ok && refused.error.code).toBe("CLASS_FULL");
    const { data } = await adminClient().from("enrollments").select("id").eq("class_group_id", group.id).eq("status", "active");
    expect(data).toHaveLength(1);
  });

  it("duas turmas no mesmo horário do professor ao mesmo tempo: só uma é criada", async () => {
    const { teacher, newGroup } = await setup();
    const results = await Promise.allSettled([
      newGroup("Turma A", teacher.id, "08:00", 5),
      newGroup("Turma B", teacher.id, "08:00", 5),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const { data } = await adminClient().from("class_groups").select("id").eq("instructor_id", teacher.id);
    expect(data).toHaveLength(1);
  });

  it("professor faz a chamada só nas próprias aulas", async () => {
    const { teacher, other, newGroup, newStudent } = await setup();
    const mine = await newGroup("Minha turma", teacher.id, "09:00", 5);
    const theirs = await newGroup("Turma da Iara", other.id, "10:00", 5);
    const ana = await newStudent("Ana");
    await call("turmas.enroll", { classGroupId: mine.id, studentId: ana.id });
    await call("turmas.enroll", { classGroupId: theirs.id, studentId: ana.id });

    const user = await tenant.addUser("professional");
    await adminClient().from("users").update({ professional_id: teacher.id }).eq("id", user.id).throwOnError();
    await signInAs(user);
    await call("turmas.markAttendance", { sessionId: `${mine.id}~${today()}~09:00`, studentId: ana.id, status: "present" });
    const denied = await serviceAction("turmas.markAttendance", [
      { sessionId: `${theirs.id}~${today()}~10:00`, studentId: ana.id, status: "present" },
    ]);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
    const { data } = await adminClient().from("attendances").select("session_id").eq("student_id", ana.id);
    expect(data?.map((a) => a.session_id)).toEqual([`${mine.id}~${today()}~09:00`]);
  });

  it("recepção marca aula avulsa e a cobrança da aula é gravada", async () => {
    const { teacher, newGroup, newStudent } = await setup();
    const group = await newGroup("Muay Thai 2", teacher.id, "11:00", 5);
    const visitor = await newStudent("Caio");
    await signInAs(await tenant.addUser("attendant"));
    const next = new Date(`${today()}T12:00:00`);
    next.setDate(next.getDate() + 7);
    const date = next.toLocaleDateString("en-CA");
    await call("turmas.reserveSession", {
      classGroupId: group.id,
      sessionId: `${group.id}~${date}~11:00`,
      studentId: visitor.id,
      kind: "dropin",
    });
    const { data } = await adminClient().from("charges").select("kind, amount_cents").eq("student_id", visitor.id);
    expect(data).toEqual([{ kind: "dropin", amount_cents: 5000 }]);
    // Recepcao nao da baixa (billing:manage).
    const { data: charge } = await adminClient().from("charges").select("id").eq("student_id", visitor.id).single();
    const denied = await serviceAction("billing.markPaid", [charge!.id, "pix"]);
    expect(denied.ok).toBe(false);
  });

  it("acesso direto do navegador segue o perfil; sem sessão não grava nada", async () => {
    const { newStudent } = await setup();
    await newStudent("Duda");

    await signInAs(await tenant.addUser("professional"));
    const asTeacher = sessionClient();
    expect((await asTeacher.from("clients").select("id")).data).toEqual([]);
    expect((await asTeacher.from("charges").select("id")).data).toEqual([]);
    expect((await asTeacher.from("audit_logs").select("id")).data).toEqual([]);
    const users = (await asTeacher.from("users").select("profile")).data ?? [];
    expect(users.map((u) => u.profile)).toEqual(["professional"]);

    await signInAs(await tenant.addUser("attendant"));
    expect((await sessionClient().from("clients").select("id")).data).toHaveLength(1);

    signOut();
    // O backend engole o erro (auditoria nunca derruba a operacao); o que vale e nao gravar.
    await (
      recordAuditLogInDb({
        id: crypto.randomUUID(),
        organizationId: tenant.organizationId,
        unitId: tenant.unitId,
        timestamp: new Date().toISOString(),
        actor: { userId: "x", name: "Falso", profile: "owner" },
        action: "created",
        target: { type: "client", label: "x" },
        summary: "Falso criou",
        security: false,
      })
    ).catch(() => undefined);
    const { data: logs } = await adminClient().from("audit_logs").select("summary").eq("summary", "Falso criou");
    expect(logs).toEqual([]);
  });
});

