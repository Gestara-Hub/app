import { tierWhatsAppQuota, type SendMessagePayload } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import {
  runBillingReminders,
  runBirthdayGreetings,
  metaBodyFor,
  officialTemplateFor,
  setQueuedMessageDeliverer,
  type QueuedMessageJob,
} from "@/services/communication/communicationRules";
import { whatsappClient } from "@/services/communication/whatsappClient";
import { syncMetaTemplates } from "@/services/communication/metaTemplatesSync";
import { setWhatsAppCredentialsGateway } from "@/services/communication/whatsappCredentialsGateway";
import { setEffectsResolver, type WorldEffect } from "@/services/world/effects";
import { birthdayGreetingsSlice } from "@/services/communication/birthdayGreetingsCron";
import { billingRemindersSlice } from "@/services/communication/billingRemindersCron";
import { checkSlice } from "@/services/world/sliceCheck";
import { billingService } from "@/services/billing";
import { turmasService } from "@/services/classes";
import { clientsService } from "@/services/clients";
import { communicationService } from "@/services/communication";
import { defaultMessageTemplates } from "@/mocks/seed";
import { fillMessage } from "@/lib/whatsapp";
import { chargeReminder, packageRemainingText } from "@/features/communication/message-values";
import { ACADEMY_ORG, createClass, createInstructor, createPlan, enrollStudent, resetAcademy } from "@/test/academy";

// "No servidor" so no teste da fila de envio: o resto do arquivo roda como no navegador.
const serverWorld = vi.hoisted(() => ({ on: false }));
vi.mock("@/services/world/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/world/store")>();
  return { ...original, inServerWorld: () => serverWorld.on || original.inServerWorld() };
});
const TODAY = "2026-09-22";

// WhatsApp com o numero do proprio espaco (docs/product/13, secao 5):
// assistido no gratis, oficial (API da Meta) no Pro com o numero conectado.

const tmpl = (key: string) => `tmpl-${ACADEMY_ORG}-${key}`;
const lastAudit = () => store.auditLog.at(-1)?.summary ?? "";

function message(overrides: Partial<SendMessagePayload> = {}): SendMessagePayload {
  return {
    recipientName: "Maria",
    recipientPhone: "(11) 97777-0000",
    content: "Oi, Maria!",
    ...overrides,
  };
}

function setTier(tier: "free" | "pro" | "scale") {
  store.organization.subscription = { tier };
  // Como o pagamento do plano faz no servidor (resetWhatsAppQuota): a franquia do plano.
  if (store.whatsAppConnection) {
    store.whatsAppConnection.monthlyQuota = { used: 0, included: tierWhatsAppQuota(tier) };
  }
}

/** Pro com o numero oficial conectado (telefone da unidade). */
async function connectOfficial() {
  setTier("pro");
  store.unit.phone = "1133334444";
  return communicationService.connectOfficial();
}

function at(time: string, date = TODAY) {
  vi.setSystemTime(new Date(`${date}T${time}:00`));
}

describe("conexao do WhatsApp", () => {
  beforeEach(() => resetAcademy());

  it("gratis fica no envio assistido, sem oficial", async () => {
    const view = await communicationService.getConnection();
    expect(view).toMatchObject({ mode: "assisted", canUseOfficial: false, officialStatus: "not_connected" });
  });

  it("Pro sem conectar continua assistido, mas pode usar o oficial", async () => {
    setTier("pro");
    expect(await communicationService.getConnection()).toMatchObject({ mode: "assisted", canUseOfficial: true });
  });

  it("Pro conectado vira oficial com o telefone da unidade e o nome do espaco", async () => {
    const view = await connectOfficial();
    expect(view).toMatchObject({
      mode: "official",
      officialStatus: "connected",
      phoneNumber: "551133334444",
      displayName: "Academia X",
    });
    expect(view.connectedAt).toBeDefined();
    expect(lastAudit()).toBe("Ana Ribeiro conectou o WhatsApp oficial do espaço");
  });

  it("Scale tambem tem o envio oficial", async () => {
    setTier("scale");
    store.unit.phone = "1133334444";
    expect((await communicationService.connectOfficial()).mode).toBe("official");
  });

  it("conectado mas de volta ao gratis cai para o assistido", async () => {
    await connectOfficial();
    setTier("free");
    expect(await communicationService.getConnection()).toMatchObject({
      mode: "assisted",
      canUseOfficial: false,
      officialStatus: "connected",
    });
  });

  it("gratis nao conecta o oficial", async () => {
    store.unit.phone = "1133334444";
    await expect(communicationService.connectOfficial()).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
      httpStatus: 403,
    });
    expect(store.whatsAppConnection?.officialStatus).toBe("not_connected");
  });

  it("sem telefone do espaco pede o cadastro antes de conectar", async () => {
    setTier("pro");
    await expect(communicationService.connectOfficial()).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "phoneNumber" }],
    });
    expect(store.whatsAppConnection?.officialStatus).toBe("not_connected");
  });

  it("cadastro guiado sem o numero confirmado pela Meta nao conecta nem inventa telefone", async () => {
    setTier("pro");
    store.unit.phone = undefined;
    await expect(communicationService.connectOfficial({ phoneNumberId: "123456789012345" })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "phoneNumber" }],
    });
    // Nunca o id do numero na Meta (ou um numero ficticio) como telefone do espaco.
    expect(store.unit.phone).toBeUndefined();
    expect(store.whatsAppConnection?.officialStatus).toBe("not_connected");
  });

  it("em producao, sem o numero de cada espaco, nada sai automatico nem conecta", async () => {
    await connectOfficial();
    expect((await communicationService.getConnection()).mode).toBe("official");
    vi.stubEnv("NODE_ENV", "production");
    try {
      // Ja conectado: o automatico pausa e o botao volta ao assistido.
      const view = await communicationService.getConnection();
      expect(view).toMatchObject({ officialAvailable: false, mode: "assisted" });
      expect(runBillingReminders()).toBe(0);
      await communicationService.disconnectOfficial();
      await expect(communicationService.connectOfficial()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("em producao com o cadastro da Meta, conecta so com as credenciais do proprio numero (doc technical/07 §1.1)", async () => {
    setTier("pro");
    store.unit.phone = undefined;
    const gateway = {
      connect: vi.fn(async () => ({ displayPhoneNumber: "+55 92 98888-7777", verifiedName: "Academia Ribeiro" })),
      disconnect: vi.fn(async () => undefined),
      configFor: vi.fn(async () => null),
    };
    setWhatsAppCredentialsGateway(gateway);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "123");
    vi.stubEnv("NEXT_PUBLIC_META_CONFIG_ID", "456");
    try {
      expect((await communicationService.getConnection()).officialAvailable).toBe(true);
      // Sem o cadastro guiado nao conecta: nada pelo numero da plataforma.
      await expect(communicationService.connectOfficial()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      expect(gateway.connect).not.toHaveBeenCalled();

      const view = await communicationService.connectOfficial({
        code: "one-time",
        phoneNumberId: "1111111111",
        wabaId: "2222222222",
        onboarding: "coexistence",
      });
      expect(gateway.connect).toHaveBeenCalledWith({
        organizationId: ACADEMY_ORG,
        code: "one-time",
        phoneNumberId: "1111111111",
        wabaId: "2222222222",
        businessId: undefined,
        onboarding: "coexistence",
      });
      expect(view).toMatchObject({
        officialStatus: "connected",
        mode: "official",
        phoneNumber: "5592988887777",
        displayName: "Academia Ribeiro",
      });
      expect(store.unit.phone).toBe("+5592988887777");

      await communicationService.disconnectOfficial();
      expect(gateway.disconnect).toHaveBeenCalledWith(ACADEMY_ORG);
    } finally {
      vi.unstubAllEnvs();
      setWhatsAppCredentialsGateway(null);
    }
  });

  it("falha na Meta ao conectar nao marca como conectado", async () => {
    setTier("pro");
    setWhatsAppCredentialsGateway({
      connect: vi.fn(async () => {
        throw new Error("Meta fora do ar");
      }),
      disconnect: vi.fn(),
      configFor: vi.fn(async () => null),
    });
    try {
      await expect(
        communicationService.connectOfficial({ code: "c", phoneNumberId: "1111111111", wabaId: "2222222222" }),
      ).rejects.toThrow();
      expect(store.whatsAppConnection?.officialStatus).toBe("not_connected");
    } finally {
      setWhatsAppCredentialsGateway(null);
    }
  });

  it("desconectar volta ao assistido e limpa numero e nome", async () => {
    await connectOfficial();
    const view = await communicationService.disconnectOfficial();
    expect(view).toMatchObject({ mode: "assisted", officialStatus: "not_connected" });
    expect(view.phoneNumber).toBeUndefined();
    expect(view.displayName).toBeUndefined();
    expect(view.connectedAt).toBeUndefined();
    expect(lastAudit()).toBe("Ana Ribeiro desconectou o WhatsApp oficial do espaço");
  });

  it("horario de envio e do Pro e o inicio vem antes do fim", async () => {
    const hours = { allowedSendHours: { start: "09:00", end: "18:00" } };
    await expect(communicationService.updateConnectionSettings(hours)).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
    });

    setTier("pro");
    for (const bad of [
      { start: "18:00", end: "09:00" },
      { start: "09:00", end: "09:00" },
      { start: "", end: "18:00" },
    ]) {
      await expect(
        communicationService.updateConnectionSettings({ allowedSendHours: bad }),
      ).rejects.toMatchObject({ code: "VALIDATION", fields: [{ field: "allowedSendHours" }] });
    }
    expect(store.whatsAppConnection?.allowedSendHours).toEqual({ start: "08:00", end: "20:00" });

    const view = await communicationService.updateConnectionSettings(hours);
    expect(view.allowedSendHours).toEqual({ start: "09:00", end: "18:00" });
  });
});

