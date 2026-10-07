import type {
  AttendanceReportData,
  AttendanceReportRow,
  BirthdayReportData,
  BirthdayRow,
  BillingStatementReportData,
  BillingStatementRow,
  ChurnReportData,
  DRECategoryRow,
  DREStatementReportData,
  GeneratedReportData,
  ReportFilter,
  ReportHeaderInfo,
  ReportMetadata,
  ReportType,
  StudentRosterReportData,
  StudentRosterRow,
} from "@gestarahub/contracts";
import { nowIso, simulateRead } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { assertFeature } from "./subscriptionService";

const CATALOG: ReportMetadata[] = [
  // 1. Operacionais (Free)
  {
    type: "attendance_sheet",
    title: "Lista de Presença & Chamada",
    description: "Relação de presença por turma e data, ideal para controle de tatame e frequência.",
    category: "operational",
    tierRequired: "free",
    iconName: "ClipboardCheck",
  },
  {
    type: "students_roster",
    title: "Relação Geral de Alunos",
    description: "Listagem completa com plano, data de matrícula, faixa/graduação e status cadastral.",
    category: "operational",
    tierRequired: "free",
    iconName: "Users",
  },
  {
    type: "billing_statement",
    title: "Extrato de Mensalidades & Inadimplência",
    description: "Resumo de cobranças geradas, recebidas, pendentes e taxa de inadimplência.",
    category: "operational",
    tierRequired: "free",
    iconName: "Wallet",
  },
  {
    type: "monthly_birthdays",
    title: "Aniversariantes do Mês",
    description: "Lista de aniversariantes para ações de relacionamento, homenagens e felicitações.",
    category: "operational",
    tierRequired: "free",
    iconName: "Cake",
  },
  // 2. Gerenciais Avançados (Pro)
  {
    type: "financial_income_statement",
    title: "DRE Gerencial Completa",
    description: "Demonstrativo de Resultado do Exercício com margem líquida, custos fixos e variáveis.",
    category: "financial",
    tierRequired: "pro",
    iconName: "FileSpreadsheet",
  },
  {
    type: "churn_retention",
    title: "Análise de Churn & Retenção",
    description: "Evolução da base de alunos, taxa de cancelamento e retenção por modalidade.",
    category: "retention",
    tierRequired: "pro",
    iconName: "TrendingUp",
  },
];

function buildHeader(periodLabel: string): ReportHeaderInfo {
  return {
    organizationName: store.organization.name,
    organizationSegment: store.organization.segment || "Academia",
    unitName: store.unit.name,
    generatedAt: nowIso(),
    generatedBy: "Administração",
    periodLabel,
  };
}

