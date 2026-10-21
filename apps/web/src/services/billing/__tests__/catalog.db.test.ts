import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unwrap } from "@/services/server/action";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";
import {
  createPackageAction,
  createPlanAction,
  listPackagesAction,
  listPlansAction,
  updatePackageAction,
  updatePlanAction,
} from "../catalogActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("planos e pacotes no banco (doc 15, fatia 2.1)", () => {
  it("plano: cria, edita valor e não muda a periodicidade com aluno ativo", async () => {
    const plan = await unwrap(createPlanAction({ name: "Mensal livre", priceCents: 15000, period: "monthly", status: "active" }));
    const { before, after } = await unwrap(updatePlanAction(plan.id, { priceCents: 16000 }));
    expect([before.priceCents, after.priceCents]).toEqual([15000, 16000]);

    await adminClient()
      .from("clients")
      .insert({ organization_id: tenant.organizationId, name: "Aluno", phone: "11999990000", plan_id: plan.id })
      .throwOnError();
    const blocked = await updatePlanAction(plan.id, { period: "weekly" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.fields?.[0]?.field).toBe("period");

    expect((await unwrap(listPlansAction({ search: "livre" }))).map((p) => p.id)).toEqual([plan.id]);
  });

  it("plano com valor zero e erro de campo; professor não cria plano", async () => {
    const invalid = await createPlanAction({ name: "Grátis", priceCents: 0, period: "monthly", status: "active" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.fields?.[0]?.field).toBe("priceCents");

    await signInAs(await tenant.addUser("professional"));
    const denied = await createPlanAction({ name: "Plano", priceCents: 100, period: "monthly", status: "active" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
  });

  it("pacote: normaliza, recusa turma de curso e limpa a validade", async () => {
    const pkg = await unwrap(
      createPackageAction({
        name: " 10 aulas ",
        lessons: 10,
        priceCents: 50000,
        validityDays: 90,
        classGroupIds: [],
        modalityIds: [],
        absenceConsumes: true,
        status: "active",
      }),
    );
    expect(pkg.name).toBe("10 aulas");

    const { data: pro } = await adminClient()
      .from("professionals")
      .insert({ organization_id: tenant.organizationId, unit_id: tenant.unitId, name: "Prof" })
      .select("id")
      .single()
      .throwOnError();
    const { data: course } = await adminClient()
      .from("class_groups")
      .insert({
        organization_id: tenant.organizationId,
        unit_id: tenant.unitId,
        name: "Curso de férias",
        instructor_id: pro!.id,
        start_date: "2026-01-05",
        billing_mode: "course",
      })
      .select("id")
      .single()
      .throwOnError();
    const refused = await updatePackageAction(pkg.id, { classGroupIds: [String(course!.id)] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.fields?.[0]?.field).toBe("classGroupIds");

    const { after } = await unwrap(updatePackageAction(pkg.id, { validityDays: undefined }));
    expect(after.validityDays).toBeUndefined();
    expect(await unwrap(listPackagesAction())).toHaveLength(1);
  });
});
