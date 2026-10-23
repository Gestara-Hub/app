import { beforeEach, describe, expect, it } from "vitest";
import { defaultMessageTemplates } from "@/mocks/seed";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { communicationService } from "@/services/communication";
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
});

describe("area do espaco e textos das mensagens", () => {
  beforeEach(() => resetAcademy());

  it("lutas para Pilates troca os textos ainda no padrao e mantem os editados", async () => {
    await communicationService.updateTemplate({ id: tmpl("absence"), content: "Texto meu sobre o tatame, {aluno}." });
    expect(contentOf("welcome")).toContain("tatame");
    expect(contentOf("before-due")).toContain("Bons treinos!");

    await settingsService.updateOrganization({ classSegment: "pilates_yoga" });

    const pilates = new Map(defaultMessageTemplates(ACADEMY_ORG, "pilates_yoga").map((t) => [t.id, t.content]));
    expect(contentOf("welcome")).toBe(pilates.get(tmpl("welcome")));
    expect(contentOf("before-due")).toBe(pilates.get(tmpl("before-due")));
    expect(contentOf("welcome")).not.toMatch(/tatame|treinos/);
    expect(contentOf("before-due")).toContain("Boas aulas!");
    // Editado pelo espaco fica como estava.
    expect(contentOf("absence")).toBe("Texto meu sobre o tatame, {aluno}.");
  });

  it("textos padrao de outras areas nao falam em tatame nem treinos", () => {
    for (const segment of [
      "pilates_yoga",
      "music",
      "languages",
      "dance",
      "functional_training",
      "swimming_sports",
      "gastronomy",
      "arts_crafts",
      "beauty_courses",
      "custom",
    ] as const) {
      for (const t of defaultMessageTemplates(ACADEMY_ORG, segment)) {
        expect(t.content).not.toMatch(/tatame|treinos/);
      }
    }
  });

  it("de Pilates para Danca segue trocando (o anterior e o padrao de Pilates)", async () => {
    await settingsService.updateOrganization({ classSegment: "pilates_yoga" });
    await communicationService.updateTemplate({ id: tmpl("birthday"), content: "Parabéns, {aluno}!" });
    await settingsService.updateOrganization({ classSegment: "dance" });
    const dance = new Map(defaultMessageTemplates(ACADEMY_ORG, "dance").map((t) => [t.id, t.content]));
    expect(contentOf("welcome")).toBe(dance.get(tmpl("welcome")));
    expect(contentOf("birthday")).toBe("Parabéns, {aluno}!");
  });

  it("voltar para lutas devolve o texto de treino e tatame", async () => {
    await settingsService.updateOrganization({ classSegment: "music" });
    await settingsService.updateOrganization({ classSegment: "martial_arts" });
    expect(contentOf("welcome")).toContain("Nos vemos no tatame!");
    expect(contentOf("absence")).toContain("Seu lugar no tatame está guardado!");
  });

  it("mesma area ou so o nome nao mexem nos textos editados nem nos padrao", async () => {
    await settingsService.updateOrganization({ classSegment: "pilates_yoga" });
    const before = store.messageTemplates.map((t) => t.content);
    await settingsService.updateOrganization({ classSegment: "pilates_yoga", name: "Studio" });
    await settingsService.updateOrganization({ name: "Studio 2" });
    expect(store.messageTemplates.map((t) => t.content)).toEqual(before);
  });

  it("textos sem diferenca por area ficam iguais", async () => {
    const dueDate = contentOf("due-date");
    await settingsService.updateOrganization({ classSegment: "swimming_sports" });
    expect(contentOf("due-date")).toBe(dueDate);
  });

  it("lutas para uma area nova (Gastronomia) troca os textos ainda no padrao", async () => {
    await settingsService.updateOrganization({ classSegment: "gastronomy" });
    const gastronomy = new Map(defaultMessageTemplates(ACADEMY_ORG, "gastronomy").map((t) => [t.id, t.content]));
    expect(contentOf("welcome")).toBe(gastronomy.get(tmpl("welcome")));
    expect(contentOf("before-due")).toContain("Boas aulas!");
    expect(contentOf("absence")).not.toContain("tatame");
  });

  it("Outra área grava o nome, como os alunos avancam e como cobra", async () => {
    const org = await settingsService.updateOrganization({
      classSegment: "custom",
      customSegmentName: "Teatro",
      customSegmentProgression: "levels",
      customSegmentBilling: "package",
    });
    expect(org.customSegmentName).toBe("Teatro");
    expect(org.customSegmentProgression).toBe("levels");
    expect(org.customSegmentBilling).toBe("package");
    expect((await settingsService.getOrganization()).customSegmentBilling).toBe("package");
    expect(contentOf("welcome")).not.toContain("tatame");
  });

  it("modelos recriados depois da troca nascem no texto da area", async () => {
    await settingsService.updateOrganization({ classSegment: "pilates_yoga" });
    store.messageTemplates = [];
    const list = await communicationService.listTemplates();
    expect(list.find((t) => t.trigger === "welcome_student")?.content).not.toContain("tatame");
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
