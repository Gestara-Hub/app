import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@gestarahub/contracts";
import { unwrap } from "@/services/server/action";
import { adminClient, createTestTenant, sessionClient, signInAs, type TestTenant } from "@/test/db";
import { WORLD_SCHEMA } from "../schema.generated";
import { serviceAction } from "../serviceActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

const call = <T>(method: string, ...args: unknown[]) => unwrap(serviceAction(method, args)) as Promise<T>;

async function seedPlan(priceCents = 15000): Promise<string> {
  const { data } = await adminClient()
    .from("plans")
    .insert({ organization_id: tenant.organizationId, name: "Mensal", price_cents: priceCents, period: "monthly" })
    .select("id")
    .single()
    .throwOnError();
  return String(data!.id);
}

describe("espaço do banco no servidor (doc 15, fatia 2)", () => {
  it("o esquema gerado bate com o banco (rode pnpm world:schema se falhar)", async () => {
    const { data, error } = await adminClient().from("organizations").select("*").limit(1);
    expect(error).toBeNull();
    const columns = Object.keys(data?.[0] ?? {});
    if (columns.length > 0) expect(columns.sort()).toEqual(Object.keys(WORLD_SCHEMA.organizations.columns).sort());
  });

  it("aluno com plano: cadastro grava aluno, 1ª mensalidade e auditoria", async () => {
    const planId = await seedPlan();
    const created = await call<Client>("clients.create", {
      name: "Bruna Lima",
      phone: "11988887777",
      status: "active",
      planId,
      planStartDate: "2026-10-01",
      dueDay: 10,
      initialCharge: { amountCents: 15000, dueDate: "2026-10-10", periodStart: "2026-10-01", periodEnd: "2026-10-31" },
    });
    expect(created.organizationId).toBe(tenant.organizationId);

    const admin = adminClient();
    const { data: client } = await admin.from("clients").select("name, plan_id").eq("id", created.id).single();
    expect(client).toEqual({ name: "Bruna Lima", plan_id: planId });
    const { data: charges } = await admin
      .from("charges")
      .select("kind, amount_cents, period_start, status")
      .eq("student_id", created.id);
    expect(charges).toEqual([{ kind: "membership", amount_cents: 15000, period_start: "2026-10-01", status: "pending" }]);
    const { data: logs } = await admin.from("audit_logs").select("summary").eq("organization_id", tenant.organizationId);
    expect(logs?.map((l) => l.summary)).toEqual(["Teste owner criou o aluno Bruna Lima"]);

    const found = await call<Client[]>("clients.list", { search: "bruna" });
    expect(found.map((c) => c.id)).toEqual([created.id]);
  });

  it("leitura não grava nada", async () => {
    const created = await call<Client>("clients.create", { name: "Caio", phone: "11977776666", status: "active" });
    const admin = adminClient();
    const before = await admin.from("clients").select("updated_at").eq("id", created.id).single();
    const logsBefore = await admin.from("audit_logs").select("id").eq("organization_id", tenant.organizationId);
    await call("clients.list");
    await call("clients.getById", created.id);
    const after = await admin.from("clients").select("updated_at").eq("id", created.id).single();
    const logsAfter = await admin.from("audit_logs").select("id").eq("organization_id", tenant.organizationId);
    expect(after.data).toEqual(before.data);
    expect(logsAfter.data).toHaveLength(logsBefore.data!.length);
  });

  it("inativar encerra a matrícula e sai da lista de espera no banco", async () => {
    const created = await call<Client>("clients.create", { name: "Duda", phone: "11966665555", status: "active" });
    const admin = adminClient();
    const { data: pro } = await admin
      .from("professionals")
      .insert({ organization_id: tenant.organizationId, unit_id: tenant.unitId, name: "Prof" })
      .select("id")
      .single()
      .throwOnError();
    const { data: group } = await admin
      .from("class_groups")
      .insert({
        organization_id: tenant.organizationId,
        unit_id: tenant.unitId,
        name: "Turma A",
        instructor_id: pro!.id,
        start_date: "2026-01-05",
        billing_mode: "free",
        meeting_slots: [{ weekday: 1, start: "19:00", end: "20:00" }],
      })
      .select("id")
      .single()
      .throwOnError();
    await admin
      .from("enrollments")
      .insert({ organization_id: tenant.organizationId, class_group_id: group!.id, student_id: created.id })
      .throwOnError();
    await admin
      .from("waitlist")
      .insert({ organization_id: tenant.organizationId, class_group_id: group!.id, student_id: created.id, position: 1 })
      .throwOnError();

    await call("clients.remove", created.id);

    const { data: client } = await admin.from("clients").select("status").eq("id", created.id).single();
    expect(client?.status).toBe("inactive");
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("status, cancellation_reason")
      .eq("student_id", created.id)
      .single();
    expect(enrollment).toEqual({ status: "canceled", cancellation_reason: "Aluno inativado" });
    const { data: waiting } = await admin.from("waitlist").select("status").eq("student_id", created.id).single();
    expect(waiting?.status).toBe("canceled");
  });

  it("validação do serviço volta como erro de campo; professor não cadastra aluno", async () => {
    const invalid = await serviceAction("clients.create", [{ name: "", phone: "", status: "active" }]);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.fields?.map((f) => f.field)).toEqual(["name", "phone"]);

    await signInAs(await tenant.addUser("professional"));
    const denied = await serviceAction("clients.create", [{ name: "X", phone: "1", status: "active" }]);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
    expect((await serviceAction("clients.nao_existe", [])).ok).toBe(false);
  });

  it("gravação com leitura velha é recusada inteira (concorrência)", async () => {
    const created = await call<Client>("clients.create", { name: "Eva", phone: "11955554444", status: "active" });
    const { data: row } = await adminClient().from("clients").select("*").eq("id", created.id).single();
    await adminClient().from("clients").update({ notes: "outra aba" }).eq("id", created.id).throwOnError();
    const { error } = await sessionClient().rpc("apply_world_changes", {
      p_organization_id: tenant.organizationId,
      p_changes: {
        upserts: [{ table: "clients", pk: "id", row: { ...row, name: "Eva 2" }, expected: row!.updated_at }],
        deletes: [],
      },
    });
    expect(error?.code).toBe("40001");
  });
});
