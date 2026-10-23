import type {
  Category,
  ClassGroupView,
  Client,
  FinancialCategory,
  LessonPackage,
  Plan,
  ProfessionalView,
} from "@gestarahub/contracts";
import { addDays, format, parseISO, subDays } from "date-fns";
import { store } from "@/mocks/store";
import { billingService } from "@/services/billing";
import { categoriesService } from "@/services/catalog/categoriesService";
import { clientsService } from "@/services/clients";
import { communicationService } from "@/services/communication";
import { financeService } from "@/services/finance";
import { packagesService } from "@/services/billing";
import { professionalsService } from "@/services/catalog/professionalsService";
import { teacherPayService } from "@/services/finance";
import { turmasService } from "@/services/classes";

/**
 * Espaco de demonstracao (doc 15, fatia 4). Roda os proprios servicos dentro
 * do espaco carregado do banco (`runInWorld`), entao os dados seguem as mesmas
 * regras da conta real. Datas relativas a hoje; sorteios com semente fixa
 * (a mesma demonstracao toda vez que roda no mesmo dia).
 */

/** Gerador deterministico (LCG) para presencas e pagamentos. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "João",
  "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Thiago", "Valéria", "Yuri",
  "Beatriz", "Caio", "Lívia", "Pedro",
];
const LAST_NAMES = ["Almeida", "Barbosa", "Costa", "Duarte", "Esteves", "Freitas", "Gomes", "Lima", "Moraes", "Nunes"];

function day(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export interface DemoResult {
  teacherIds: string[];
}

export async function buildDemo(today: Date): Promise<DemoResult> {
  const rand = random(20261021);
  const todayIso = day(today);
  const opening = day(subDays(today, 120));

  // Catalogo.
  const jiu = await categoriesService.create({ name: "Jiu-Jitsu" });
  const muay = await categoriesService.create({ name: "Muay Thai" });
  const judo = await categoriesService.create({ name: "Judô kids" });
  const modalities: Category[] = [jiu, muay, judo];

  const teacher = (name: string, modalityIds: string[], phone: string) =>
    professionalsService.create({
      name,
      phone,
      status: "active",
      workingHours: [],
      serviceIds: [],
      modalityIds,
    });
  const teachers: ProfessionalView[] = [
    await teacher("Rodrigo Mendes", [jiu.id], "11987650001"),
    await teacher("Camila Rocha", [muay.id], "11987650002"),
    await teacher("Lucas Prado", [judo.id, jiu.id], "11987650003"),
  ];

  const plan = (name: string, priceCents: number) =>
    billingService.createPlan({ name, priceCents, period: "monthly", status: "active" });
  const livre: Plan = await plan("Mensal livre", 22000);
  const duasVezes: Plan = await plan("Mensal 2x por semana", 16000);
  const kids: Plan = await plan("Mensal kids", 14000);

  // Turmas (dias da semana: 1 = segunda).
  const group = (
    name: string,
    modality: Category,
    instructor: ProfessionalView,
    planId: string,
    slots: { weekday: number; start: string; end: string }[],
    capacity: number,
  ) =>
    turmasService.create({
      name,
      modalityId: modality.id,
      instructorId: instructor.id,
      capacity,
      allowDropin: true,
      sessionPriceCents: 5000,
      planId,
      billingMode: "membership",
      meetingSlots: slots as never,
      startDate: opening,
      status: "active",
    });
  const groups: ClassGroupView[] = [
    await group("Jiu-Jitsu adulto", jiu, teachers[0], livre.id, [
      { weekday: 1, start: "19:00", end: "20:30" },
      { weekday: 3, start: "19:00", end: "20:30" },
      { weekday: 5, start: "19:00", end: "20:30" },
    ], 20),
    await group("Muay Thai", muay, teachers[1], duasVezes.id, [
      { weekday: 2, start: "18:00", end: "19:00" },
      { weekday: 4, start: "18:00", end: "19:00" },
    ], 16),
    await group("Judô kids", judo, teachers[2], kids.id, [
      { weekday: 2, start: "16:00", end: "17:00" },
      { weekday: 4, start: "16:00", end: "17:00" },
    ], 6),
  ];

  // Curso fechado em andamento.
  const course = await turmasService.create({
    name: "Defesa pessoal (8 semanas)",
    modalityId: jiu.id,
    instructorId: teachers[2].id,
    capacity: 12,
    allowDropin: false,
    billingMode: "course",
    coursePriceCents: 48000,
    courseMaxInstallments: 3,
    meetingSlots: [{ weekday: 6, start: "10:00", end: "11:30" }] as never,
    startDate: day(subDays(today, 21)),
    endDate: day(addDays(today, 35)),
    status: "active",
  });

  // Alunos com plano, entrando ao longo dos ultimos quatro meses.
  const students: Client[] = [];
  for (let i = 0; i < 24; i++) {
    const g = groups[i % 3];
    const planId = g.planId!;
    const start = day(subDays(today, 15 + Math.floor(rand() * 100)));
    const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
    const isKid = g.id === groups[2].id;
    const student = await clientsService.create({
      name,
      phone: `1198${String(7000000 + i * 1371).padStart(7, "0")}`,
      email: isKid ? undefined : `${FIRST_NAMES[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}@exemplo.com`,
      birthDate: isKid ? day(subDays(today, 365 * (7 + (i % 5)))) : day(subDays(today, 365 * (19 + (i % 20)))),
      guardians: isKid ? [{ name: `Responsável de ${FIRST_NAMES[i]}`, phone: "11977770000", relationship: "Mãe" } as never] : undefined,
      status: "active",
      membershipStatus: "active",
      planId,
      planStartDate: start,
      ...(i === 5 ? { discount: { type: "percentage", value: 100, scholarship: true } as never } : {}),
      ...(i === 9 ? { discount: { type: "percentage", value: 20 } as never } : {}),
    });
    students.push(student);
    // Judo kids lota: os ultimos dois vao para a lista de espera.
    if (isKid && students.filter((s) => s.planId === kids.id).length > 6) {
      await turmasService.addToWaitlist({ classGroupId: g.id, studentId: student.id });
      continue;
    }
    await turmasService.enroll({ classGroupId: g.id, studentId: student.id });
    // A matricula vale desde a entrada do aluno (historico de chamada).
    const enrollment = store.enrollments.find((e) => e.studentId === student.id && e.classGroupId === g.id);
    if (enrollment) enrollment.enrolledAt = `${start}T12:00:00.000Z`;
  }

  // Curso: tres alunos, parcelado.
  for (const student of students.slice(0, 3)) {
    await turmasService.enroll({
      classGroupId: course.id,
      studentId: student.id,
      course: { priceCents: 48000, installments: 3, firstDueDate: day(subDays(today, 20)) },
    });
  }

  // Chamada das ultimas tres semanas.
  for (let offset = 21; offset >= 1; offset--) {
    const date = subDays(today, offset);
    const iso = day(date);
    const weekday = date.getDay();
    for (const g of groups) {
      for (const slot of g.meetingSlots.filter((s) => s.weekday === weekday)) {
        const enrolled = store.enrollments.filter(
          (e) => e.classGroupId === g.id && e.status === "active" && e.enrolledAt.slice(0, 10) <= iso,
        );
        for (const e of enrolled) {
          const roll = rand();
          const status = roll < 0.8 ? "present" : roll < 0.92 ? "absent" : "justified";
          await turmasService.markAttendance({ sessionId: `${g.id}~${iso}~${slot.start}`, studentId: e.studentId, status });
        }
      }
    }
  }

  // Mensalidades: gera ate o mes atual e da baixa na maior parte das vencidas.
  const charges = await billingService.listCharges({});
  const paidUntil = day(subDays(today, 3));
  for (const c of charges) {
    if (c.status !== "pending" && c.status !== "overdue") continue;
    if (c.dueDate > paidUntil) continue;
    if (rand() < 0.85) await billingService.markPaid(c.id, rand() < 0.6 ? "pix" : "card", { paidOn: c.dueDate });
  }

  // Pacote de aulas avulsas vendido a um aluno sem plano.
  const pkg: LessonPackage = await packagesService.createPackage({
    name: "10 aulas",
    lessons: 10,
    priceCents: 45000,
    validityDays: 90,
    classGroupIds: [groups[0].id, groups[1].id],
    modalityIds: [],
    absenceConsumes: true,
    status: "active",
  });
  const visitor = await clientsService.create({ name: "Marina Teixeira", phone: "11986543210", status: "active" });
  await packagesService.sellPackage({
    studentId: visitor.id,
    packageId: pkg.id,
    priceCents: 45000,
    installments: 1,
    firstDueDate: todayIso,
  });

  // Financeiro: aluguel recorrente e repasse por aluno.
  const categories: FinancialCategory[] = await financeService.listCategories();
  const expense = categories.find((c) => c.type === "expense" && !c.system);
  if (expense) {
    await financeService.createEntry({
      type: "expense",
      categoryId: expense.id,
      description: "Aluguel do espaço",
      amountCents: 350000,
      dueDate: day(parseISO(`${todayIso.slice(0, 7)}-05`)),
      repeatMonthly: true,
    } as never);
  }
  for (const t of teachers) {
    await teacherPayService.saveRule(t.id, {
      components: [{ kind: "per_student", amountCents: 3000 }],
      startCompetence: day(subDays(today, 60)).slice(0, 7),
    } as never);
  }

  // Comunicacao pronta (modelos e conexao assistida).
  await communicationService.getConnection();
  await communicationService.listTemplates();

  void modalities;
  return { teacherIds: teachers.map((t) => t.id) };
}
