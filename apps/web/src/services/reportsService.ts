import type {
  AttendanceReportData,
  AttendanceReportRow,
  BirthdayReportData,
  BirthdayRow,
  BillingStatementReportData,
  BillingStatementRow,
  Charge,
  ChargeKind,
  ChurnReportData,
  CourseReportData,
  CourseReportRow,
  DRECategoryRow,
  DREStatementReportData,
  GeneratedReportData,
  PackageReportData,
  PackageReportRow,
  ReportFilter,
  ReportHeaderInfo,
  ReportMetadata,
  Permission,
  ReportType,
  StudentRosterReportData,
  StudentRosterRow,
} from "@gestarahub/contracts";
import { classBillingMode, isCourseEnded } from "@gestarahub/core/billing";
import { firstDayOfCompetence, lastDayOfCompetence, localDateOf } from "@gestarahub/core/finance";
import { ownLessons, packageState } from "@gestarahub/core/packages";
import { addDays, format, parseISO } from "date-fns";
import { apiError, notFoundError, nowIso, simulateRead } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { autoGenerateMembershipCharges } from "./billingService";
import { assertFeature } from "./subscriptionService";
import { sessionDetailOf, sessionsOfClass } from "./turmasService";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/mocks/currentActor";

const CATALOG: ReportMetadata[] = [
  // 1. Operacionais (Free)
  {
    type: "attendance_sheet",
    title: "Lista de presença",
    description: "Presença de cada aluno por turma e aula.",
    category: "operational",
    tierRequired: "free",
    iconName: "ClipboardCheck",
  },
  {
    type: "students_roster",
    title: "Relação de alunos",
    description: "Plano, matrícula, nível e situação de cada aluno.",
    category: "operational",
    tierRequired: "free",
    iconName: "Users",
  },
  {
    type: "billing_statement",
    title: "Cobranças e inadimplência",
    description: "Cobranças geradas, recebidas, em aberto e taxa de atraso.",
    category: "operational",
    tierRequired: "free",
    iconName: "Wallet",
  },
  {
    type: "course_summary",
    title: "Cursos",
    description: "Por curso: alunos, concluídos, cancelados, contratado, recebido e em aberto.",
    category: "operational",
    tierRequired: "free",
    iconName: "GraduationCap",
  },
  {
    type: "package_summary",
    title: "Pacotes de aulas",
    description: "Por pacote: vendas, aulas vendidas e usadas, saldo e recebido.",
    category: "operational",
    tierRequired: "free",
    iconName: "Ticket",
  },
  {
    type: "monthly_birthdays",
    title: "Aniversariantes do mês",
    description: "Quem faz aniversário no mês, com o contato.",
    category: "operational",
    tierRequired: "free",
    iconName: "Cake",
  },
  // 2. Gerenciais Avançados (Pro)
  {
    type: "financial_income_statement",
    title: "DRE gerencial",
    description: "Receitas, despesas e resultado do mês.",
    category: "financial",
    tierRequired: "pro",
    iconName: "FileSpreadsheet",
  },
  {
    type: "churn_retention",
    title: "Retenção de alunos",
    description: "Entradas, saídas e retenção por turma.",
    category: "retention",
    tierRequired: "pro",
    iconName: "TrendingUp",
  },
];

/**
 * Valores de cobranca pedem `billing:view`; DRE, churn, previsao e repasse,
 * `finance:view` (a atendente nao abre o financeiro por Relatorios).
 */
const REPORT_PERMISSION: Partial<Record<ReportType, Permission>> = {
  billing_statement: "billing:view",
  course_summary: "billing:view",
  package_summary: "billing:view",
  financial_income_statement: "finance:view",
  churn_retention: "finance:view",
  revenue_forecast: "finance:view",
  teacher_performance: "finance:view",
};

/** O usuario logado pode ver o relatorio? Sem ator (scripts) passa. */
function actorCanSee(type: ReportType): boolean {
  const permission = REPORT_PERMISSION[type];
  const actor = getCurrentActor();
  return !permission || !actor || can(actor.profile, permission);
}

function buildHeader(periodLabel: string): ReportHeaderInfo {
  return {
    organizationName: store.organization.name,
    organizationSegment: store.organization.segment || "Espaço",
    unitName: store.unit.name,
    generatedAt: nowIso(),
    // Quem gerou (antes "Administração" fixo).
    generatedBy: getCurrentActor()?.name ?? store.organization.name,
    periodLabel,
  };
}

