import type { Charge, Client, MessageLog, StudentPackage } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { onboardingService } from "@/services/settings/onboardingService";
import { resetAcademy } from "@/test/academy";

/** Marcos do "Descubra o dia a dia": cada um nasce do dado real do tenant. */
describe("onboardingService.getDiscoveryMilestones", () => {
  beforeEach(() => {
    resetAcademy();
    store.enrollments = [];
    store.attendances = [];
    store.charges = [];
    store.studentPackages = [];
    store.messageLogs = [];
    store.clients = store.clients.map((c) => ({ ...c, progressions: undefined }));
  });

  it("tenant sem uso: tudo falso", async () => {
    const m = await onboardingService.getDiscoveryMilestones();
    expect(m).toMatchObject({
      hasEnrollment: false,
      hasAttendance: false,
      hasPaidCharge: false,
      hasPaidCourseInstallment: false,
      hasPackageSale: false,
      hasMessage: false,
      hasProgressRecord: false,
    });
  });

  it("matrícula só conta ativa; destino é a 1ª turma ativa por nome", async () => {
    store.classGroups = store.classGroups.map((g, i) => ({ ...g, status: i === 0 ? "inactive" : "active" }));
    const firstActive = store.classGroups
      .filter((g) => g.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))[0];
    store.enrollments = [
      { id: "e-1", classGroupId: "cg", studentId: "s", status: "canceled", enrolledAt: "2026-09-01T00:00:00Z" },
    ];
    let m = await onboardingService.getDiscoveryMilestones();
    expect(m.hasEnrollment).toBe(false);
    expect(m.enrollClassGroupId).toBe(firstActive?.id);

    store.enrollments.push({ id: "e-2", classGroupId: "cg", studentId: "s", status: "active", enrolledAt: "2026-09-01T00:00:00Z" });
    m = await onboardingService.getDiscoveryMilestones();
    expect(m.hasEnrollment).toBe(true);
  });

  it("chamada, pagamento, parcela de curso, pacote, mensagem e evolução", async () => {
    const charge = (kind: Charge["kind"], status: Charge["status"]): Charge =>
      ({ id: `ch-${kind}-${status}`, organizationId: "o", studentId: "s", kind, dueDate: "2026-09-10", amountCents: 100, status }) as Charge;

    store.attendances = [{ id: "a-1", sessionId: "s-1", studentId: "s", status: "absent", markedAt: "2026-09-01T00:00:00Z" }];
    store.charges = [charge("membership", "pending"), charge("course", "pending")];
    let m = await onboardingService.getDiscoveryMilestones();
    expect(m.hasAttendance).toBe(true);
    expect(m.hasPaidCharge).toBe(false);
    expect(m.hasPaidCourseInstallment).toBe(false);

    store.charges.push(charge("membership", "paid"));
    m = await onboardingService.getDiscoveryMilestones();
    expect(m.hasPaidCharge).toBe(true);
    expect(m.hasPaidCourseInstallment).toBe(false);

    store.charges.push(charge("course", "paid"));
    store.studentPackages = [{ id: "sp-1" } as StudentPackage];
    store.messageLogs = [{ id: "ml-1" } as MessageLog];
    m = await onboardingService.getDiscoveryMilestones();
    expect(m.hasPaidCourseInstallment).toBe(true);
    expect(m.hasPackageSale).toBe(true);
    expect(m.hasMessage).toBe(true);
  });

  it("evolução: registro de aula, meta ou graduação", async () => {
    const base = { modalityId: "m", levelName: "Branca", subLevel: 0, promotedAt: "2026-09-01", strengths: [], goals: [], evaluations: [], promotionHistory: [], updatedAt: "2026-09-01T00:00:00Z" };
    const withProgression = (extra: object): Client[] => [
      { ...store.clients[0], progressions: { m: { ...base, ...extra } } } as Client,
    ];

    store.clients = withProgression({});
    expect((await onboardingService.getDiscoveryMilestones()).hasProgressRecord).toBe(false);

    store.clients = withProgression({ goals: [{ id: "g", title: "Meta", progress: 0, createdAt: "2026-09-01T00:00:00Z" }] });
    expect((await onboardingService.getDiscoveryMilestones()).hasProgressRecord).toBe(true);

    store.clients = withProgression({ promotionHistory: [{ id: "p", date: "2026-09-01", toLevelName: "Azul", toSubLevel: 0, createdAt: "2026-09-01T00:00:00Z" }] });
    expect((await onboardingService.getDiscoveryMilestones()).hasProgressRecord).toBe(true);
  });
});
