import { beforeEach, describe, expect, it } from "vitest";
import { resetStore, setActiveOrganization, store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { categoriesService } from "@/services/categoriesService";
import { clientsService } from "@/services/clientsService";
import { professionalsService } from "@/services/professionalsService";
import { ACADEMY_ORG, ACADEMY_UNIT, resetAcademy } from "@/test/academy";

describe("escopo do tenant carimbado pelo servidor", () => {
  beforeEach(() => resetAcademy());

  it("ignora organização enviada no payload", async () => {
    // Simula um cliente malicioso ou desatualizado mandando outro tenant.
    const forged = { name: "Plano", period: "monthly", priceCents: 1000, status: "active", organizationId: "org-corte-nobre" };
    const plan = await billingService.createPlan(forged as never);
    expect(plan.organizationId).toBe(ACADEMY_ORG);
  });

  it("profissional nasce na unidade ativa", async () => {
    const modality = await categoriesService.create({ name: "Boxe" });
    const p = await professionalsService.create({
      name: "Instrutor",
      status: "active",
      workingHours: [],
      serviceIds: [],
      modalityIds: [modality.id],
    });
    expect(store.professionals.find((x) => x.id === p.id)?.unitId).toBe(ACADEMY_UNIT);
  });
});

describe("termos por modelo de negócio", () => {
  beforeEach(() => resetStore());

  it("academia fala em modalidade; barbearia em categoria", async () => {
    setActiveOrganization(ACADEMY_ORG);
    await categoriesService.create({ name: "Jiu-Jitsu" });
    await expect(categoriesService.create({ name: " jiu-jitsu " })).rejects.toMatchObject({
      fields: [{ field: "name", message: "Já existe uma modalidade com esse nome." }],
    });

    setActiveOrganization("org-corte-nobre");
    await categoriesService.create({ name: "Cabelo" });
    await expect(categoriesService.create({ name: "cabelo" })).rejects.toMatchObject({
      fields: [{ field: "name", message: "Já existe uma categoria com esse nome." }],
    });
  });

  it("reativar é registrado como reativou", async () => {
    setActiveOrganization(ACADEMY_ORG);
    const c = await clientsService.create({ name: "Aluno X", phone: "11977770000", status: "active" });
    await clientsService.remove(c.id);
    await clientsService.update(c.id, { status: "active" });
    expect(store.auditLog.at(-1)?.summary).toBe("Ana Ribeiro reativou o aluno Aluno X");
  });
});

describe("busca de alunos", () => {
  beforeEach(() => resetAcademy());

  it("encontra por telefone formatado ou só dígitos", async () => {
    await clientsService.create({ name: "Maria", phone: "11977776603", status: "active" });
    for (const q of ["97777-6603", "(11) 97777", "977776603"]) {
      expect((await clientsService.list({ search: q })).map((c) => c.name)).toEqual(["Maria"]);
    }
  });
});