const OPEN_STATUSES = new Set<Charge["status"]>(["pending", "overdue"]);
const VOID_STATUSES = new Set<Charge["status"]>(["canceled", "waived"]);

/** Pago no mes (data local do pagamento). */
function paidIn(charge: Charge, competence: string): boolean {
  return charge.status === "paid" && Boolean(charge.paidAt) && localDateOf(charge.paidAt!).slice(0, 7) === competence;
}

/**
 * Cursos do mes: turmas de curso com aula no mes (inicio ate o fim, ou ate hoje
 * sem fim) ou com parcela vencendo ou paga no mes. Valores do curso inteiro;
 * o recebido no mes vem a parte. So dados reais (sem curso, lista vazia).
 */
function buildCourseReport(competence: string, today: string): Omit<CourseReportData, "header"> {
  const first = firstDayOfCompetence(competence);
  const last = lastDayOfCompetence(competence);
  const courseCharges = store.charges.filter((c) => c.kind === "course");
  const enrollmentClass = new Map(store.enrollments.map((e) => [e.id, e.classGroupId]));
  const classOf = (c: Charge) => c.classGroupId ?? (c.enrollmentId ? enrollmentClass.get(c.enrollmentId) : undefined);

  const rows: CourseReportRow[] = [];
  let receivedInPeriodCents = 0;
  for (const g of store.classGroups) {
    if (classBillingMode(g) !== "course") continue;
    const charges = courseCharges.filter((c) => classOf(c) === g.id);
    const runsInMonth = g.startDate <= last && (g.endDate ?? today) >= first;
    const chargedInMonth = charges.some((c) => c.dueDate.slice(0, 7) === competence || paidIn(c, competence));
    if (!runsInMonth && !chargedInMonth) continue;

    const enrollments = store.enrollments.filter((e) => e.classGroupId === g.id);
    const valid = enrollments.filter((e) => e.status !== "canceled");
    const ended = isCourseEnded(g, today);
    const sum = (list: Charge[]) => list.reduce((acc, c) => acc + c.amountCents, 0);
    receivedInPeriodCents += sum(charges.filter((c) => paidIn(c, competence)));
    rows.push({
      classGroupId: g.id,
      className: g.name,
      teacherName: store.professionals.find((p) => p.id === g.instructorId)?.name ?? "",
      startDate: g.startDate,
      endDate: g.endDate,
      enrolled: valid.length,
      completed: ended ? valid.filter((e) => e.status === "active").length : 0,
      canceled: enrollments.length - valid.length,
      contractedCents: sum(charges.filter((c) => !VOID_STATUSES.has(c.status))),
      receivedCents: sum(charges.filter((c) => c.status === "paid")),
      openCents: sum(charges.filter((c) => OPEN_STATUSES.has(c.status))),
    });
  }
  rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.className.localeCompare(b.className, "pt-BR"));
  return {
    totalContractedCents: rows.reduce((acc, r) => acc + r.contractedCents, 0),
    totalReceivedCents: rows.reduce((acc, r) => acc + r.receivedCents, 0),
    totalOpenCents: rows.reduce((acc, r) => acc + r.openCents, 0),
    receivedInPeriodCents,
    rows,
  };
}

/**
 * Pacotes do mes, um por pacote do catalogo: vendas e aulas compradas no mes
 * (sem as canceladas nem as aulas trazidas), aulas gastas no mes, saldo de
 * hoje e cobrancas pagas no mes. Linha sem nenhum numero nao aparece.
 */
