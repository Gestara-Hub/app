import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { settingsService } from "@/services/settings/settingsService";
import { ACADEMY_ORG, resetAcademy } from "@/test/academy";

const tmpl = (key: string) => `tmpl-${ACADEMY_ORG}-${key}`;
const contentOf = (key: string) => store.messageTemplates.find((t) => t.id === tmpl(key))?.content ?? "";
const lastAudit = () => store.auditLog.at(-1)?.summary ?? "";

describe("dados da organizacao", () => {
  beforeEach(() => resetAcademy());

  it("nome vazio mantem o atual; nome novo sai sem espacos e e auditado como seguranca", async () => {
    await settingsService.updateOrganization({ name: "   " });
    expect(store.organization.name).toBe("Academia X");
    const org = await settingsService.updateOrganization({ name: "  Academia Y  " });
    expect(org.name).toBe("Academia Y");
    expect(store.auditLog.at(-1)).toMatchObject({ security: true });
    expect(lastAudit()).toBe("Ana Ribeiro atualizou os dados da organização");
  });

  it("devolve uma copia (mexer no retorno nao altera o store)", async () => {
    const org = await settingsService.getOrganization();
    org.name = "Outra";
    expect(store.organization.name).toBe("Academia X");
  });

  it("settings so muda quando vem no payload", async () => {
    await settingsService.updateOrganization({ name: "Academia Y" });
    expect(store.organization.settings?.defaultDueDay).toBe(10);
  });

  it("settings junta as chaves: a aba Cobranca nao apaga o fuso salvo pela Geral", async () => {
    await settingsService.updateOrganization({ settings: { timeZone: "America/Manaus" } });
    await settingsService.updateOrganization({ settings: { billingTiming: "postpaid", defaultDueDay: 5 } });
    expect(store.organization.settings).toMatchObject({
      timeZone: "America/Manaus",
      billingTiming: "postpaid",
      defaultDueDay: 5,
    });
  });
});

describe("dados da unidade", () => {
  beforeEach(() => resetAcademy());

  it("telefone invalido e recusado no servico (a tela tambem confere)", async () => {
    await expect(settingsService.updateUnit({ phone: "+551389977084195435" })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "phone", message: "Telefone inválido." }],
    });
    const unit = await settingsService.updateUnit({ phone: "+5513997708419" });
    expect(unit.phone).toBe("+5513997708419");
    // Vazio apaga o telefone.
    expect((await settingsService.updateUnit({ phone: "" })).phone).toBeUndefined();
  });
});

describe("area do espaco e textos das mensagens", () => {
  beforeEach(() => resetAcademy());

  it("trocar a área não muda os textos: são os modelos mestres (doc technical/07 §1.7)", async () => {
    const before = store.messageTemplates.map((t) => t.content);
    await settingsService.updateOrganization({ classSegment: "pilates_yoga" });
    await settingsService.updateOrganization({ classSegment: "dance" });
    expect(store.messageTemplates.map((t) => t.content)).toEqual(before);
    expect(contentOf("before-due")).not.toContain("Bons treinos");
    expect(contentOf("welcome")).not.toContain("tatame");
  });
});

describe("revisao das modalidades da configuracao inicial", () => {
  beforeEach(() => {
    resetAcademy();
    store.organization.settings = { ...store.organization.settings, modalitiesReviewed: false };
  });

  const reviewed = () => store.organization.settings?.modalitiesReviewed;

  it("editar o nome da modalidade conta como revisao", async () => {
    const m = await categoriesService.create({ name: "Jiu-Jitsu" });
    await categoriesService.update(m.id, { name: "Jiu-Jitsu Adulto" });
    expect(reviewed()).toBe(true);
  });

  it("editar a trilha conta como revisao", async () => {
    const m = await categoriesService.create({ name: "Pilates" });
    await categoriesService.update(m.id, {
      progressionTrack: {
        enabled: true,
        style: "levels",
        criteriaType: "manual_exam",
        levels: [{ id: "n1", name: "Nível 1", maxSubLevels: 0 }],
      },
    });
    expect(reviewed()).toBe(true);
  });

  it("so trocar a situacao nao conta", async () => {
    const m = await categoriesService.create({ name: "Muay Thai" });
    await categoriesService.update(m.id, { status: "inactive" });
    await categoriesService.update(m.id, { status: "active" });
    await categoriesService.remove(m.id);
    expect(reviewed()).toBe(false);
  });

  it("edicao recusada nao conta", async () => {
    await categoriesService.create({ name: "Boxe" });
    const m = await categoriesService.create({ name: "Judô" });
    await expect(categoriesService.update(m.id, { name: "boxe" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(reviewed()).toBe(false);
  });

  it("sem revisao pendente (sem modalidades do setup) a flag nao aparece", async () => {
    store.organization.settings = { defaultDueDay: 10 };
    const m = await categoriesService.create({ name: "Jiu-Jitsu" });
    await categoriesService.update(m.id, { name: "BJJ" });
    expect(store.organization.settings?.modalitiesReviewed).toBeUndefined();
  });

  it("Esta tudo certo marca revisado, mantem o resto e audita", async () => {
    const org = await settingsService.markModalitiesReviewed();
    expect(org.settings).toMatchObject({ modalitiesReviewed: true, defaultDueDay: 10, billingTiming: "prepaid" });
    expect(reviewed()).toBe(true);
    expect(lastAudit()).toBe("Ana Ribeiro revisou as modalidades criadas na configuração inicial");
  });
});

describe("nome do espaço e da unidade", () => {
  beforeEach(() => resetAcademy());

  it("aceita até 80 caracteres", async () => {
    await expect(settingsService.updateOrganization({ name: "a".repeat(81) })).rejects.toMatchObject({
      fields: [{ field: "organizationName", message: "Use até 80 caracteres." }],
    });
    await expect(settingsService.updateUnit({ name: "b".repeat(81) })).rejects.toMatchObject({
      fields: [{ field: "unitName" }],
    });
    await expect(settingsService.updateOrganization({ name: "a".repeat(80) })).resolves.toMatchObject({
      name: "a".repeat(80),
    });
  });
});
