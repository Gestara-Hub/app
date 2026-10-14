import type { SendMessagePayload } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billingService";
import { clientsService } from "@/services/clientsService";
import { communicationService } from "@/services/communicationService";
import { ACADEMY_ORG, createPlan, enrollStudent, resetAcademy } from "@/test/academy";
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
    expect(await communicationService.listTemplates()).toHaveLength(7);
  });

  it("texto e livre no gratis (o assistido usa o mesmo texto)", async () => {
    const updated = await communicationService.updateTemplate({ id: tmpl("birthday"), content: "  Parabéns, {aluno}!  " });
    expect(updated.content).toBe("Parabéns, {aluno}!");
    expect(lastAudit()).toBe('Ana Ribeiro atualizou a mensagem "Felicitações de Aniversário"');
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

  async function birthdayStudent(name = "Bia", overrides: { phone?: string; birthDate?: string } = {}) {
    return clientsService.create({
      name,
      phone: overrides.phone ?? "11977770000",
      birthDate: overrides.birthDate ?? "2000-09-22",
      status: "active",
    });
  }

  const greetings = () => store.messageLogs.filter((l) => l.trigger === "birthday_greeting");

  it("no oficial envia um por aluno no dia, preenchendo aluno e empresa", async () => {
    const bia = await birthdayStudent();
    await connectOfficial();

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

    // Nova leitura no mesmo dia (e pelas metricas) nao duplica.
    await communicationService.listLogs();
    await communicationService.getMetrics();
    at("19:00");
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(1);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(1);
  });

  it("usa o texto editado do modelo", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), content: "Feliz dia, {aluno}! Abraço da {empresa}." });
    await communicationService.listLogs();
    expect(greetings()[0].content).toBe("Feliz dia, Bia! Abraço da Academia X.");
  });

  it("no assistido (gratis ou Pro sem conectar) nao envia", async () => {
    await birthdayStudent();
    await communicationService.listLogs();
    setTier("pro");
    await communicationService.listLogs();
    await communicationService.getMetrics();
    expect(greetings()).toHaveLength(0);
  });

  it("regra desligada nao envia", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), enabled: false });
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(0);
  });

  it("so a partir do horario da regra", async () => {
    await birthdayStudent();
    await connectOfficial();
    at("08:29");
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(0);
    at("08:30");
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(1);
  });

  it("horario editado da regra vale", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.updateTemplate({ id: tmpl("birthday"), sendHour: "15:00" });
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(0);
    at("15:00");
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(1);
  });

  it("ignora inativo, sem WhatsApp e quem nao faz aniversario hoje", async () => {
    const inactive = await birthdayStudent("Inativo");
    await clientsService.remove(inactive.id);
    await birthdayStudent("Sem fone", { phone: "1234" });
    await birthdayStudent("Amanha", { birthDate: "2000-09-23" });
    await birthdayStudent("Hoje");
    await connectOfficial();
    await communicationService.listLogs();
    expect(greetings().map((l) => l.recipientName)).toEqual(["Hoje"]);
  });

  it("no dia seguinte o aluno do dia anterior nao recebe de novo", async () => {
    await birthdayStudent();
    await connectOfficial();
    await communicationService.listLogs();
    at("12:00", "2026-09-23");
    await communicationService.listLogs();
    expect(greetings()).toHaveLength(1);
  });

  it("parabens ja aberto no WhatsApp (assistido) no dia nao repete no automatico", async () => {
    const bia = await birthdayStudent();
    await communicationService.registerAssistedMessage(
      message({ recipientName: "Bia", trigger: "birthday_greeting", clientId: bia.id, content: "Parabéns!" }),
    );
    await connectOfficial();
    await communicationService.listLogs();
    expect(greetings().map((l) => l.status)).toEqual(["opened"]);
    expect(store.whatsAppConnection?.monthlyQuota.used).toBe(0);
  });

  it("dois alunos no mesmo dia recebem um cada", async () => {
    await birthdayStudent("Bia");
    await birthdayStudent("Caio");
    await connectOfficial();
    await communicationService.listLogs();
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
    const metrics = await communicationService.getMetrics();
    expect(metrics).toMatchObject({
      mode: "assisted",
      messagesThisMonth: 2,
      monthlyQuota: 1000,
      deliveryRate: null,
      readRate: null,
      recoveredAmountCents: 0,
    });
  });

  it("automacoes ativas = modelos ligados", async () => {
    // Padrao: so o atraso critico vem desligado.
    expect((await communicationService.getMetrics()).activeAutomationsCount).toBe(6);
    setTier("pro");
    await communicationService.updateTemplate({ id: tmpl("welcome"), enabled: false });
    expect((await communicationService.getMetrics()).activeAutomationsCount).toBe(5);
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