function buildPackageReport(competence: string, today: string): Omit<PackageReportData, "header"> {
  const rowsById = new Map<string, PackageReportRow>();
  const rowOf = (packageId: string, fallbackName: string): PackageReportRow => {
    let row = rowsById.get(packageId);
    if (!row) {
      row = {
        packageId,
        packageName: store.lessonPackages.find((p) => p.id === packageId)?.name ?? fallbackName,
        sold: 0,
        lessonsSold: 0,
        lessonsUsed: 0,
        lessonsRemaining: 0,
        receivedCents: 0,
      };
      rowsById.set(packageId, row);
    }
    return row;
  };
  const studentPackages = store.studentPackages ?? [];
  const byStudentPackage = new Map(studentPackages.map((p) => [p.id, p]));
  for (const sp of studentPackages) {
    const row = rowOf(sp.packageId, sp.name);
    if (sp.status !== "canceled" && sp.purchasedAt.slice(0, 7) === competence) {
      row.sold += 1;
      row.lessonsSold += ownLessons(sp);
    }
    row.lessonsUsed += sp.usages.filter((u) => u.date.slice(0, 7) === competence).length;
    row.lessonsRemaining += packageState(sp, today).remaining;
  }
  for (const c of store.charges) {
    if (c.kind !== "package" || !c.studentPackageId || !paidIn(c, competence)) continue;
    const sp = byStudentPackage.get(c.studentPackageId);
    if (sp) rowOf(sp.packageId, sp.name).receivedCents += c.amountCents;
  }
  const rows = [...rowsById.values()]
    .filter((r) => r.sold + r.lessonsUsed + r.lessonsRemaining + r.receivedCents > 0)
    .sort((a, b) => a.packageName.localeCompare(b.packageName, "pt-BR"));
  return {
    totalSold: rows.reduce((acc, r) => acc + r.sold, 0),
    totalLessonsUsed: rows.reduce((acc, r) => acc + r.lessonsUsed, 0),
    totalLessonsRemaining: rows.reduce((acc, r) => acc + r.lessonsRemaining, 0),
    totalReceivedCents: rows.reduce((acc, r) => acc + r.receivedCents, 0),
    rows,
  };
}