describe("modelos de mensagem", () => {
  beforeEach(() => resetAcademy());

  it("lista em ordem de prazo, do antes do vencimento ao critico", async () => {
    const list = await communicationService.listTemplates();
    expect(list.map((t) => t.daysOffset)).toEqual([...list.map((t) => t.daysOffset)].sort((a, b) => a - b));
    expect(list[0].trigger).toBe("billing_before_due");
    expect(list.at(-1)?.trigger).toBe("billing_critical");
  });

  it("modelos sumidos sao recriados com o texto padrao", async () => {
    store.messageTemplates = [];
    expect(await communicationService.listTemplates()).toHaveLength(16);
  });

  it("modelo novo da plataforma entra no espaço antigo sem apagar os que ele já tem", async () => {
    const before = await communicationService.listTemplates();
    store.messageTemplates = before.filter((t) => t.trigger !== "trial_follow_up");
    const after = await communicationService.listTemplates();
    expect(after).toHaveLength(before.length);
    expect(after.find((t) => t.trigger === "trial_follow_up")).toMatchObject({ category: "retention", enabled: false });
  });

  it("modelos so de envio manual: desligados, com a categoria de cada um", async () => {
    const list = await communicationService.listTemplates();
    const manual = (trigger: string) => list.find((t) => t.trigger === trigger);
    expect(manual("payment_received")).toMatchObject({ id: tmpl("payment-received"), category: "billing", enabled: false });
    expect(manual("level_up")).toMatchObject({
      category: "retention",
      enabled: false,
      availableVariables: expect.arrayContaining(["{nivel}"]),
    });
    for (const trigger of ["class_canceled", "schedule_change", "holiday_notice"]) {
      expect(manual(trigger)).toMatchObject({ category: "administrative", enabled: false });
    }
  });

  it("textos dos modelos manuais seguem a area do espaco", () => {
    const fill = (segment: "martial_arts" | "music", trigger: string, values: Record<string, string> = {}) => {
      const template = defaultMessageTemplates(ACADEMY_ORG, segment).find((t) => t.trigger === trigger)!;
      return fillMessage(template.content, { aluno: "Ana", empresa: "Espaço", ...values }).replace(/\u00a0/g, " ");
    };
    expect(fill("music", "payment_received", { valor: "R$ 150,00", referencia: "mensalidade de outubro" })).toBe(
      "Oi, Ana! Recebemos o pagamento de R$ 150,00 da mensalidade de outubro. Obrigado! Boas aulas!",
    );
    expect(fill("martial_arts", "level_up", { nivel: "Faixa Azul" })).toBe(
      "Parabéns, Ana! 🎉 Nova conquista na Espaço: Faixa Azul. É resultado da sua dedicação. Bons treinos! 🥋",
    );
    expect(fill("martial_arts", "class_canceled")).toBe(
      "Oi, Ana! O treino de hoje na Espaço foi cancelado. Desculpe o transtorno, nos vemos no próximo treino!",
    );
    expect(fill("music", "class_canceled")).toContain("A aula de hoje na Espaço foi cancelada.");
    expect(fill("music", "schedule_change")).toBe(
      "Oi, Ana! Aviso de Espaço: sua turma vai mudar de horário. Novo horário:",
    );
    expect(fill("music", "holiday_notice")).toContain("no feriado não teremos aula.");
    expect(fill("martial_arts", "holiday_notice")).toContain("no feriado não teremos treino.");
  });

  it("modelo manual tem texto livre, mas nao liga envio automatico nem no Pro", async () => {
    expect(
      (await communicationService.updateTemplate({ id: tmpl("holiday-notice"), content: "Sem aula, {aluno}." })).content,
    ).toBe("Sem aula, {aluno}.");
    setTier("pro");
    await expect(
      communicationService.updateTemplate({ id: tmpl("holiday-notice"), enabled: true }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("tem o lembrete de cobrança (avulsa, curso e pacote) e o pacote acabando", async () => {
    const list = await communicationService.listTemplates();
    expect(list.find((t) => t.trigger === "charge_reminder")).toMatchObject({
      id: tmpl("charge-reminder"),
      category: "billing",
      title: "Lembrete de cobrança",
      availableVariables: expect.arrayContaining(["{referencia}", "{valor}", "{vencimento}", "{link_pagamento}"]),
    });
    expect(list.find((t) => t.trigger === "package_ending")).toMatchObject({
      id: tmpl("package-ending"),
      category: "retention",
      title: "Pacote acabando",
      availableVariables: expect.arrayContaining(["{pacote}", "{restante}"]),
    });
  });

  it("textos padrao dos modelos novos saem completos (sem o link quando nao ha cobranca online)", () => {
    const templates = defaultMessageTemplates(ACADEMY_ORG, "gastronomy");
    const reminder = templates.find((t) => t.trigger === "charge_reminder")!;
    const values = chargeReminder(
      { kind: "package", status: "pending", amountCents: 15000, dueDate: "2026-10-20", description: "10 aulas" },
      TODAY,
    )!.values;
    expect(fillMessage(reminder.content, { aluno: "Ana", empresa: "Ateliê", ...values }).replace(/\u00a0/g, " ")).toBe(
      "Olá, Ana! Lembrete da compra do pacote 10 aulas de R$ 150,00 na Ateliê, com vencimento em 20/10. Boas aulas!",
    );
    const ending = templates.find((t) => t.trigger === "package_ending")!;
    const restante = packageRemainingText({ lessonsTotal: 10, lessonsUsed: 9, status: "active" }, TODAY);
    expect(fillMessage(ending.content, { aluno: "Ana", empresa: "Ateliê", pacote: "10 aulas", restante })).toBe(
      "Oi, Ana! Sobre seu pacote 10 aulas na Ateliê: resta 1 aula. Quer renovar e seguir com as aulas?",
    );
  });

  it("os modelos novos tem texto livre no gratis e automacao so no Pro", async () => {
    const updated = await communicationService.updateTemplate({
      id: tmpl("charge-reminder"),
      content: "Oi, {aluno}! Falta a {referencia}.",
    });
    expect(updated.content).toBe("Oi, {aluno}! Falta a {referencia}.");
    await expect(
      communicationService.updateTemplate({ id: tmpl("package-ending"), enabled: false }),
    ).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
    setTier("pro");
    expect(await communicationService.updateTemplate({ id: tmpl("package-ending"), enabled: false })).toMatchObject({
      enabled: false,
    });
  });

  it("texto e livre no gratis (o assistido usa o mesmo texto)", async () => {
    const updated = await communicationService.updateTemplate({ id: tmpl("birthday"), content: "  Parabéns, {aluno}!  " });
    expect(updated.content).toBe("Parabéns, {aluno}!");
    expect(lastAudit()).toBe('Ana Ribeiro atualizou a mensagem "Aniversário"');
  });

  it("envio automatico, horario e prazo sao do Pro", async () => {
    for (const change of [{ enabled: false }, { sendHour: "10:00" }, { daysOffset: 5 }]) {
      await expect(
        communicationService.updateTemplate({ id: tmpl("birthday"), ...change }),
      ).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN", httpStatus: 403 });
    }
    const t = store.messageTemplates.find((x) => x.id === tmpl("birthday"));
    expect(t).toMatchObject({ enabled: true, sendHour: "08:30", daysOffset: 0 });
  });

  it("gratis pode salvar o formulario com os mesmos valores de automacao", async () => {
    const updated = await communicationService.updateTemplate({
      id: tmpl("birthday"),
      enabled: true,
      sendHour: "08:30",
      daysOffset: 0,
      content: "Feliz aniversário, {aluno}!",
    });
    expect(updated.content).toBe("Feliz aniversário, {aluno}!");
  });

  it("Pro liga, desliga e muda horario e prazo", async () => {
    setTier("pro");
    const updated = await communicationService.updateTemplate({
      id: tmpl("critical"),
      enabled: true,
      sendHour: "12:00",
      daysOffset: 15,
    });
    expect(updated).toMatchObject({ enabled: true, sendHour: "12:00", daysOffset: 15 });
  });

  it("texto vazio e modelo inexistente sao recusados", async () => {
    await expect(communicationService.updateTemplate({ id: tmpl("birthday"), content: "   " })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "content" }],
    });
    await expect(communicationService.updateTemplate({ id: "tmpl-x", content: "Oi" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      httpStatus: 404,
    });
  });
});

describe("envio assistido", () => {
  beforeEach(() => resetAcademy());

  it("registra Aberto no WhatsApp com aluno e cobranca, sem gastar franquia", async () => {
    const log = await communicationService.registerAssistedMessage(
      message({ trigger: "billing_due_date", clientId: "cli-1", chargeId: "chg-1", content: "  Vence hoje.  " }),
    );
    expect(log).toMatchObject({
      status: "opened",
      organizationId: ACADEMY_ORG,
      recipientPhone: "5511977770000",
      trigger: "billing_due_date",
      category: "billing",
      clientId: "cli-1",
      chargeId: "chg-1",
      content: "Vence hoje.",
    });
    expect(store.messageLogs[0].id).toBe(log.id);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(0);
    expect(lastAudit()).toContain("abriu no WhatsApp uma mensagem para Maria");
  });

  it("funciona no gratis e tambem no Pro conectado, sem gastar franquia", async () => {
    await connectOfficial();
    await communicationService.registerAssistedMessage(message());
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(0);
  });

  it("sem gatilho e mensagem administrativa; retencao para boas-vindas", async () => {
    const manual = await communicationService.registerAssistedMessage(message());
    expect(manual).toMatchObject({ trigger: "manual_broadcast", category: "administrative" });
    const welcome = await communicationService.registerAssistedMessage(message({ trigger: "welcome_student" }));
    expect(welcome.category).toBe("retention");
  });

  it("lembrete de cobranca e de cobranca; pacote acabando e de relacionamento", async () => {
    const reminder = await communicationService.registerAssistedMessage(
      message({ trigger: "charge_reminder", clientId: "cli-1", chargeId: "chg-9" }),
    );
    expect(reminder).toMatchObject({ trigger: "charge_reminder", category: "billing", chargeId: "chg-9", status: "opened" });
    const ending = await communicationService.registerAssistedMessage(
      message({ trigger: "package_ending", clientId: "cli-1" }),
    );
    expect(ending).toMatchObject({ trigger: "package_ending", category: "retention", status: "opened" });
    const logs = await communicationService.listLogs({ trigger: "package_ending" });
    expect(logs.map((l) => l.id)).toEqual([ending.id]);
  });

  it("pagamento recebido e de cobranca; avanco, de relacionamento; avisos, administrativos", async () => {
    const send = (trigger: SendMessagePayload["trigger"]) =>
      communicationService.registerAssistedMessage(message({ trigger, clientId: "cli-1" }));
    expect((await send("payment_received")).category).toBe("billing");
    expect((await send("level_up")).category).toBe("retention");
    expect((await send("class_canceled")).category).toBe("administrative");
    expect((await send("schedule_change")).category).toBe("administrative");
    expect((await send("holiday_notice")).category).toBe("administrative");
  });

  it("nao guarda aluno nem cobranca quando nao vieram", async () => {
    const log = await communicationService.registerAssistedMessage(message());
    expect("clientId" in log).toBe(false);
    expect("chargeId" in log).toBe(false);
  });

  it("valida destinatario, WhatsApp com DDD e texto", async () => {
    await expect(
      communicationService.registerAssistedMessage({ recipientName: " ", recipientPhone: "97777-0000", content: " " }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "recipientName" }, { field: "recipientPhone" }, { field: "content" }],
    });
    expect(store.messageLogs).toHaveLength(0);
  });
});