export const reportsService = {
  getCatalog(): Promise<ReportMetadata[]> {
    return simulateRead(() => [...CATALOG]);
  },

  generateReport(type: ReportType, filter: ReportFilter = {}): Promise<GeneratedReportData> {
    return simulateRead(() => {
      const competence = filter.competence || new Date().toISOString().slice(0, 7);
      const [year, month] = competence.split("-");
      const periodLabel = `Competência ${month}/${year}`;

      switch (type) {
        case "attendance_sheet": {
          const classGroup =
            (filter.classGroupId && store.classGroups.find((cg) => cg.id === filter.classGroupId)) ||
            store.classGroups[0] ||
            null;

          const modality = classGroup?.modalityId
            ? store.categories.find((c) => c.id === classGroup.modalityId)
            : null;

          const teacher = classGroup?.instructorId
            ? store.professionals.find((p) => p.id === classGroup.instructorId)
            : null;

          // Alunos matriculados na turma
          const enrollments = classGroup
            ? store.enrollments.filter((e) => e.classGroupId === classGroup.id && e.status === "active")
            : [];

          const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));
          const targetClients =
            enrolledStudentIds.size > 0
              ? store.clients.filter((c) => enrolledStudentIds.has(c.id))
              : store.clients;

          const rows: AttendanceReportRow[] = targetClients.map((c) => {
            const hasAttendance = store.attendances.some(
              (a) => a.studentId === c.id && a.markedAt?.startsWith(competence),
            );

            return {
              studentId: c.id,
              studentName: c.name,
              belt: c.notes || "Geral",
              status: hasAttendance ? "present" : "absent",
              checkInTime: hasAttendance ? "07:05" : undefined,
            };
          });

          const totalPresent = rows.filter((r) => r.status === "present").length;
          const totalAbsent = rows.filter((r) => r.status === "absent").length;
          const occupancyRatePercent =
            rows.length > 0 ? Math.round((totalPresent / rows.length) * 100) : 0;

          const data: AttendanceReportData = {
            header: buildHeader(periodLabel),
            className: classGroup?.name || "Turma Geral",
            modalityName: modality?.name || "Jiu-Jitsu",
            teacherName: teacher?.name || "Prof. Titular",
            sessionDate: `${competence}-10`,
            sessionTime: "07:00 às 08:30",
            totalPresent,
            totalAbsent,
            occupancyRatePercent,
            rows,
          };

          return { type, data };
        }

        case "students_roster": {
          const plansById = new Map(store.plans.map((p) => [p.id, p.name]));

          const rows: StudentRosterRow[] = store.clients.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || "Não informado",
            planName: (c.planId && plansById.get(c.planId)) || "Sem plano",
            dueDay: c.dueDay || 10,
            status:
              c.membershipStatus === "active"
                ? "active"
                : c.membershipStatus === "paused"
                ? "paused"
                : c.status === "active"
                ? "active"
                : "inactive",
            belt: c.notes || undefined,
            enrolledAt: c.createdAt ? c.createdAt.slice(0, 10) : competence,
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
          const clientsById = new Map(store.clients.map((c) => [c.id, c.name]));

          // Filtra cobranças da competência selecionada
          const chargesForCompetence = store.charges.filter(
            (ch) =>
              (ch.competence && ch.competence === competence) ||
              (ch.dueDate && ch.dueDate.startsWith(competence)),
          );

          const rows: BillingStatementRow[] = chargesForCompetence.map((ch) => ({
            chargeId: ch.id,
            studentName: clientsById.get(ch.studentId) || "Aluno",
            amountCents: ch.amountCents,
            dueDate: ch.dueDate,
            status: ch.status === "paid" ? "paid" : ch.status === "overdue" ? "overdue" : "pending",
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

        case "monthly_birthdays": {
          const plansById = new Map(store.plans.map((p) => [p.id, p.name]));
          const targetMonthNum = parseInt(month, 10);

          // Verifica se algum cliente possui data de nascimento no mês selecionado
          const rows: BirthdayRow[] = store.clients
            .map((c, idx) => {
              // Se tiver notas com formato de data ou simulação baseada no cadastro
              const day = ((idx * 7 + 3) % 28) + 1;
              return {
                id: c.id,
                name: c.name,
                phone: c.phone || "Não informado",
                birthDate: `1995-${month}-${String(day).padStart(2, "0")}`,
                day,
                planName: (c.planId && plansById.get(c.planId)) || "Plano Geral",
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

          // 1. Receitas de mensalidades pagas nesta competência
          const paidCharges = store.charges.filter(
            (ch) =>
              ch.status === "paid" &&
              ((ch.competence && ch.competence === competence) ||
                (ch.paidAt && ch.paidAt.startsWith(competence))),
          );
          const membershipRevenueCents = paidCharges.reduce((acc, c) => acc + c.amountCents, 0);

          // 2. Receitas avulsas e produtos de lançamentos financeiros
          const manualIncomes = store.financialEntries.filter(
            (e) =>
              e.type === "income" &&
              e.status === "paid" &&
              e.dueDate.startsWith(competence),
          );

          // Agrupa receitas por categoria
          const incomeMap = new Map<string, number>();
          if (membershipRevenueCents > 0) {
            incomeMap.set("Mensalidades de Alunos", membershipRevenueCents);
          }
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

          // Se a academia ainda não tiver lançamentos cadastrados, usamos os valores base para o DRE não zerar
          let grossRevenueCents = Array.from(incomeMap.values()).reduce((a, b) => a + b, 0);
          let operatingExpensesCents = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);

          if (grossRevenueCents === 0 && operatingExpensesCents === 0) {
            grossRevenueCents = 1860000;
            operatingExpensesCents = 845000;
            incomeMap.set("Mensalidades de Alunos", 1520000);
            incomeMap.set("Aulas Avulsas (Drop-in)", 140000);
            incomeMap.set("Venda de Produtos", 120000);
            incomeMap.set("Taxa de Matrícula", 80000);

            expenseMap.set("Repasse de Professores", 420000);
            expenseMap.set("Aluguel & Condomínio", 250000);
            expenseMap.set("Contas (Luz, Água, Internet)", 75000);
            expenseMap.set("Marketing & Anúncios", 60000);
            expenseMap.set("Material de Limpeza", 40000);
          }

          const deductionsCents = Math.round(grossRevenueCents * 0.02); // 2% taxa de gateway/split
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

          const totalClients = store.clients.length;
          const activeStudentsEnd = store.clients.filter(
            (c) => c.membershipStatus === "active" || c.status === "active",
          ).length;

          const cancellations = store.clients.filter(
            (c) => c.membershipStatus === "canceled" || c.status === "inactive",
          ).length;

          const newEnrollments = store.clients.filter((c) =>
            c.createdAt ? c.createdAt.startsWith(competence) : false,
          ).length;

          // Se tiver alunos reais cadastrados no store, calcula as taxas reais
          const baseStart = Math.max(1, activeStudentsEnd - newEnrollments + cancellations);
          const activeStudentsStart = totalClients > 0 ? baseStart : 118;
          const finalActive = totalClients > 0 ? activeStudentsEnd : 128;
          const finalNew = totalClients > 0 ? newEnrollments : 14;
          const finalCancelled = totalClients > 0 ? cancellations : 4;
          const netGrowth = finalNew - finalCancelled;

          const churnRatePercent =
            activeStudentsStart > 0
              ? Math.round((finalCancelled / activeStudentsStart) * 1000) / 10
              : 0;
          const retentionRatePercent = Math.max(0, Math.min(100, 100 - churnRatePercent));

          // Quebra por turmas/modalidades existentes
          const modalitiesBreakdown =
            store.classGroups.length > 0
              ? store.classGroups.map((cg) => ({
                  modalityName: cg.name,
                  activeCount: store.enrollments.filter(
                    (e) => e.classGroupId === cg.id && e.status === "active",
                  ).length || 12,
                  churnRatePercent: 2.8,
                }))
              : [
                  { modalityName: "Jiu-Jitsu Adulto", activeCount: 76, churnRatePercent: 2.6 },
                  { modalityName: "Jiu-Jitsu Kids", activeCount: 34, churnRatePercent: 2.9 },
                  { modalityName: "No-Gi / Submission", activeCount: 18, churnRatePercent: 5.5 },
                ];

          const data: ChurnReportData = {
            header: buildHeader(periodLabel),
            activeStudentsStart,
            newEnrollments: finalNew,
            cancellations: finalCancelled,
            activeStudentsEnd: finalActive,
            netGrowth,
            churnRatePercent,
            retentionRatePercent,
            modalitiesBreakdown,
          };

          return { type, data };
        }

        default:
          throw new Error(`Tipo de relatório não suportado: ${type}`);
      }
    });
  },
};
