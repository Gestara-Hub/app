import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unwrap } from "@/services/server/action";
import { adminClient, createTestTenant, signInAs, signOut, type TestTenant } from "@/test/db";
import {
  createCategoryAction,
  listCategoriesAction,
  removeCategoryAction,
  updateCategoryAction,
} from "../categoriesActions";
import {
  createProfessionalAction,
  createRoleAction,
  listProfessionalsAction,
  listRolesAction,
  updateProfessionalAction,
} from "../teamActions";

let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("catálogo no banco (doc 15, fatia 2.1)", () => {
  it("cria, lista, edita e inativa modalidade no espaço da sessão", async () => {
    const created = await unwrap(createCategoryAction({ name: " Jiu-Jitsu " }));
    expect(created.name).toBe("Jiu-Jitsu");
    expect(created.organizationId).toBe(tenant.organizationId);
    expect(created.position).toBe(1);

    const second = await unwrap(createCategoryAction({ name: "Muay Thai" }));
    expect(second.position).toBe(2);

    const { category } = await unwrap(updateCategoryAction(created.id, { name: "BJJ" }));
    expect(category.name).toBe("BJJ");

    await unwrap(removeCategoryAction(second.id));
    const list = await unwrap(listCategoriesAction());
    expect(list.map((c) => [c.name, c.status])).toEqual([
      ["BJJ", "active"],
      ["Muay Thai", "inactive"],
    ]);
    expect(await unwrap(listCategoriesAction({ search: "muay" }))).toHaveLength(1);
  });

  it("nome de modalidade repetido sem acento nem caixa vira erro de campo", async () => {
    await unwrap(createCategoryAction({ name: "Natação" }));
    const result = await createCategoryAction({ name: "natacao" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.[0]).toMatchObject({ field: "name", message: "Já existe uma modalidade com esse nome." });
    }
  });

  it("trilha nova devolve ao primeiro nível o aluno num nível que sumiu", async () => {
    const category = await unwrap(
      createCategoryAction({
        name: "Judô",
        progressionTrack: {
          enabled: true,
          levels: [
            { id: "branca", name: "Branca", color: "white", maxSubLevels: 4 },
            { id: "azul", name: "Azul", color: "blue", maxSubLevels: 4 },
          ],
        } as never,
      }),
    );
    const admin = adminClient();
    const { data: student } = await admin
      .from("clients")
      .insert({
        organization_id: tenant.organizationId,
        name: "Aluno da trilha",
        phone: "11999990000",
        progressions: {
          [category.id]: { modalityId: category.id, levelId: "azul", levelName: "Azul", subLevel: 2, updatedAt: new Date().toISOString() },
        },
      })
      .select("id")
      .single()
      .throwOnError();

    const { reset } = await unwrap(
      updateCategoryAction(category.id, {
        progressionTrack: {
          enabled: true,
          levels: [{ id: "branca", name: "Branca", color: "white", maxSubLevels: 4 }],
        } as never,
      }),
    );
    expect(reset).toBe(1);
    const { data: after } = await admin.from("clients").select("progressions").eq("id", student!.id).single();
    expect((after!.progressions as Record<string, { levelId: string; subLevel: number }>)[category.id]).toMatchObject({
      levelId: "branca",
      subLevel: 0,
    });
  });

  it("equipe com cargo: cria, filtra e valida cargo de outro espaço", async () => {
    const role = await unwrap(createRoleAction({ name: "Instrutor" }));
    expect((await createRoleAction({ name: "instrutor" })).ok).toBe(false);

    const pro = await unwrap(createProfessionalAction({ name: "Ana", roleId: role.id, serviceIds: [] }));
    expect(pro.role).toEqual({ id: role.id, name: "Instrutor" });
    expect(pro.unitId).toBe(tenant.unitId);
    expect(await unwrap(listProfessionalsAction({ search: "instrutor" }))).toHaveLength(1);

    const other = await createTestTenant();
    try {
      const foreignRole = await unwrap(createRoleAction({ name: "Recepção" }));
      await signInAs(tenant.owner);
      const result = await updateProfessionalAction(pro.id, { roleId: foreignRole.id });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.fields?.[0]?.field).toBe("roleId");
    } finally {
      await other.remove();
      await signInAs(tenant.owner);
    }
    expect(await unwrap(listRolesAction())).toHaveLength(1);
  });

  it("professor não gerencia equipe e visitante não lê nada", async () => {
    const teacher = await tenant.addUser("professional");
    await signInAs(teacher);
    const denied = await createRoleAction({ name: "Gerente" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("FORBIDDEN");
    expect((await listRolesAction()).ok).toBe(true);

    signOut();
    const anonymous = await listCategoriesAction();
    expect(anonymous.ok).toBe(false);
    if (!anonymous.ok) expect(anonymous.error.httpStatus).toBe(401);
  });
});