describe("envio automatico (oficial)", () => {
  beforeEach(() => resetAcademy());

  it("gratis nao envia automatico", async () => {
    await expect(communicationService.sendMessage(message())).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
      httpStatus: 403,
    });
  });

  it("Pro sem o numero conectado pede a conexao", async () => {
    setTier("pro");
    await expect(communicationService.sendMessage(message())).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      httpStatus: 409,
    });
    expect(store.messageLogs).toHaveLength(0);
  });

  it("no servidor com a Meta configurada, o registro nasce 'Na fila' e a entrega fica para depois da gravação (01/11/2026)", async () => {
    await connectOfficial();
    const configured = vi.spyOn(whatsappClient, "configFor").mockResolvedValue({});
    const jobs: QueuedMessageJob[] = [];
    setQueuedMessageDeliverer(async (job) => {
      jobs.push(job);
    });
    const effects: WorldEffect[] = [];
    setEffectsResolver(() => effects);
    serverWorld.on = true;
    try {
      const log = await communicationService.sendMessage(message({ clientId: "cli-1" }));
      expect(log.status).toBe("queued");
      expect(store.whatsAppConnection?.monthlyQuota.used).toBe(1);
      // A Meta ainda nao foi chamada: so no efeito, depois da gravacao e da resposta.
      expect(effects).toHaveLength(1);
      expect(jobs).toHaveLength(0);
      await effects[0]();
      expect(jobs).toEqual([{ logId: log.id, organizationId: ACADEMY_ORG, phone: log.recipientPhone, content: "Oi, Maria!" }]);
    } finally {
      serverWorld.on = false;
      setEffectsResolver(() => undefined);
      setQueuedMessageDeliverer(null);
      configured.mockRestore();
    }
  });

  it("Pro conectado envia, conta na franquia e audita", async () => {
    await connectOfficial();
    const log = await communicationService.sendMessage(message({ trigger: "absence_alert", clientId: "cli-1" }));
    expect(log).toMatchObject({ status: "delivered", category: "retention", clientId: "cli-1" });
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(1);
    expect(lastAudit()).toBe("Ana Ribeiro enviou mensagem de WhatsApp para Maria");
  });

  it("mensagem invalida nao gasta franquia", async () => {
    await connectOfficial();
    await expect(communicationService.sendMessage(message({ recipientPhone: "123" }))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(0);
  });

  it("reenviar falha e do Pro e marca como entregue", async () => {
    await connectOfficial();
    const log = await communicationService.sendMessage(message());
    const stored = store.messageLogs.find((l) => l.id === log.id)!;
    stored.status = "failed";
    stored.errorReason = "Número inválido";

    setTier("free");
    await expect(communicationService.retryFailedMessage(log.id)).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });

    setTier("pro");
    const retried = await communicationService.retryFailedMessage(log.id);
    expect(retried.status).toBe("delivered");
    expect(retried.errorReason).toBeUndefined();
    await expect(communicationService.retryFailedMessage("msg-x")).rejects.toMatchObject({ code: "NOT_FOUND" });

    stored.status = "failed";
    await communicationService.disconnectOfficial();
    await expect(communicationService.retryFailedMessage(log.id)).rejects.toMatchObject({ httpStatus: 409 });
    expect(stored.status).toBe("failed");
  });
});

