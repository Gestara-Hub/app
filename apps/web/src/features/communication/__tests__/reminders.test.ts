import { describe, expect, it } from "vitest";
import type { ReminderSources } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { attentionReminderKeys, buildReminders, pendingReminders } from "../reminders";

/** Motor de lembretes (doc product/25): regra pura, com dados montados a mao. */

const TODAY = "2026-09-22";

const charge = (id: string, over: Record<string, unknown>) =>
  ({
    id,
    studentId: "c-ana",
    studentName: "Ana",
    kind: "membership",
    status: "pending",
    amountCents: 15000,
    dueDate: "2026-09-25",
    competence: "2026-09",
    ...over,
  }) as never;

function sources(over: Partial<ReminderSources> = {}): ReminderSources {
  return {
    canBilling: true,
    openRollCalls: [],
    documents: [],
    eventCertificates: [],
    eventsTomorrow: [],
    visitors: [],
    coursesEnding: [],
    students: [
      { id: "c-ana", name: "Ana", phone: "11977770000", birthDate: "2000-09-22", createdAt: "2026-01-05T12:00:00.000Z" },
      { id: "c-bia", name: "Bia", phone: "11988880000", birthDate: "2001-09-19", createdAt: "2026-01-05T12:00:00.000Z" },
      { id: "c-caio", name: "Caio", createdAt: "2026-01-05T12:00:00.000Z" },
    ],
    charges: [],
    packages: [],
    absenceStreaks: [],
    promotions: [],
    trials: [],
    logs: [],
    templates: [{ trigger: "billing_before_due", enabled: true, daysOffset: -3 }],
    ...over,
  };
}

const keys = (groups: ReturnType<typeof buildReminders>) => groups.map((g) => g.key);

