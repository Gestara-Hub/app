import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import type { TenantContext } from "@/services/server/tenant";
import { turmasServiceImpl } from "@/services/classes";
import { classSlices } from "@/services/classes/classSlices";
import { forgetCachedWorld, runInWorld } from "../runWorld";
import { store } from "../store";

/**
 * Concorrencia pelo que a acao leu (doc 19, fase 2; migracao 42). As acoes
 * sao intercaladas de proposito: as duas leem e so depois gravam, como duas
 * requisicoes ao mesmo tempo.
 */

let tenant: TestTenant;
let ctx: TenantContext;
let sessionA: string;
let sessionB: string;
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
  const classA = randomUUID();
  const classB = randomUUID();
  await runInWorld(ctx, async () => {
    const modalityId = randomUUID();
    const professionalId = randomUUID();
    store.categories.push({ id: modalityId, organizationId: org, name: "Jiu-Jitsu", position: 0, status: "active", createdAt: ts, updatedAt: ts } as never);
    store.professionals.push({ id: professionalId, organizationId: org, unitId: tenant.unitId, name: "Carlos", modalityIds: [modalityId], serviceIds: [], workingHours: [], status: "active", createdAt: ts, updatedAt: ts } as never);
    for (const id of [classA, classB]) {
      store.classGroups.push({ id, organizationId: org, unitId: tenant.unitId, name: id === classA ? "Adulto" : "Kids", modalityId, instructorId: professionalId, capacity: 20, allowDropin: true, sessionPriceCents: 4000, meetingSlots: [{ weekday: 1, start: "19:00", end: "20:00" }], startDate: "2026-09-01", status: "active", createdAt: ts, updatedAt: ts } as never);
    }
    students.length = 0;
    for (let i = 0; i < 4; i++) {
      const id = randomUUID();
      students.push(id);
      store.clients.push({ id, organizationId: org, name: `Aluno ${i}`, phone: "11977770000", status: "active", createdAt: ts, updatedAt: ts } as never);
      store.enrollments.push({ id: randomUUID(), organizationId: org, classGroupId: i < 2 ? classA : classB, studentId: id, status: "active", enrolledAt: ts } as never);
    }
  });
  sessionA = `${classA}~2026-09-21~19:00`;
  sessionB = `${classB}~2026-09-21~19:00`;
});

afterEach(async () => {
  forgetCachedWorld(tenant.organizationId);
  await tenant.remove();
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/** Marca presenca pelo recorte, mas so grava depois de `before` (a leitura ja foi feita). */
function markAfter(sessionId: string, studentId: string, read: () => void, before: Promise<void>) {
  const input = { sessionId, studentId, status: "present" as const };
  return runInWorld(
    ctx,
    async () => {
      read();
      await before;
      return turmasServiceImpl.markAttendance(input);
    },
    { fn: classSlices.markAttendance, args: [input], name: "turmas.markAttendance" },
  );
}

/** As duas leem, depois as duas gravam; devolve o resultado de cada uma. */
async function interleaved(a: [string, string], b: [string, string]) {
  const readA = deferred();
  const readB = deferred();
  const both = Promise.all([readA.promise, readB.promise]).then(() => undefined);
  return Promise.allSettled([markAfter(...a, readA.resolve, both), markAfter(...b, readB.resolve, both)]);
}

async function marks(sessionId: string): Promise<string[]> {
  const { data } = await adminClient()
    .from("attendances")
    .select("student_id")
    .eq("organization_id", tenant.organizationId)
    .eq("session_id", sessionId);
  return (data ?? []).map((row) => String(row.student_id)).sort();
}

const conflicts = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "CONFLICT").length;

describe("concorrência pelo que a ação leu", () => {
  it("chamadas de turmas diferentes ao mesmo tempo: as duas gravam", async () => {
    const results = await interleaved([sessionA, students[0]], [sessionB, students[2]]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await marks(sessionA)).toEqual([students[0]]);
    expect(await marks(sessionB)).toEqual([students[2]]);
  });

  it("a mesma aula ao mesmo tempo: a segunda conflita (leu a aula antes da primeira gravar)", async () => {
    const results = await interleaved([sessionA, students[0]], [sessionA, students[1]]);
    expect(conflicts(results)).toBe(1);
    expect((await marks(sessionA)).length).toBe(1);
  });

  it("gravação direta (fora do motor) depois da leitura: conflita", async () => {
    const read = deferred();
    const written = deferred();
    const marking = markAfter(sessionA, students[0], read.resolve, written.promise);
    await read.promise;
    // Ex.: webhook ou rotina gravando direto numa tabela do espaco.
    await adminClient().from("clients").update({ name: "Aluno 3 (editado)" }).eq("id", students[3]);
    written.resolve();
    await expect(marking).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("espaço inteiro lido: qualquer gravação no meio conflita (regra de antes)", async () => {
    const read = deferred();
    const written = deferred();
    const whole = runInWorld(ctx, async () => {
      read.resolve();
      await written.promise;
      return turmasServiceImpl.markAttendance({ sessionId: sessionB, studentId: students[2], status: "present" });
    });
    await read.promise;
    await markAfter(sessionA, students[0], () => undefined, Promise.resolve());
    written.resolve();
    await expect(whole).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("gravação com o espaço inteiro marca os baldes: quem leu pelo recorte vê", async () => {
    const read = deferred();
    const written = deferred();
    const marking = markAfter(sessionA, students[0], read.resolve, written.promise);
    await read.promise;
    await runInWorld(ctx, () => turmasServiceImpl.markAttendance({ sessionId: sessionA, studentId: students[1], status: "absent" }));
    written.resolve();
    await expect(marking).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("gravação com o espaço inteiro em outra turma: quem leu pelo recorte grava", async () => {
    const read = deferred();
    const written = deferred();
    const marking = markAfter(sessionA, students[0], read.resolve, written.promise);
    await read.promise;
    await runInWorld(ctx, () => turmasServiceImpl.markAttendance({ sessionId: sessionB, studentId: students[2], status: "absent" }));
    written.resolve();
    await marking;
    expect(await marks(sessionA)).toEqual([students[0]]);
  });
});