describe("parabens automatico", () => {
  beforeEach(() => resetAcademy());

  async function birthdayStudent(
    name = "Bia",
    overrides: { phone?: string; birthDate?: string; whatsappConsentStatus?: "unknown" | "granted" | "revoked" } = {},
  ) {
    return clientsService.create({
      name,
      phone: overrides.phone ?? "11977770000",
      birthDate: overrides.birthDate ?? "2000-09-22",
      // O automatico so sai para quem autorizou (doc product/27 M1).
      whatsappConsentStatus: overrides.whatsappConsentStatus ?? "granted",
      status: "active",
    });
  }

  const greetings = () => store.messageLogs.filter((l) => l.trigger === "birthday_greeting");
  /** O que a rotina de hora em hora roda em cada espaco. */
  const greet = () => runBirthdayGreetings();

  it("no oficial envia um por aluno no dia, preenchendo aluno e empresa", async () => {
    const bia = await birthdayStudent();
    await connectOfficial();

    // Abrir o historico nao envia (a leitura nao grava); a rotina de hora em hora envia.
    expect(await communicationService.listLogs()).toHaveLength(0);
    expect(greet()).toBe(1);
    const logs = await communicationService.listLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      trigger: "birthday_greeting",
      category: "retention",
      status: "delivered",
      clientId: bia.id,
      recipientName: "Bia",
      recipientPhone: "5511977770000",
    });
    expect(logs[0].content).toContain("Parabéns pelo seu dia, Bia!");
    expect(logs[0].content).toContain("equipe da Academia X");
    expect(logs[0].content).not.toMatch(/\{\w+\}/);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(1);

    // A rotina de novo no mesmo dia nao duplica.
    greet();
    at("19:00");
    greet();
    expect(greetings()).toHaveLength(1);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(1);
  });

  it("sem a autorização do aluno (ou depois do SAIR) o automático não sai", async () => {
    await birthdayStudent("Sem registro", { whatsappConsentStatus: "unknown" });
    await birthdayStudent("Pediu para parar", { phone: "11977770001", whatsappConsentStatus: "revoked" });
    const bia = await birthdayStudent("Bia", { phone: "11977770002" });
    await connectOfficial();
    expect(greet()).toBe(1);
    expect(greetings().map((l) => l.clientId)).toEqual([bia.id]);
  });

  it("envio oficial pela tela recusa aluno sem autorização e explica", async () => {
    const semRegistro = await birthdayStudent("Caio", { whatsappConsentStatus: "unknown" });
    const parou = await birthdayStudent("Duda", { phone: "11977770003", whatsappConsentStatus: "revoked" });
    const bia = await birthdayStudent("Bia", { phone: "11977770004" });
    await connectOfficial();
    const send = (clientId: string, name: string) =>
      communicationService.sendMessage({ recipientName: name, recipientPhone: "11977770009", content: "Oi", clientId });
    await expect(send(semRegistro.id, "Caio")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("ainda não autorizou"),
    });
    await expect(send(parou.id, "Duda")).rejects.toMatchObject({ message: expect.stringContaining("pediu para não receber") });
    await expect(send(bia.id, "Bia")).resolves.toMatchObject({ clientId: bia.id });
  });

  it("usa o texto editado do modelo", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), content: "Feliz dia, {aluno}! Abraço da {empresa}." });
    greet();
    expect(greetings()[0].content).toBe("Feliz dia, Bia! Abraço da Academia X.");
  });

  it("no assistido (gratis ou Pro sem conectar) nao envia", async () => {
    await birthdayStudent();
    greet();
    setTier("pro");
    greet();
    expect(greetings()).toHaveLength(0);
  });

  it("regra desligada nao envia", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), enabled: false });
    greet();
    expect(greetings()).toHaveLength(0);
  });

  it("so a partir do horario da regra", async () => {
    await birthdayStudent();
    await connectOfficial();
    at("08:29");
    greet();
    expect(greetings()).toHaveLength(0);
    at("08:30");
    greet();
    expect(greetings()).toHaveLength(1);
  });

  it("horario editado da regra vale", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), sendHour: "15:00" });
    greet();
    expect(greetings()).toHaveLength(0);
    at("15:00");
    greet();
    expect(greetings()).toHaveLength(1);
  });

  it("ignora inativo, sem WhatsApp e quem nao faz aniversario hoje", async () => {
    const inactive = await birthdayStudent("Inativo");
    await clientsService.remove(inactive.id);
    await birthdayStudent("Sem fone", { phone: "1234" });
    await birthdayStudent("Amanha", { birthDate: "2000-09-23" });
    await birthdayStudent("Hoje");
    await connectOfficial();
    greet();
    expect(greetings().map((l) => l.recipientName)).toEqual(["Hoje"]);
  });

  it("no dia seguinte o aluno do dia anterior nao recebe de novo", async () => {
    await birthdayStudent();
    await connectOfficial();
    greet();
    at("12:00", "2026-09-23");
    greet();
    expect(greetings()).toHaveLength(1);
  });

  it("parabens ja aberto no WhatsApp (assistido) no dia nao repete no automatico", async () => {
    const bia = await birthdayStudent();
    await communicationService.registerAssistedMessage(
      message({ recipientName: "Bia", trigger: "birthday_greeting", clientId: bia.id, content: "Parabéns!" }),
    );
    await connectOfficial();
    greet();
    expect(greetings().map((l) => l.status)).toEqual(["opened"]);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(0);
  });

  it("recorte da rotina (servidor) igual ao espaço inteiro", async () => {
    const bia = await birthdayStudent("Bia");
    await birthdayStudent("Caio");
    await birthdayStudent("Amanha", { birthDate: "2000-09-23" });
    await communicationService.registerAssistedMessage(
      message({ recipientName: "Bia", trigger: "birthday_greeting", clientId: bia.id, content: "Parabéns!" }),
    );
    await communicationService.registerAssistedMessage(message({ recipientName: "Caio", content: "Oi" }));
    await connectOfficial();
    await checkSlice("cron.birthdayGreetings", birthdayGreetingsSlice, [], async () => runBirthdayGreetings());
  });

  it("dois alunos no mesmo dia recebem um cada", async () => {
    await birthdayStudent("Bia");
    await birthdayStudent("Caio");
    await connectOfficial();
    greet();
    expect(greetings().map((l) => l.recipientName).sort()).toEqual(["Bia", "Caio"]);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(2);
  });
});

