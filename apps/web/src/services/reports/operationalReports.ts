import type {
  AttendanceReportData,
  AttendanceReportRow,
  BirthdayReportData,
  BirthdayRow,
  GeneratedReportData,
  StudentRosterReportData,
  StudentRosterRow,
} from "@gestarahub/contracts";
import { firstDayOfCompetence, lastDayOfCompetence, localDateOf } from "@gestarahub/core/finance";
import { format } from "date-fns";
import { store } from "@/services/world/store";
import { sessionDetailOf, sessionsOfClass } from "../turmasService";
import { buildHeader } from "./reportCatalog";
import type { ReportContext } from "./reportContext";


/** Relatorios do dia a dia: lista de presenca, relacao de alunos e aniversariantes. */

export async function buildAttendanceSheet({ competence, periodLabel, filter }: ReportContext): Promise<GeneratedReportData> {
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

    return { type: "attendance_sheet", data };
}

export async function buildStudentsRoster({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
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

    return { type: "students_roster", data };
}

export async function buildMonthlyBirthdays({ competence, periodLabel }: ReportContext): Promise<GeneratedReportData> {
  const month = competence.split("-")[1];
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

    return { type: "monthly_birthdays", data };
}
