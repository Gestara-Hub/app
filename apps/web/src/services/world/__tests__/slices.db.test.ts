import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import type { TenantContext } from "@/services/server/tenant";
import { turmasServiceImpl } from "@/services/classes";
import { classSlices } from "@/services/classes/classSlices";
import { forgetCachedWorld, runInWorld } from "../runWorld";
import { store } from "../store";
import { canonical } from "../tables";

/**
 * Recorte no servidor (doc 19, fase 2): a aula e a chamada carregam do banco
 * so o recorte do metodo. O resultado e as gravacoes sao os mesmos do espaco
 * inteiro.
 */

let tenant: TestTenant;
let ctx: TenantContext;
let sessionId: string;
const students: string[] = [];

beforeEach(async () => {
  tenant = await createTestTenant();
  ctx = {
    client: adminClient(),
    organizationId: tenant.organizationId,
    userId: tenant.owner.id,
    profile: "owner",
    require: () => undefined,
  } as unknown as TenantContext;
  const ts = "2026-09-01T12:00:00.000Z";
  const org = tenant.organizationId;
  await runInWorld(ctx, async () => {
    const modalityId = randomUUID();
    const professionalId = randomUUID();
    const classId = randomUUID();
    const otherClassId = randomUUID();
    store.categories.push({ id: modalityId, organizationId: org, name: "Jiu-Jitsu", position: 0, status: "active", createdAt: ts, updatedAt: ts } as never);
    store.professionals.push({ id: professionalId, organizationId: org, unitId: tenant.unitId, name: "Carlos", modalityIds: [modalityId], serviceIds: [], workingHours: [], status: "active", createdAt: ts, updatedAt: ts } as never);
    for (const id of [classId, otherClassId]) {
      store.classGroups.push({ id, organizationId: org, unitId: tenant.unitId, name: id === classId ? "Adulto" : "Kids", modalityId, instructorId: professionalId, capacity: 20, allowDropin: true, sessionPriceCents: 4000, meetingSlots: [{ weekday: 1, start: "19:00", end: "20:00" }], startDate: "2026-09-01", status: "active", createdAt: ts, updatedAt: ts } as never);
    }
    students.length = 0;
    for (let i = 0; i < 4; i++) {
      const id = randomUUID();
      students.push(id);
      store.clients.push({ id, organizationId: org, name: `Aluno ${i}`, phone: "11977770000", status: "active", createdAt: ts, updatedAt: ts } as never);
      store.enrollments.push({ id: randomUUID(), organizationId: org, classGroupId: i < 3 ? classId : otherClassId, studentId: id, status: "active", enrolledAt: ts } as never);
    }
    sessionId = `${classId}~2026-09-21~19:00`;
    // Historico de outras aulas: fica fora do recorte.
    store.attendances.push(
      { id: randomUUID(), organizationId: org, sessionId: `${classId}~2026-09-14~19:00`, studentId: students[0], status: "present", markedAt: ts } as never,
      { id: randomUUID(), organizationId: org, sessionId, studentId: students[1], status: "absent", markedAt: ts } as never,
    );
  });
});

afterEach(async () => {
  forgetCachedWorld(tenant.organizationId);
  await tenant.remove();
});

const sliceOf = (name: keyof typeof classSlices, args: unknown[]) => ({ fn: classSlices[name], args, name });

describe("recorte da aula e da chamada no servidor", () => {
  it("a aula pelo recorte é igual à aula pelo espaço inteiro", async () => {
    forgetCachedWorld(tenant.organizationId);
    const full = await runInWorld(ctx, () => turmasServiceImpl.getSession(sessionId));
    const sliced = await runInWorld(ctx, () => turmasServiceImpl.getSession(sessionId), sliceOf("getSession", [sessionId]));
    expect(canonical(sliced)).toBe(canonical(full));
    expect(full.roster.map((r) => r.attendance ?? null).sort()).toEqual(["absent", null, null].sort());
  });

  it("marcar e desmarcar pelo recorte gravam o mesmo que pelo espaço inteiro", async () => {
    const mark = { sessionId, studentId: students[0], status: "present" as const };
    await runInWorld(ctx, () => turmasServiceImpl.markAttendance(mark), sliceOf("markAttendance", [mark]));
    const many = { sessionId, studentIds: [students[2]], status: "present" as const };
    await runInWorld(ctx, () => turmasServiceImpl.markManyAttendance(many), sliceOf("markManyAttendance", [many]));
    const clear = { sessionId, studentId: students[1] };
    await runInWorld(ctx, () => turmasServiceImpl.clearAttendance(clear), sliceOf("clearAttendance", [clear]));

    forgetCachedWorld(tenant.organizationId);
    const marks = await runInWorld(ctx, async () =>
      Object.fromEntries(store.attendances.filter((a) => a.sessionId === sessionId).map((a) => [a.studentId, a.status])),
    );
    expect(marks).toEqual({ [students[0]]: "present", [students[2]]: "present" });
    // A aula de antes ficou como estava.
    const { data } = await adminClient().from("attendances").select("session_id").eq("organization_id", tenant.organizationId);
    expect((data ?? []).length).toBe(3);
  });

  it("depois de gravar pelo recorte, o espaço em cache segue igual ao banco", async () => {
    const snapshot = () => runInWorld(ctx, async () => canonical({ a: store.attendances, c: store.clients }));
    await snapshot(); // espaco em cache
    const mark = { sessionId, studentId: students[2], status: "justified" as const };
    await runInWorld(ctx, () => turmasServiceImpl.markAttendance(mark), sliceOf("markAttendance", [mark]));
    const cached = await snapshot();
    forgetCachedWorld(tenant.organizationId);
    expect(cached).toBe(await snapshot());
  });

  it("filtro longo (400 aulas) vai em lotes que cabem na URL", async () => {
    // Id de aula de verdade (`turma~data~hora`, mais de 50 caracteres): 150 deles estouravam a URL.
    const classId = sessionId.split("~")[0];
    const ids = Array.from({ length: 399 }, (_, i) => `${classId}~2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}~${String(i % 24).padStart(2, "0")}:00`);
    ids.push(sessionId);
    const found = await runInWorld(ctx, async () => store.attendances.map((a) => a.sessionId), {
      fn: async (_args, load) => {
        await load.where("attendances", "sessionId", ids);
      },
      args: [],
    });
    expect(found).toEqual([sessionId]);
  });
});