describe("motor de lembretes", () => {
  it("falar com alguém: evento amanhã, visitante depois de 7 dias e curso terminando", () => {
    const groups = buildReminders(
      sources({
        eventsTomorrow: [{ sessionId: "d1", eventId: "ev1", eventName: "Seminário", date: "2026-09-23", start: "09:00", end: "12:00", studentIds: ["c-ana", "c-bia"] }],
        visitors: [
          { studentId: "c-ana", eventName: "Workshop", endedOn: "2026-09-10" },
          { studentId: "c-bia", eventName: "Workshop", endedOn: "2026-09-20" },
        ],
        coursesEnding: [{ studentId: "c-caio", classGroupId: "g1", className: "Confeitaria", endDate: "2026-09-30" }],
        logs: [{ trigger: "event_reminder", clientId: "c-bia", sentAt: "2026-09-22T08:00:00.000Z" }],
      }),
      { today: TODAY },
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.event_tomorrow).toMatchObject({ level: "info", title: "1 inscrito para avisar do evento de amanhã", pending: 1 });
    expect(byKey.event_tomorrow.items[0]).toMatchObject({ trigger: "event_reminder", values: { evento: "Seminário", dia: "23/09", horario: "09:00 às 12:00" }, phone: "11977770000" });
    expect(byKey.event_tomorrow.items[1].done).toBe("Avisado hoje");
    // Visitante: so 7 dias depois do evento; a mensagem e a de chamar de volta, com o nome do evento.
    expect(byKey.visitor_follow_up).toMatchObject({ level: "warning", title: "1 visitante para oferecer turma" });
    expect(byKey.visitor_follow_up.items[0]).toMatchObject({ studentName: "Ana", trigger: "trial_follow_up" });
    expect(byKey.visitor_follow_up.items[0].content).toContain("no Workshop");
    expect(byKey.course_ending.items[0]).toMatchObject({ studentName: "Caio", detail: "Confeitaria · termina 30/09", trigger: "manual_broadcast" });
    expect(byKey.course_ending.items[0].content).toContain("Confeitaria termina em 30/09");
  });

  it("resolver no sistema: chamada de ontem, documento vencendo e presentes sem certificado viram tarefas com tela", () => {
    const groups = buildReminders(
      sources({
        openRollCalls: [
          { id: "g1~2026-09-21~19:00", kind: "class", title: "Jiu-Jitsu adulto", date: "2026-09-21", start: "19:00", end: "20:00", studentsCount: 8, href: "/classes/sessions/g1~2026-09-21~19:00" },
        ],
        documents: [
          { id: "d1", ownerKind: "client", kind: "medical_certificate", ownerId: "c-ana", ownerName: "Ana", label: "Atestado médico", expiresOn: "2026-09-30", expiry: "expiring", daysToExpire: 8 },
        ],
        eventCertificates: [{ eventId: "ev1", eventName: "Seminário", presentTotal: 5, presentWithout: 3, href: "/events/ev1/certificates" }],
      }),
      { today: TODAY },
    );
    const tasks = groups.filter((g) => g.category === "task");
    expect(tasks.map((g) => `${g.key} ${g.level} ${g.title}`)).toEqual([
      "roll_call info 1 chamada de ontem em aberto",
      "documents warning 1 documento para renovar",
      "event_certificates warning 1 evento com presentes sem certificado",
    ]);
    expect(tasks[0].items[0]).toMatchObject({ studentName: "Jiu-Jitsu adulto", detail: "21/09, 19:00 às 20:00 · 8 alunos", href: "/classes/sessions/g1~2026-09-21~19:00" });
    expect(tasks[1].items[0]).toMatchObject({ studentName: "Atestado médico de Ana", href: "/clients/c-ana?tab=documents" });
    expect(tasks[2].items[0].detail).toBe("3 de 5 presentes sem certificado");
    // Tarefa adiada some como qualquer lembrete.
    const snoozed = buildReminders(sources({ eventCertificates: [{ eventId: "ev1", eventName: "Seminário", presentTotal: 5, presentWithout: 3, href: "/x" }] }), {
      today: TODAY,
      snoozes: { "event_certificates:ev1": "never" },
    });
    expect(snoozed.some((g) => g.key === "event_certificates")).toBe(false);
  });

  it("nível por grupo: cobrança em atraso e faltas são atenção; aniversário e a vencer são só informação", () => {
    const groups = buildReminders(
      sources({
        charges: [charge("c1", { status: "overdue", dueDate: "2026-09-10" }), charge("c2", { dueDate: "2026-09-24" })],
      }),
      { today: TODAY },
    );
    const level = Object.fromEntries(groups.map((g) => [g.key, g.level]));
    expect(level.overdue).toBe("warning");
    expect(level.due_soon).toBe("info");
    expect(level.birthday).toBe("info");
    expect(attentionReminderKeys(groups)).toEqual(["overdue:c1"]);
  });

  it("grupo grande: mostra 20, conta todos e diz quantos ficaram de fora", () => {
    const many = Array.from({ length: 45 }, (_, i) => charge(`ch-${i}`, { status: "overdue", dueDate: "2026-09-01", amountCents: 100 }));
    const [overdue] = buildReminders(sources({ charges: many, students: [] }), { today: TODAY });
    expect(overdue.title).toBe("45 cobranças em atraso");
    expect(overdue.pending).toBe(45);
    expect(overdue.items).toHaveLength(20);
    expect(overdue.hidden).toBe(25);
  });

  it("cobrança: atraso (mais antigo primeiro), vence hoje e vence em até 3 dias; fora da janela não entra", () => {
    const groups = buildReminders(
      sources({
        charges: [
          charge("ch-late-new", { status: "overdue", dueDate: "2026-09-15" }),
          charge("ch-late-old", { status: "overdue", dueDate: "2026-08-10", competence: "2026-08", studentId: "c-bia", studentName: "Bia" }),
          charge("ch-today", { dueDate: TODAY }),
          charge("ch-soon", { dueDate: "2026-09-25" }),
          charge("ch-far", { dueDate: "2026-09-30" }),
          charge("ch-paid", { status: "paid", dueDate: "2026-09-10", paidAt: "2026-09-21T12:00:00.000Z" }),
        ],
      }),
      { today: TODAY },
    );
    expect(keys(groups)).toEqual(["overdue", "due_today", "due_soon", "birthday", "payment_received"]);
    const overdue = groups[0];
    expect(overdue.items.map((i) => i.chargeId)).toEqual(["ch-late-old", "ch-late-new"]);
    expect(overdue.items[0]).toMatchObject({ trigger: "billing_critical", phone: "11988880000" });
    expect(overdue.items[1]).toMatchObject({ trigger: "billing_after_due" });
    expect(overdue.detail).toBe(`${formatCents(30000)} até hoje, de 2 meses`);
    expect(groups[1].items[0].trigger).toBe("billing_due_date");
    expect(groups[2].title).toBe("1 cobrança vence até 25/09");
    expect(groups[2].items[0].trigger).toBe("billing_before_due");
  });

  it("já avisado não conta como pendência; o atraso volta a lembrar depois de 7 dias", () => {
    const late = charge("ch-late", { status: "overdue", dueDate: "2026-08-01" });
    const recent = buildReminders(
      sources({ charges: [late], students: [], logs: [{ trigger: "billing_critical", clientId: "c-ana", chargeId: "ch-late", sentAt: "2026-09-20T15:00:00.000Z" }] }),
      { today: TODAY },
    );
    // So item feito: o grupo some.
    expect(recent).toEqual([]);
    const old = buildReminders(
      sources({ charges: [late], students: [], logs: [{ trigger: "billing_critical", clientId: "c-ana", chargeId: "ch-late", sentAt: "2026-09-10T15:00:00.000Z" }] }),
      { today: TODAY },
    );
    expect(old[0].pending).toBe(1);
    expect(old[0].items[0].done).toBeUndefined();
  });

  it("aniversário no dia e na semana (feito some da contagem); faltas e pacote", () => {
    const groups = buildReminders(
      sources({
        logs: [{ trigger: "birthday_greeting", clientId: "c-bia", sentAt: "2026-09-19T12:00:00.000Z" }],
        absenceStreaks: [{ studentId: "c-caio", studentName: "Caio", streak: 3, since: "2026-09-14", classGroupNames: ["Adulto"] }],
        packages: [
          {
            id: "sp-1", studentId: "c-ana", studentName: "Ana", packageId: "pk-1", name: "Pacote 10 aulas", status: "active",
            lessonsTotal: 10, lessonsUsed: 9, purchasedAt: "2026-09-01", remaining: 1, isExpired: false, isUsedUp: false,
            isLastLesson: true, expiresSoon: false, modalityNames: [], classNames: [],
          } as never,
        ],
      }),
      { today: TODAY },
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey.birthday.items.map((i) => [i.studentName, i.detail, Boolean(i.done)])).toEqual([
      ["Ana", "Faz 26 anos", false],
      ["Bia", "Fez 25 anos em 19/09", true],
    ]);
    expect(byKey.birthday.pending).toBe(1);
    expect(byKey.absence.items[0]).toMatchObject({ trigger: "absence_alert" });
    expect(byKey.absence.items[0].detail).toMatch(/^3 faltas seguidas · desde .+ · Adulto$/);
    expect(byKey.birthday.title).toBe("1 aniversariante na semana"); // o já feito não conta no título
    expect(byKey.packages.items[0]).toMatchObject({ trigger: "package_ending", values: { pacote: "Pacote 10 aulas" } });
    expect(pendingReminders(groups)).toBe(3);
  });

  it("adiado até amanhã some hoje e volta amanhã; ignorado não volta", () => {
    const src = sources({ students: [{ id: "c-ana", name: "Ana", birthDate: "2000-09-22", createdAt: "2026-01-05T12:00:00.000Z" }] });
    const key = "birthday:c-ana:2026-09-22";
    expect(buildReminders(src, { today: TODAY, snoozes: { [key]: "2026-09-23" } })).toEqual([]);
    expect(buildReminders(src, { today: "2026-09-23", snoozes: { [key]: "2026-09-23" } })).toHaveLength(1);
    expect(buildReminders(src, { today: "2026-09-23", snoozes: { [key]: "never" } })).toEqual([]);
  });

  it("relacionamento: boas-vindas (até 7 dias), avanço de nível (até 14) e pagamento para agradecer (até 7)", () => {
    const groups = buildReminders(
      sources({
        students: [
          { id: "c-nova", name: "Nova", createdAt: "2026-09-20T12:00:00.000Z" },
          { id: "c-antiga", name: "Antiga", createdAt: "2026-08-01T12:00:00.000Z" },
        ],
        promotions: [
          { studentId: "c-antiga", modalityId: "m-jj", modalityName: "Jiu-Jitsu", levelName: "Faixa Azul", subLevel: 1, trackStyle: "belt", lastAdvancedAt: "2026-09-18" },
        ],
        charges: [
          charge("ch-paga", { studentId: "c-antiga", studentName: "Antiga", status: "paid", dueDate: "2026-09-10", paidAt: "2026-09-21T12:00:00.000Z" }),
          charge("ch-paga-antes", { studentId: "c-antiga", studentName: "Antiga", status: "paid", dueDate: "2026-08-10", paidAt: "2026-08-10T12:00:00.000Z" }),
        ],
        logs: [{ trigger: "welcome_student", clientId: "c-nova", sentAt: "2026-09-21T12:00:00.000Z" }],
      }),
      { today: TODAY },
    );
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    // Boas-vindas ja enviadas ontem: o grupo some (nada pendente, nada feito hoje).
    expect(byKey.welcome).toBeUndefined();
    expect(byKey.level_up.items[0]).toMatchObject({ trigger: "level_up", values: { nivel: "Faixa Azul · 1º grau" } });
    expect(byKey.payment_received.items.map((i) => i.chargeId)).toEqual(["ch-paga"]);
    expect(byKey.payment_received.items[0].values.referencia).toBe("mensalidade de setembro");
  });

  it("boas-vindas: data como subtítulo, feito em outro dia no fim e fora do título", () => {
    const groups = buildReminders(
      sources({
        students: [
          { id: "c-feita", name: "Feita", createdAt: "2026-09-21T12:00:00.000Z" },
          { id: "c-ontem", name: "Ontem", createdAt: "2026-09-21T13:00:00.000Z" },
          { id: "c-antes", name: "Antes", createdAt: "2026-09-19T12:00:00.000Z" },
        ],
        logs: [{ trigger: "welcome_student", clientId: "c-feita", sentAt: "2026-09-21T15:00:00.000Z" }],
      }),
      { today: TODAY },
    );
    const welcome = groups.find((g) => g.key === "welcome")!;
    expect(welcome.title).toBe("2 alunos novos para dar boas-vindas");
    expect(welcome.detail).toBe("Ontem, Antes");
    expect(welcome.items.map((i) => [i.studentName, i.section, i.detail, Boolean(i.done)])).toEqual([
      ["Ontem", "Cadastrados ontem", "", false],
      ["Antes", "Cadastrados há 3 dias", "", false],
      ["Feita", "Cadastrados ontem", "", true],
    ]);
  });
});