describe("historico", () => {
  beforeEach(() => resetAcademy());

  it("filtra por gatilho, situacao e busca (nome, telefone ou texto), mais novo primeiro", async () => {
    await communicationService.registerAssistedMessage(message({ recipientName: "Ana", trigger: "billing_due_date" }));
    at("13:00");
    await communicationService.registerAssistedMessage(
      message({ recipientName: "Bruno", recipientPhone: "21988881111", content: "Bem-vindo!", trigger: "welcome_student" }),
    );

    expect((await communicationService.listLogs()).map((l) => l.recipientName)).toEqual(["Bruno", "Ana"]);
    expect((await communicationService.listLogs({ trigger: "billing_due_date" })).map((l) => l.recipientName)).toEqual([
      "Ana",
    ]);
    expect(await communicationService.listLogs({ trigger: "all", status: "delivered" })).toHaveLength(0);
    expect(await communicationService.listLogs({ status: "opened" })).toHaveLength(2);
    expect((await communicationService.listLogs({ search: "bru" })).map((l) => l.recipientName)).toEqual(["Bruno"]);
    expect((await communicationService.listLogs({ search: "(21) 98888" })).map((l) => l.recipientName)).toEqual([
      "Bruno",
    ]);
    expect((await communicationService.listLogs({ search: "bem-vindo" })).map((l) => l.recipientName)).toEqual([
      "Bruno",
    ]);
  });
});

