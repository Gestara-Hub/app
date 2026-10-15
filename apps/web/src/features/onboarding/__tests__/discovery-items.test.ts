import { describe, expect, it } from "vitest";
import type { DiscoveryMilestones, Permission } from "@gestarahub/contracts";
import { PROFILE_PERMISSIONS } from "@/lib/permissions";
import {
  buildDiscoveryItems,
  summarizeDiscovery,
  type DiscoveryInput,
} from "../discovery-items";

const NONE: DiscoveryMilestones = {
  hasEnrollment: false,
  hasAttendance: false,
  hasPaidCharge: false,
  hasPaidCourseInstallment: false,
  hasPackageSale: false,
  hasMessage: false,
  hasProgressRecord: false,
};

const canAll = () => true;
const canAs = (profile: keyof typeof PROFILE_PERMISSIONS) => (permission: Permission) =>
  PROFILE_PERMISSIONS[profile].includes(permission);

function input(extra: Partial<DiscoveryInput> = {}, milestones: Partial<DiscoveryMilestones> = {}): DiscoveryInput {
  return {
    milestones: { ...NONE, ...milestones },
    visited: { courseBilling: false, finance: false },
    areaBillingMode: "membership",
    can: canAll,
    ...extra,
  };
}

const ids = (i: DiscoveryInput) => buildDiscoveryItems(i).map((item) => item.id);
const item = (i: DiscoveryInput, id: string) => buildDiscoveryItems(i).find((it) => it.id === id);

describe("buildDiscoveryItems: item do dinheiro pela forma de cobrança da área", () => {
  it("mensalidade: registrar um pagamento, feito com cobrança paga", () => {
    expect(ids(input())).toEqual([
      "enroll",
      "attendance",
      "membership_payment",
      "message",
      "progress",
      "finance",
    ]);
    const money = item(input(), "membership_payment")!;
    expect(money).toMatchObject({ title: "Registrar um pagamento", href: "/classes/billing", done: false });
    expect(item(input({}, { hasPaidCharge: true }), "membership_payment")!.done).toBe(true);
  });

  it("curso: ver as parcelas, feito ao abrir Cobranças de curso ou com parcela paga", () => {
    const course = input({ areaBillingMode: "course" });
    expect(ids(course)).toContain("course_installments");
    expect(item(course, "course_installments")).toMatchObject({
      title: "Ver as parcelas do curso",
      href: "/classes/billing?kind=course",
      done: false,
    });
    // Cobranca paga que nao e parcela de curso nao conta.
    expect(item(input({ areaBillingMode: "course" }, { hasPaidCharge: true }), "course_installments")!.done).toBe(false);
    expect(
      item(input({ areaBillingMode: "course" }, { hasPaidCourseInstallment: true }), "course_installments")!.done,
    ).toBe(true);
    expect(
      item(input({ areaBillingMode: "course", visited: { courseBilling: true, finance: false } }), "course_installments")!
        .done,
    ).toBe(true);
    expect(item(course, "enroll")!.title).toBe("Matricular alunos no curso");
  });

  it("pacote: vender um pacote, feito com pacote vendido", () => {
    const pkg = input({ areaBillingMode: "package" });
    expect(item(pkg, "package_sale")).toMatchObject({ title: "Vender um pacote de aulas", done: false });
    expect(item(input({ areaBillingMode: "package" }, { hasPackageSale: true }), "package_sale")!.done).toBe(true);
  });

  it("sem cobrança: sem item do dinheiro", () => {
    expect(ids(input({ areaBillingMode: "free" }))).toEqual(["enroll", "attendance", "message", "progress", "finance"]);
  });
});

describe("buildDiscoveryItems: regras dos itens", () => {
  it("a chamada fica bloqueada até a primeira matrícula", () => {
    expect(item(input(), "attendance")).toMatchObject({ requires: "matrícula", done: false });
    expect(item(input({}, { hasEnrollment: true }), "attendance")!.requires).toBeUndefined();
    // Chamada ja feita (matricula cancelada depois) nao volta a bloquear.
    expect(item(input({}, { hasAttendance: true }), "attendance")).toMatchObject({ done: true });
    expect(item(input({}, { hasAttendance: true }), "attendance")!.requires).toBeUndefined();
  });

  it("matricular leva à primeira turma ativa; sem turma, à lista", () => {
    expect(item(input(), "enroll")!.href).toBe("/classes");
    expect(item(input({}, { enrollClassGroupId: "cg-1" }), "enroll")!.href).toBe("/classes/cg-1?enroll=true");
  });

  it("cada item se marca pelo seu marco", () => {
    const done = input(
      { visited: { courseBilling: false, finance: true } },
      { hasEnrollment: true, hasAttendance: true, hasPaidCharge: true, hasMessage: true, hasProgressRecord: true },
    );
    expect(buildDiscoveryItems(done).every((it) => it.done)).toBe(true);
  });

  it("itens sem permissão ficam de fora", () => {
    const noFinance = input({ can: (p) => p !== "finance:view" && p !== "communication:view" });
    expect(ids(noFinance)).not.toContain("finance");
    expect(ids(noFinance)).not.toContain("message");
    expect(ids(input({ can: () => false }))).toEqual([]);
  });

  it("dono e gerente veem todos; professor não tem o dinheiro nem o financeiro", () => {
    expect(ids(input({ can: canAs("owner") }))).toHaveLength(6);
    expect(ids(input({ can: canAs("manager") }))).toHaveLength(6);
    const professional = ids(input({ can: canAs("professional") }));
    expect(professional).not.toContain("membership_payment");
    expect(professional).not.toContain("finance");
  });
});

describe("summarizeDiscovery", () => {
  it("conta feitos e total; acaba quando tudo foi feito", () => {
    const partial = buildDiscoveryItems(input({}, { hasEnrollment: true, hasMessage: true }));
    expect(summarizeDiscovery(partial)).toEqual({ doneCount: 2, total: 6, allDone: false });

    const free = buildDiscoveryItems(
      input(
        { areaBillingMode: "free", visited: { courseBilling: false, finance: true } },
        { hasEnrollment: true, hasAttendance: true, hasMessage: true, hasProgressRecord: true },
      ),
    );
    expect(summarizeDiscovery(free)).toEqual({ doneCount: 5, total: 5, allDone: true });
  });

  it("sem itens não conta como acabado", () => {
    expect(summarizeDiscovery([])).toEqual({ doneCount: 0, total: 0, allDone: false });
  });
});
