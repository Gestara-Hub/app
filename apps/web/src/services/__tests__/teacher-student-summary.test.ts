import type { ClassGroupView, Client } from "@gestarahub/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { clientsService } from "@/services/clients";
import { studentSummaryService } from "@/services/clients/studentSummaryService";
import { turmasService } from "@/services/classes";
import { can } from "@/lib/permissions";
import { createClass, createInstructor, createPlan, enrollStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Ficha do professor (achado 70, decisao de 24/10): so os alunos das turmas
 * dele e sem dinheiro, documentos nem endereco.
 */

const MON = { weekday: 1 as const, start: "19:00", end: "20:00" };

let mine: ClassGroupView;
let ana: Client;
let bia: Client;
let carlosId: string;

function loginAsTeacher(professionalId: string) {
  const id = `usr-prof-${professionalId}`;
  store.users.push({
    id, organizationId: store.organization.id, name: "Prof", email: `${id}@teste.local`, profile: "professional",
    professionalId, status: "active", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  });
  setCurrentActor({ userId: id, name: "Prof", profile: "professional" });
}

beforeEach(async () => {
  resetAcademy();
  const carlos = await createInstructor("Carlos");
  carlosId = carlos.id;
  const dani = await createInstructor("Dani");
  mine = await createClass({ name: "Adulto", instructorId: carlos.id, slots: [MON] });
  const other = await createClass({ name: "Kids", instructorId: dani.id, slots: [MON] });
  const plan = await createPlan("monthly", 15000);
  ana = await enrollStudent({ name: "Ana", plan, startDate: "2026-08-01" });
  bia = await enrollStudent({ name: "Bia", plan, startDate: "2026-08-01" });
  await clientsService.update(ana.id, { cpf: "52998224725", guardians: [{ name: "Mãe da Ana", phone: "11999990000", cpf: "11144477735" }] });
  await turmasService.enroll({ classGroupId: mine.id, studentId: ana.id });
  await turmasService.enroll({ classGroupId: other.id, studentId: bia.id });
});

describe("ficha do professor", () => {
  it("o professor tem a permissão da ficha dos alunos dele, e não a da lista", () => {
    expect(can("professional", "clients:view_own")).toBe(true);
    expect(can("professional", "clients:view")).toBe(false);
  });

  it("dono vê o dinheiro; professor vê o aluno da turma dele sem plano, saldo, pacotes, CPF e endereço", async () => {
    const owner = await studentSummaryService.getStudentSummary(ana.id);
    expect(owner.openBalance.count).toBeGreaterThan(0);
    expect(owner.membership.planName).toBeDefined();
    expect(owner.student.cpf).toBeDefined();

    loginAsTeacher(carlosId);
    const teacher = await studentSummaryService.getStudentSummary(ana.id);
    expect(teacher.student.name).toBe("Ana");
    expect(teacher.openBalance).toEqual({ totalCents: 0, count: 0, overdueCents: 0, overdueCount: 0 });
    expect(teacher.membership.planName).toBeUndefined();
    expect(teacher.membership.priceCents).toBeUndefined();
    expect(teacher.packages).toEqual([]);
    expect(teacher.lastMessages).toEqual([]);
    expect(teacher.student).not.toHaveProperty("cpf");
    expect(teacher.student).not.toHaveProperty("planId");
    expect(teacher.student).not.toHaveProperty("discount");
    expect(teacher.student.guardians?.[0]).toMatchObject({ name: "Mãe da Ana", phone: "11999990000" });
    expect(teacher.student.guardians?.[0]).not.toHaveProperty("cpf");
    expect(teacher.enrollments.every((e) => e.course === undefined)).toBe(true);
    expect(teacher.enrollments.map((e) => e.className)).toEqual(["Adulto"]);
  });

  it("professor não abre a ficha de aluno de turma de outro", async () => {
    loginAsTeacher(carlosId);
    await expect(studentSummaryService.getStudentSummary(bia.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("professor sem vínculo com a equipe não abre ficha nenhuma", async () => {
    loginAsTeacher("prof-que-nao-existe");
    await expect(studentSummaryService.getStudentSummary(ana.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// Auditoria de 30/10/2026: a lista de alunos (e a busca por id) trazia todos
// os alunos do espaco, com CPF e plano, para o professor.
describe("lista de alunos do professor", () => {
  it("só os alunos das turmas dele, sem CPF, plano nem endereço; os outros não acham por id", async () => {
    loginAsTeacher(carlosId);
    const list = await clientsService.list();
    expect(list.map((c) => c.name)).toEqual(["Ana"]);
    expect(list[0]).not.toHaveProperty("cpf");
    expect(list[0]).not.toHaveProperty("planId");
    expect(list[0]).not.toHaveProperty("discount");
    expect(list[0].guardians?.[0]).not.toHaveProperty("cpf");
    const page = await clientsService.listPaginated({ page: 1, pageSize: 20 });
    expect(page.items.map((c) => c.name)).toEqual(["Ana"]);
    await expect(clientsService.getById(bia.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await clientsService.getById(ana.id)).name).toBe("Ana");
  });

  it("o substituto vê os alunos da turma da aula que substitui", async () => {
    const eva = await createInstructor("Eva");
    const afternoon = { weekday: 1 as const, start: "15:00", end: "16:00" };
    const tarde = await createClass({ name: "Tarde", instructorId: eva.id, slots: [afternoon] });
    await turmasService.enroll({ classGroupId: tarde.id, studentId: bia.id });
    await turmasService.substituteInstructor(sessionIdOf(tarde.id, "2026-09-21", afternoon.start), { instructorId: carlosId });
    loginAsTeacher(carlosId);
    expect((await clientsService.list()).map((c) => c.name).sort()).toEqual(["Ana", "Bia"]);
  });

  it("dono e gerente seguem vendo todos, completos", async () => {
    const list = await clientsService.list();
    expect(list.map((c) => c.name).sort()).toEqual(["Ana", "Bia"]);
    expect(list.find((c) => c.name === "Ana")?.cpf).toBeDefined();
  });
});