describe("numeros do mes", () => {
  beforeEach(() => resetAcademy());

  it("assistido conta as abertas no WhatsApp, sem taxa de entrega", async () => {
    await communicationService.registerAssistedMessage(message());
    await communicationService.registerAssistedMessage(message());
    // Falha (de quando estava no oficial) nao conta como aberta (ALU-25).
    const failed = await communicationService.registerAssistedMessage(message());
    store.messageLogs.find((l) => l.id === failed.id)!.status = "failed";
    const metrics = await communicationService.getMetrics();
    // Gratis: sem envio automatico, franquia 0 (Pro 300, Expansao 1.000).
    expect(metrics).toMatchObject({
      mode: "assisted",
      messagesThisMonth: 2,
      monthlyQuota: 0,
      deliveryRate: null,
      readRate: null,
      recoveredAmountCents: 0,
    });
  });

  it("automacoes ativas = modelos ligados", async () => {
    // Padrao: so o atraso critico vem desligado.
    expect((await communicationService.getMetrics()).activeAutomationsCount).toBe(8);
    setTier("pro");
    await communicationService.updateTemplate({ id: tmpl("welcome"), enabled: false });
    expect((await communicationService.getMetrics()).activeAutomationsCount).toBe(7);
  });

  it("oficial conta so as enviadas e calcula entrega e leitura", async () => {
    await connectOfficial();
    await communicationService.registerAssistedMessage(message());
    for (let i = 0; i < 4; i++) await communicationService.sendMessage(message());
    const sent = store.messageLogs.filter((l) => l.status === "delivered");
    sent[0].status = "read";
    sent[1].status = "failed";

    const metrics = await communicationService.getMetrics();
    expect(metrics).toMatchObject({ mode: "official", messagesThisMonth: 4, deliveryRate: 75, readRate: 25 });
  });

  it("mensagens de outro mes ficam fora", async () => {
    await communicationService.registerAssistedMessage(message());
    at("12:00", "2026-10-01");
    expect((await communicationService.getMetrics()).messagesThisMonth).toBe(0);
  });

  it("recuperado = mensalidade paga no mes depois de lembrete ligado a ela ou ao aluno", async () => {
    const plan = await createPlan("monthly", 15000);
    const linked = await enrollStudent({ name: "Ligado", plan, startDate: "2026-09-01" });
    const byStudent = await enrollStudent({ name: "Pelo aluno", plan, startDate: "2026-09-01" });
    const paidBefore = await enrollStudent({ name: "Pagou antes", plan, startDate: "2026-09-01" });
    const noReminder = await enrollStudent({ name: "Sem lembrete", plan, startDate: "2026-09-01" });
    const chargeOf = (studentId: string) => store.charges.find((c) => c.studentId === studentId)!;

    // "Pagou antes" paga as 11h e so recebe o lembrete as 12h.
    at("11:00");
    await billingService.markPaid(chargeOf(paidBefore.id).id);
    at("12:00");
    await communicationService.registerAssistedMessage(
      message({ trigger: "billing_after_due", clientId: linked.id, chargeId: chargeOf(linked.id).id }),
    );
    await communicationService.registerAssistedMessage(message({ trigger: "billing_after_due", clientId: byStudent.id }));
    await communicationService.registerAssistedMessage(message({ trigger: "billing_after_due", clientId: paidBefore.id }));
    // Mensagem que nao e de cobranca nao conta.
    await communicationService.registerAssistedMessage(message({ trigger: "absence_alert", clientId: noReminder.id }));

    at("15:00");
    for (const s of [linked, byStudent, noReminder]) await billingService.markPaid(chargeOf(s.id).id);

    const amounts = [linked, byStudent].map((s) => chargeOf(s.id).amountCents);
    const metrics = await communicationService.getMetrics();
    expect(metrics.recoveredAmountCents).toBe(amounts[0] + amounts[1]);
    expect(metrics.recoveredAmountCents).toBeGreaterThan(0);
  });

  it("pagamento recebido antes da proxima mensalidade nao conta como lembrete", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ name: "Aluno", plan, startDate: "2026-09-01" });
    const charge = store.charges.find((c) => c.studentId === student.id)!;
    await communicationService.registerAssistedMessage(message({ trigger: "payment_received", clientId: student.id }));
    at("15:00");
    await billingService.markPaid(charge.id);
    expect((await communicationService.getMetrics()).recoveredAmountCents).toBe(0);
  });

  it("lembrete ligado a outra cobranca nao conta para o aluno", async () => {
    const plan = await createPlan("monthly", 15000);
    const student = await enrollStudent({ name: "Aluno", plan, startDate: "2026-09-01" });
    const charge = store.charges.find((c) => c.studentId === student.id)!;
    await communicationService.registerAssistedMessage(
      message({ trigger: "billing_due_date", clientId: student.id, chargeId: "chg-outra" }),
    );
    at("15:00");
    await billingService.markPaid(charge.id);
    expect((await communicationService.getMetrics()).recoveredAmountCents).toBe(0);
  });
});

describe("limite de caracteres com emoji (ALU-38)", () => {
  beforeEach(() => resetAcademy());

  it("emoji conta 1 na mensagem (1000) e no modelo (900)", async () => {
    await communicationService.registerAssistedMessage(message({ content: "🥋".repeat(1000) }));
    await expect(
      communicationService.registerAssistedMessage(message({ content: "🥋".repeat(1001) })),
    ).rejects.toMatchObject({ fields: [{ field: "content", message: "Use no máximo 1000 caracteres." }] });

    const id = tmpl("birthday");
    await communicationService.updateTemplate({ id, content: "🎉".repeat(900) });
    await expect(communicationService.updateTemplate({ id, content: "🎉".repeat(901) })).rejects.toMatchObject({
      fields: [{ field: "content", message: "Use no máximo 900 caracteres." }],
    });
  });

  it("valida formato de horario e faixa de prazo ao atualizar modelo no Pro", async () => {
    setTier("pro");
    await expect(communicationService.updateTemplate({ id: tmpl("before-due"), sendHour: "25:99" })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "sendHour" }],
    });
    await expect(communicationService.updateTemplate({ id: tmpl("before-due"), daysOffset: 3 })).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "daysOffset" }],
    });
  });
});

