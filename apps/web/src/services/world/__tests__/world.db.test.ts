import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@gestarahub/contracts";
import { unwrap } from "@/services/server/action";
import { adminClient, createTestTenant, sessionClient, signInAs, type TestTenant } from "@/test/db";
import { WORLD_SCHEMA } from "../schema.generated";
import { serviceAction } from "../serviceActions";
import { runInWorld } from "../runWorld";
import { store } from "../store";
import type { TenantContext } from "@/services/server/tenant";

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
    // Telefone e opcional desde 09/11/2026 (aluno experimental so com o nome).
    if (!invalid.ok) expect(invalid.error.fields?.map((f) => f.field)).toEqual(["name"]);

    await signInAs(await tenant.addUser("professional"));
    const denied = await serviceAction("clients.create", [{ name: "X", phone: "1", status: "active" }]);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
    expect((await serviceAction("clients.nao_existe", [])).ok).toBe(false);
  });

  it("a função de gravação não é chamada direto pelo usuário", async () => {
    const created = await call<Client>("clients.create", { name: "Eva", phone: "11955554444", status: "active" });
    const { data: row } = await adminClient().from("clients").select("*").eq("id", created.id).single();
    const { error } = await sessionClient().rpc("apply_world_changes", {
      p_organization_id: tenant.organizationId,
      p_changes: { upserts: [{ table: "clients", pk: "id", row: { ...row, name: "Eva 2" } }], deletes: [] },
      p_expected_version: 0,
    });
    expect(error?.code).toBe("42501");
  });

  it("linha mudada depois da leitura aborta a gravação inteira (concorrência)", async () => {
    const created = await call<Client>("clients.create", { name: "Eva", phone: "11955554444", status: "active" });
    const admin = adminClient();
    const { data: row } = await admin.from("clients").select("*").eq("id", created.id).single();
    const { data: version } = await admin
      .from("world_versions")
      .select("version")
      .eq("organization_id", tenant.organizationId)
      .single();
    await admin.from("clients").update({ notes: "outra aba" }).eq("id", created.id).throwOnError();
    const { error } = await admin.rpc("apply_world_changes", {
      p_organization_id: tenant.organizationId,
      p_changes: {
        upserts: [{ table: "clients", pk: "id", row: { ...row, name: "Eva 2" }, expected: row!.updated_at }],
        deletes: [],
      },
      p_expected_version: version!.version,
    });
    expect(error?.code).toBe("40001");
    // Versao velha tambem aborta.
    const stale = await admin.rpc("apply_world_changes", {
      p_organization_id: tenant.organizationId,
      p_changes: { upserts: [], deletes: [] },
      p_expected_version: Number(version!.version) - 1,
    });
    expect(stale.error?.code).toBe("40001");
  });

  it("configurações: leitura do banco, troca de área atualiza os modelos e só o dono altera", async () => {
    await call("communication.listTemplates");
    const org = await call<{ name: string; classSegment?: string }>("settings.getOrganization");
    expect(org.name).toBe("Espaço de teste");
    await call("settings.updateOrganization", { name: "Escola de Idiomas", classSegment: "languages" });
    const admin = adminClient();
    const { data: row } = await admin.from("organizations").select("name, class_segment").eq("id", tenant.organizationId).single();
    expect(row).toEqual({ name: "Escola de Idiomas", class_segment: "languages" });
    const { data: welcome } = await admin
      .from("message_templates")
      .select("content")
      .eq("organization_id", tenant.organizationId)
      .eq("trigger", "welcome_student")
      .single();
    // Lutas fala em tatame; idiomas, em aula.
    expect(welcome?.content).not.toContain("tatame");

    await signInAs(await tenant.addUser("manager"));
    const denied = await serviceAction("settings.updateOrganization", [{ name: "Outro" }]);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
  });

  it("desfazer o pagamento grava a cobrança em aberto (coluna obrigatória de anexos)", async () => {
    const created = await call<Client>("clients.create", { name: "Gil", phone: "11944443333", status: "active" });
    const { data: charge } = await adminClient()
      .from("charges")
      .insert({
        organization_id: tenant.organizationId,
        student_id: created.id,
        kind: "extra",
        description: "Kimono",
        due_date: "2026-10-10",
        amount_cents: 25000,
        status: "pending",
      })
      .select("id")
      .single()
      .throwOnError();
    await call("billing.markPaid", charge!.id, "pix");
    await call("billing.markPending", charge!.id);
    const { data } = await adminClient().from("charges").select("status, method, attachments").eq("id", charge!.id).single();
    expect(data).toEqual({ status: "pending", method: null, attachments: [] });
  });

  it("mudança dentro de lista ou objeto (jsonb) também é gravada", async () => {
    const admin = adminClient();
    await admin
      .from("organizations")
      .update({ settings: { billingTiming: "prepaid", defaultDueDay: 10 } })
      .eq("id", tenant.organizationId)
      .throwOnError();
    const ctx = {
      client: admin,
      organizationId: tenant.organizationId,
      userId: tenant.owner.id,
      profile: "owner",
      require: () => undefined,
    } as unknown as TenantContext;
    await runInWorld(ctx, async () => {
      delete (store.organization.settings as Record<string, unknown>).billingTiming;
    });
    const { data } = await admin.from("organizations").select("settings").eq("id", tenant.organizationId).single();
    expect(data?.settings).toEqual({ defaultDueDay: 10 });
  });
});