export const reportsService = {
  getCatalog(): Promise<ReportMetadata[]> {
    return simulateRead(() =>
      CATALOG.filter((r) => actorCanSee(r.type)).map((r) => ({
        ...r,
        permissionRequired: REPORT_PERMISSION[r.type],
      })),
    );
  },

  generateReport(type: ReportType, filter: ReportFilter = {}): Promise<GeneratedReportData> {
    return simulateRead(() => {
      if (!actorCanSee(type)) {
        throw apiError("FORBIDDEN", "Você não tem permissão para ver este relatório.", { httpStatus: 403 });
      }
      // Mes local (toISOString daria o mes seguinte depois das 21h no Brasil).
      const competence = filter.competence || format(new Date(), "yyyy-MM");
      const [year, month] = competence.split("-");
      const periodLabel = `Competência ${month}/${year}`;

      switch (type) {
        case "attendance_sheet": {
          // Uma aula de uma turma: a escolhida ou, sem escolha, a primeira turma
          // ativa e a ultima aula do mes ate hoje (lista de chamada de verdade,
          // com a marcacao de cada aluno).
          const groups = store.classGroups
            .filter((g) => g.status === "active")
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
          const classGroup = groups.find((g) => g.id === filter.classGroupId) ?? groups[0] ?? null;
          const today = format(new Date(), "yyyy-MM-dd");
          const monthEnd = lastDayOfCompetence(competence);
          const sessions = classGroup
            ? sessionsOfClass(classGroup, firstDayOfCompetence(competence), monthEnd < today ? monthEnd : today)
            : [];
          const session = sessions.find((x) => x.id === filter.sessionId) ?? sessions.at(-1);
          const detail = session ? sessionDetailOf(session.id) : undefined;

          const modality = classGroup?.modalityId
            ? store.categories.find((c) => c.id === classGroup.modalityId)
            : null;
          const teacherId = detail?.instructorId ?? classGroup?.instructorId;
          const teacher = teacherId ? store.professionals.find((p) => p.id === teacherId) : null;

          const rows: AttendanceReportRow[] = (detail?.roster ?? []).map((r) => {
            const client = store.clients.find((c) => c.id === r.studentId);
            const progression = classGroup?.modalityId ? client?.progressions?.[classGroup.modalityId] : undefined;
            return {
              studentId: r.studentId,
              studentName: r.studentName,
              // Nivel salvo na modalidade da turma (as observacoes nao sao faixa).
              belt: progression?.levelName || undefined,
              status: r.attendance ?? "unmarked",
              // Sem registro de horario de chegada no sistema.
              checkInTime: undefined,
            };
          });
          const count = (status: AttendanceReportRow["status"]) => rows.filter((r) => r.status === status).length;
          const totalPresent = count("present");

          const data: AttendanceReportData = {
            header: buildHeader(session ? `Aula de ${session.date.slice(8, 10)}/${session.date.slice(5, 7)}/${session.date.slice(0, 4)}` : periodLabel),
            classGroupId: classGroup?.id,
            sessionId: session?.id,
            classOptions: groups.map((g) => ({ id: g.id, name: g.name })),
            sessionOptions: sessions.map((x) => ({ id: x.id, date: x.date, start: x.start })),
            // So dados reais: sem turma, sem nomes inventados.
            className: classGroup?.name || "Nenhuma turma ativa",
            modalityName: modality?.name || "—",
            teacherName: teacher?.name || "—",
            sessionDate: session?.date ?? competence,
            sessionTime: session?.start ?? "",
            totalPresent,
            totalAbsent: count("absent"),
            totalJustified: count("justified"),
            totalUnmarked: count("unmarked"),
            occupancyRatePercent: rows.length > 0 ? Math.round((totalPresent / rows.length) * 100) : 0,
            rows,
          };

          return { type, data };
        }

        case "students_roster": {
          const plansById = new Map(store.plans.map((p) => [p.id, p.name]));
          // Quem ja era aluno no mes escolhido (cadastrado ate o ultimo dia dele).
          const monthEnd = lastDayOfCompetence(competence);
          const inMonth = store.clients.filter((c) => !c.createdAt || localDateOf(c.createdAt) <= monthEnd);

          const rows: StudentRosterRow[] = inMonth.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || "Não informado",
            planName: (c.planId && plansById.get(c.planId)) || "Sem plano",
            dueDay: c.dueDay || 10,
            // Aluno inativado continua com membershipStatus "active" no cadastro:
            // o status do aluno manda.
            status:
              c.status !== "active"
                ? "inactive"
                : c.membershipStatus === "paused"
                ? "paused"
                : "active",
            belt: Object.values(c.progressions ?? {}).map((p) => p.levelName).join(", ") || undefined,
            enrolledAt: c.createdAt ? localDateOf(c.createdAt) : competence,
          }));

          const totalActive = rows.filter((r) => r.status === "active").length;
          const totalPaused = rows.filter((r) => r.status === "paused").length;
          const totalInactive = rows.filter((r) => r.status === "inactive").length;

          const data: StudentRosterReportData = {
            header: buildHeader(periodLabel),
            totalActive,
            totalPaused,
            totalInactive,
            rows,
          };

          return { type, data };
        }

        case "billing_statement": {
          // Mensalidades do mes nascem na leitura (como em Cobrancas e no Financeiro).
          autoGenerateMembershipCharges(competence);
          const today = format(new Date(), "yyyy-MM-dd");
          const clientsById = new Map(store.clients.map((c) => [c.id, c.name]));

          // Cobrancas da competencia, sem as canceladas nem as isentas (nao sao
          // receita nem divida).
          const chargesForCompetence = store.charges.filter(
            (ch) =>
              !VOID_STATUSES.has(ch.status) &&
              ((ch.competence && ch.competence === competence) ||
                (ch.dueDate && ch.dueDate.startsWith(competence))),
          );

          const rows: BillingStatementRow[] = chargesForCompetence.map((ch) => ({
            chargeId: ch.id,
            studentName: clientsById.get(ch.studentId) || "Aluno",
            amountCents: ch.amountCents,
            dueDate: ch.dueDate,
            // Atraso e derivado: em aberto com vencimento passado esta atrasada.
            status: ch.status === "paid" ? "paid" : ch.dueDate < today ? "overdue" : "pending",
            paidAt: ch.paidAt,
            paymentMethod: ch.method || undefined,
          }));

          const totalReceivedCents = rows
            .filter((r) => r.status === "paid")
            .reduce((acc, r) => acc + r.amountCents, 0);

          const totalPendingCents = rows
            .filter((r) => r.status === "pending")
            .reduce((acc, r) => acc + r.amountCents, 0);

          const totalOverdueCents = rows
            .filter((r) => r.status === "overdue")
            .reduce((acc, r) => acc + r.amountCents, 0);

          const totalBilledCents = totalReceivedCents + totalPendingCents + totalOverdueCents;

          const defaultRatePercent =
            totalBilledCents > 0
              ? Math.round((totalOverdueCents / totalBilledCents) * 1000) / 10
              : 0;

          const data: BillingStatementReportData = {
            header: buildHeader(periodLabel),
            totalBilledCents,
            totalReceivedCents,
            totalPendingCents,
            totalOverdueCents,
            defaultRatePercent,
            rows,
          };

          return { type, data };
        }

        case "course_summary": {
          const today = format(new Date(), "yyyy-MM-dd");
          const data: CourseReportData = { header: buildHeader(periodLabel), ...buildCourseReport(competence, today) };
          return { type, data };
        }

        case "package_summary": {
          const today = format(new Date(), "yyyy-MM-dd");
          const data: PackageReportData = { header: buildHeader(periodLabel), ...buildPackageReport(competence, today) };
          return { type, data };
        }

        case "monthly_birthdays": {
          const plansById = new Map(store.plans.map((p) => [p.id, p.name]));
          const targetMonthNum = parseInt(month, 10);

          // Alunos ativos com data de nascimento no mes selecionado.
          const rows: BirthdayRow[] = store.clients
            .filter((c) => c.status === "active" && c.birthDate?.slice(5, 7) === month)
            .map((c) => {
              const birthDate = c.birthDate as string;
              return {
                id: c.id,
                name: c.name,
                phone: c.phone || "Não informado",
                birthDate,
                day: Number(birthDate.slice(8, 10)),
                planName: (c.planId && plansById.get(c.planId)) || "Sem plano",
              };
            })
            .sort((a, b) => a.day - b.day);

          const monthNames = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
          ];
          const monthName = monthNames[targetMonthNum - 1] || month;

          const data: BirthdayReportData = {
            header: buildHeader(periodLabel),
            monthName,
            totalBirthdays: rows.length,
            rows,
          };

          return { type, data };
        }

        case "financial_income_statement": {
          assertFeature("reports_advanced");

          const categoriesById = new Map(store.financialCategories.map((c) => [c.id, c.name]));

          // 1. Cobrancas recebidas no mes (data local do pagamento, como o Resumo
          // do Financeiro). "Competencia OU pagamento" contava duas vezes a
          // cobranca de um mes paga no seguinte. Sem data de pagamento (dado
          // antigo), vale a competencia.
          const paidCharges = store.charges.filter(
            (ch) =>
              ch.status === "paid" &&
              (ch.paidAt ? paidIn(ch, competence) : ch.competence === competence),
          );
          // Cada tipo de cobranca vira uma linha propria (mensalidade, aula avulsa, cobranca avulsa, curso, pacote).
          const CHARGE_INCOME_LABEL: Record<ChargeKind, string> = {
            membership: "Mensalidades de Alunos",
            dropin: "Aulas Avulsas",
            extra: "Cobranças Avulsas",
            course: "Cursos",
            package: "Pacotes de aulas",
          };
          const chargeRevenue = new Map<string, number>();
          paidCharges.forEach((c) => {
            const label = CHARGE_INCOME_LABEL[c.kind];
            chargeRevenue.set(label, (chargeRevenue.get(label) ?? 0) + c.amountCents);
          });

          // 2. Receitas avulsas e produtos de lançamentos financeiros
          const manualIncomes = store.financialEntries.filter(
            (e) =>
              e.type === "income" &&
              e.status === "paid" &&
              e.dueDate.startsWith(competence),
          );

          // Agrupa receitas por categoria
          const incomeMap = new Map<string, number>();
          chargeRevenue.forEach((cents, label) => incomeMap.set(label, cents));
          manualIncomes.forEach((e) => {
            const catName = categoriesById.get(e.categoryId) || "Outras Receitas";
            incomeMap.set(catName, (incomeMap.get(catName) || 0) + e.amountCents);
          });

          // 3. Despesas do mês
          const manualExpenses = store.financialEntries.filter(
            (e) =>
              e.type === "expense" &&
              e.status === "paid" &&
              e.dueDate.startsWith(competence),
          );

          // 4. Pagamentos a professores
          const teacherPayouts = store.teacherPayouts.filter(
            (p) => p.competence === competence && p.status === "paid",
          );
          const teacherPayoutTotalCents = teacherPayouts.reduce((acc, p) => acc + p.totalCents, 0);

          const expenseMap = new Map<string, number>();
          if (teacherPayoutTotalCents > 0) {
            expenseMap.set("Repasse de Professores", teacherPayoutTotalCents);
          }
          manualExpenses.forEach((e) => {
            const catName = categoriesById.get(e.categoryId) || "Outras Despesas";
            expenseMap.set(catName, (expenseMap.get(catName) || 0) + e.amountCents);
          });

          // So dados reais: mes sem lancamento pago sai zerado (a tela mostra o vazio).
          const grossRevenueCents = Array.from(incomeMap.values()).reduce((a, b) => a + b, 0);
          const operatingExpensesCents = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);

          // Taxas do provedor de pagamento ainda nao sao registradas; quando forem,
          // entram aqui. Ate la, sem deducao estimada.
          const deductionsCents = 0;
          const netRevenueCents = grossRevenueCents - deductionsCents;
          const operationalResultCents = netRevenueCents - operatingExpensesCents;
          const operatingMarginPercent =
            netRevenueCents > 0
              ? Math.round((operationalResultCents / netRevenueCents) * 1000) / 10
              : 0;

          const incomeCategories: DRECategoryRow[] = Array.from(incomeMap.entries()).map(([name, amountCents]) => ({
            name,
            amountCents,
            percent: grossRevenueCents > 0 ? Math.round((amountCents / grossRevenueCents) * 1000) / 10 : 0,
          }));

          const expenseCategories: DRECategoryRow[] = Array.from(expenseMap.entries()).map(([name, amountCents]) => ({
            name,
            amountCents,
            percent: operatingExpensesCents > 0 ? Math.round((amountCents / operatingExpensesCents) * 1000) / 10 : 0,
          }));

          const data: DREStatementReportData = {
            header: buildHeader(periodLabel),
            grossRevenueCents,
            deductionsCents,
            netRevenueCents,
            operatingExpensesCents,
            operationalResultCents,
            operatingMarginPercent,
            incomeCategories,
            expenseCategories,
          };

          return { type, data };
        }

        case "churn_retention": {
          assertFeature("reports_advanced");

          // Pelas matriculas: aluno ativo = com alguma matricula valendo no dia.
          const first = firstDayOfCompetence(competence);
          const monthEnd = lastDayOfCompetence(competence);
          const today = format(new Date(), "yyyy-MM-dd");
          const endDay = monthEnd < today ? monthEnd : today;
          const dayBefore = format(addDays(parseISO(first), -1), "yyyy-MM-dd");
          const validOn = (e: (typeof store.enrollments)[number], date: string) =>
            localDateOf(e.enrolledAt) <= date &&
            (e.status !== "canceled" || (e.canceledAt !== undefined && localDateOf(e.canceledAt) > date));
          const activeOn = (date: string, classGroupId?: string) =>
            new Set(
              store.enrollments
                .filter((e) => (!classGroupId || e.classGroupId === classGroupId) && validOn(e, date))
                .map((e) => e.studentId),
            );
          const startSet = activeOn(dayBefore);
          const endSet = activeOn(endDay);
          const newEnrollments = [...endSet].filter((id) => !startSet.has(id)).length;
          const cancellations = [...startSet].filter((id) => !endSet.has(id)).length;
          const oneDecimal = (n: number) => Math.round(n * 10) / 10;
          const churnRatePercent = startSet.size > 0 ? oneDecimal((cancellations / startSet.size) * 100) : 0;

          // Por turma: ativos no fim e quem saiu dela no mes.
          const modalitiesBreakdown = store.classGroups
            .map((cg) => {
              const before = activeOn(dayBefore, cg.id);
              const after = activeOn(endDay, cg.id);
              const left = [...before].filter((id) => !after.has(id)).length;
              return {
                modalityName: cg.name,
                activeCount: after.size,
                churnRatePercent: before.size > 0 ? oneDecimal((left / before.size) * 100) : 0,
              };
            })
            .filter((row) => row.activeCount > 0 || row.churnRatePercent > 0);

          const data: ChurnReportData = {
            header: buildHeader(periodLabel),
            activeStudentsStart: startSet.size,
            newEnrollments,
            cancellations,
            activeStudentsEnd: endSet.size,
            netGrowth: endSet.size - startSet.size,
            churnRatePercent,
            retentionRatePercent: startSet.size > 0 ? oneDecimal(100 - churnRatePercent) : 0,
            modalitiesBreakdown,
          };

          return { type, data };
        }

        default:
          throw notFoundError("Relatório não encontrado.");
      }
    });
  },
};