describe("lembretes automaticos de cobranca (oficial)", () => {
  beforeEach(() => resetAcademy());

  it("separa mensalidade (`billing_*`), outras cobrancas (`charge_reminder`) e ignora avulsa de aula (`dropin`)", async () => {
    at("12:00");
    await connectOfficial();
    const plan = await createPlan("monthly", 18000);
    const student = await clientsService.create({
      name: "Lucas Silva",
      phone: "11999990001",
      status: "active",
      whatsappConsentStatus: "granted",
    });
    store.charges.push({
      id: "chg-membership-1",
      organizationId: ACADEMY_ORG,
      studentId: student.id,
      kind: "membership",
      planId: plan.id,
      dueDate: "2026-09-25",
      amountCents: 18000,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await billingService.createExtraCharge({
      studentId: student.id,
      description: "Kimono",
      totalCents: 25000,
      firstDueDate: "2026-09-25",
      installments: 1,
    });
    store.charges.push({
      id: "chg-dropin-1",
      organizationId: ACADEMY_ORG,
      studentId: student.id,
      kind: "dropin",
      dueDate: "2026-09-25",
      amountCents: 5000,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await checkSlice("cron.billingReminders", billingRemindersSlice, [], async () => runBillingReminders());
    const sent = runBillingReminders();
    expect(sent).toBe(2);

    const triggers = store.messageLogs.map((l) => l.trigger).sort();
    expect(triggers).toEqual(["billing_before_due", "charge_reminder"]);
    const reminder = store.messageLogs.find((l) => l.trigger === "charge_reminder");
    expect(reminder?.content).toContain("cobrança Kimono");
    expect(reminder?.content).not.toContain("{referencia}");
  });
});

describe("envio por modelo aprovado da Meta (doc technical/07 §3.3)", () => {
  beforeEach(() => resetAcademy());

  /** Liga a fila como no servidor e devolve as entregas pedidas depois da gravacao. */
  function serverQueue() {
    const jobs: QueuedMessageJob[] = [];
    const effects: WorldEffect[] = [];
    setQueuedMessageDeliverer(async (job) => {
      jobs.push(job);
    });
    setEffectsResolver(() => effects);
    const configured = vi.spyOn(whatsappClient, "configFor").mockResolvedValue({});
    serverWorld.on = true;
    return {
      jobs,
      flush: async () => {
        for (const effect of effects.splice(0)) await effect();
      },
      stop: () => {
        serverWorld.on = false;
        setEffectsResolver(() => undefined);
        setQueuedMessageDeliverer(null);
        configured.mockRestore();
      },
    };
  }

  it("texto do modelo usa o modelo, com as variaveis na ordem; texto editado ou variavel vazia, nao", async () => {
    const template = store.messageTemplates.find((t) => t.trigger === "welcome_student")!;
    template.content = "Olá {aluno}! Bem-vindo ao {empresa}, {aluno}.";
    const variables = { aluno: "Maria", empresa: "Academia Ribeiro" };
    const content = fillMessage(template.content, variables);
    expect(officialTemplateFor("welcome_student", content, variables)).toEqual({
      name: "welcome_student",
      language: "pt_BR",
      params: ["Maria", "Academia Ribeiro", "Maria"],
    });
    expect(officialTemplateFor("welcome_student", `${content} Até logo!`, variables)).toBeUndefined();
    expect(officialTemplateFor("welcome_student", content, undefined)).toBeUndefined();
    expect(officialTemplateFor("manual_broadcast", content, variables)).toBeUndefined();
    const withoutName = fillMessage(template.content, { aluno: "", empresa: "Academia Ribeiro" });
    expect(officialTemplateFor("welcome_student", withoutName, { aluno: "", empresa: "Academia Ribeiro" })).toBeUndefined();
  });

  it("envio manual do modelo vai para a fila com o modelo; o reenvio repete o mesmo modelo", async () => {
    await connectOfficial();
    const template = store.messageTemplates.find((t) => t.trigger === "welcome_student")!;
    template.content = "Olá, {aluno}! Bem-vindo ao {empresa}.";
    const variables = { aluno: "Maria", empresa: store.organization.name };
    const content = fillMessage(template.content, variables);
    const queue = serverQueue();
    try {
      const log = await communicationService.sendMessage(
        message({ trigger: "welcome_student", clientId: "cli-1", content, variables }),
      );
      expect(log.status).toBe("queued");
      expect(log.metaTemplate?.name).toBe("welcome_student");
      await queue.flush();
      expect(queue.jobs[0]?.template).toEqual(log.metaTemplate);

      const stored = store.messageLogs.find((l) => l.id === log.id)!;
      stored.status = "failed";
      stored.errorReason = "Falhou";
      const retried = await communicationService.retryFailedMessage(log.id);
      expect(retried.status).toBe("queued");
      await queue.flush();
      expect(queue.jobs[1]).toMatchObject({ logId: log.id, template: log.metaTemplate });
    } finally {
      queue.stop();
    }
  });

  it("mensagem avulsa sai como texto livre (sem modelo)", async () => {
    await connectOfficial();
    const queue = serverQueue();
    try {
      const log = await communicationService.sendMessage(message({ clientId: "cli-1" }));
      expect(log.metaTemplate).toBeUndefined();
      await queue.flush();
      expect(queue.jobs[0]?.template).toBeUndefined();
    } finally {
      queue.stop();
    }
  });

  it("lembrete automatico no servidor vai para a fila com o modelo (antes so gravava Entregue)", async () => {
    at("12:00");
    await connectOfficial();
    const plan = await createPlan("monthly", 18000);
    const student = await clientsService.create({
      name: "Lucas Silva",
      phone: "11999990001",
      status: "active",
      whatsappConsentStatus: "granted",
    });
    store.charges.push({
      id: "chg-membership-1",
      organizationId: ACADEMY_ORG,
      studentId: student.id,
      kind: "membership",
      planId: plan.id,
      dueDate: "2026-09-25",
      amountCents: 18000,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.organization.settings = {
      ...store.organization.settings,
      onlinePayments: { ...store.organization.settings?.onlinePayments, enabled: true },
    } as typeof store.organization.settings;
    const queue = serverQueue();
    try {
      expect(runBillingReminders()).toBe(1);
      const log = store.messageLogs[0]!;
      expect(log).toMatchObject({ trigger: "billing_before_due", status: "queued" });
      expect(log.metaTemplate).toMatchObject({ name: "billing_before_due", language: "pt_BR" });
      expect(log.metaTemplate?.params).toContain("Lucas Silva");
      await queue.flush();
      expect(queue.jobs).toEqual([
        expect.objectContaining({ logId: log.id, phone: log.recipientPhone, template: log.metaTemplate }),
      ]);
    } finally {
      queue.stop();
    }
  });
});

describe("modelos na conta do WhatsApp do espaco (doc technical/07 §1.4)", () => {
  beforeEach(() => resetAcademy());

  it("o modelo na Meta deixa de fora a frase da variavel que o espaco nunca preenche", () => {
    const welcome = store.messageTemplates.find((t) => t.trigger === "welcome_student")!;
    expect(welcome.content).toContain("{link_app}");
    expect(metaBodyFor(welcome)).not.toContain("{link_app}");
    // As boas-vindas do jeito que a tela monta agora cabem no modelo.
    const variables = { aluno: "Maria", empresa: store.organization.name };
    const content = fillMessage(welcome.content, variables);
    expect(officialTemplateFor("welcome_student", content, variables)?.params).toEqual([store.organization.name, "Maria"]);

    const reminder = store.messageTemplates.find((t) => t.trigger === "billing_before_due")!;
    store.organization.settings = { ...store.organization.settings, onlinePayments: { enabled: false } } as typeof store.organization.settings;
    expect(metaBodyFor(reminder)).not.toContain("{link_pagamento}");
    store.organization.settings = { ...store.organization.settings, onlinePayments: { enabled: true } } as typeof store.organization.settings;
    expect(metaBodyFor(reminder)).toContain("{link_pagamento}");
  });

  it("cria o que falta, edita o texto que mudou e so atualiza a situacao do que ja esta igual", async () => {
    const list = vi.spyOn(whatsappClient, "listTemplates").mockResolvedValue([
      { name: "welcome_student", id: "meta-welcome", status: "APPROVED", category: "MARKETING", language: "pt_BR" },
    ]);
    const create = vi
      .spyOn(whatsappClient, "createOrUpdateTemplate")
      .mockImplementation(async (payload) => ({ id: `meta-${payload.name}`, status: "PENDING" }));
    const edit = vi.spyOn(whatsappClient, "editTemplate").mockResolvedValue({ id: "meta-welcome", status: "PENDING" });
    try {
      const first = await syncMetaTemplates({});
      const automatic = store.messageTemplates.filter((t) => t.trigger !== "manual_broadcast");
      expect(first).toEqual({ created: automatic.length - 1, edited: 1, failed: 0 });
      expect(edit).toHaveBeenCalledWith("meta-welcome", expect.not.stringContaining("{link_app}"), {});
      const welcome = store.messageTemplates.find((t) => t.trigger === "welcome_student")!;
      expect(welcome).toMatchObject({ metaTemplateId: "meta-welcome", metaStatus: "PENDING", metaBody: metaBodyFor(welcome) });
      const before = store.messageTemplates.find((t) => t.trigger === "billing_before_due")!;
      expect(before).toMatchObject({ metaTemplateName: "billing_before_due", metaStatus: "PENDING" });

      // Tudo na Meta com o mesmo texto: so a situacao muda.
      list.mockResolvedValue(
        store.messageTemplates
          .filter((t) => t.metaTemplateName)
          .map((t) => ({ name: t.metaTemplateName!, id: t.metaTemplateId!, status: "APPROVED" as const, category: "UTILITY", language: "pt_BR" })),
      );
      create.mockClear();
      edit.mockClear();
      expect(await syncMetaTemplates({})).toEqual({ created: 0, edited: 0, failed: 0 });
      expect(create).not.toHaveBeenCalled();
      expect(edit).not.toHaveBeenCalled();
      expect(store.messageTemplates.find((t) => t.trigger === "billing_before_due")?.metaStatus).toBe("APPROVED");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("falha num modelo guarda o motivo e nao para os outros; recusado nao e usado no envio", async () => {
    vi.spyOn(whatsappClient, "listTemplates").mockResolvedValue([]);
    vi.spyOn(whatsappClient, "createOrUpdateTemplate").mockImplementation(async (payload) => {
      if (payload.name === "birthday_greeting") throw new Error("Texto recusado");
      return { id: `meta-${payload.name}`, status: "PENDING" };
    });
    try {
      const result = await syncMetaTemplates({});
      expect(result.failed).toBe(1);
      const birthday = store.messageTemplates.find((t) => t.trigger === "birthday_greeting")!;
      expect(birthday.metaRejectionReason).toBe("Texto recusado");
      expect(birthday.metaBody).toBeUndefined();

      const reminder = store.messageTemplates.find((t) => t.trigger === "billing_before_due")!;
      reminder.metaStatus = "REJECTED";
      const variables = { aluno: "Ana", valor: "R$ 10,00", vencimento: "25/09/2026", empresa: "X", referencia: "mensalidade", link_pagamento: "https://x" };
      expect(officialTemplateFor("billing_before_due", fillMessage(reminder.content, variables), variables)).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("compositor e filtro por periodo", () => {
  beforeEach(() => resetAcademy());

  it("retorna destinatarios com WhatsApp, turmas ativas e contagem de autorizacoes", async () => {
    const consented = await clientsService.create({
      name: "Ana Autorizada",
      phone: "11999991111",
      status: "active",
      whatsappConsentStatus: "granted",
    });
    await clientsService.create({
      name: "Beto Pendente",
      phone: "11999992222",
      status: "active",
    });
    await clientsService.create({
      name: "Carla Recusada",
      phone: "11999993333",
      status: "active",
      whatsappConsentStatus: "revoked",
    });
    await clientsService.create({
      name: "Duda Sem Telefone",
      status: "active",
      whatsappConsentStatus: "granted",
    });
    const inactive = await clientsService.create({
      name: "Eduardo Inativo",
      phone: "11999994444",
      status: "active",
      whatsappConsentStatus: "granted",
    });
    await clientsService.remove(inactive.id);

    const instructor = await createInstructor("Carlos");
    const cls = await createClass({
      name: "Jiu-Jitsu Manhã",
      instructorId: instructor.id,
      slots: [{ weekday: 1, start: "08:00", end: "09:00" }],
    });
    await turmasService.enroll({ classGroupId: cls.id, studentId: consented.id });

    const ctx = await communicationService.getComposerContext();
    expect(ctx.activeStudentsCount).toBe(4);
    expect(ctx.consentedCount).toBe(2);
    expect(ctx.missingConsentCount).toBe(1);
    expect(ctx.revokedConsentCount).toBe(1);
    expect(ctx.recipients.map((r) => r.name)).toEqual(["Ana Autorizada", "Beto Pendente", "Carla Recusada"]);
    expect(ctx.classGroups).toEqual([{ id: cls.id, name: "Jiu-Jitsu Manhã", studentIds: [consented.id] }]);
  });

  it("filtra historico por dateFrom e dateTo no fuso do espaco", async () => {
    at("12:00", "2026-09-10");
    await communicationService.registerAssistedMessage(message({ recipientName: "Antiga" }));
    at("12:00", "2026-09-22");
    await communicationService.registerAssistedMessage(message({ recipientName: "Recente" }));

    const page = await communicationService.listLogsPaginated({ dateFrom: "2026-09-20", dateTo: "2026-09-22" });
    expect(page.items.map((l) => l.recipientName)).toEqual(["Recente"]);
  });
});
