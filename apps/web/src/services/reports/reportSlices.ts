import type { ClassGroup, ReportFilter, ReportType } from "@gestarahub/contracts";
import { firstDayOfCompetence, lastDayOfCompetence } from "@gestarahub/core/finance";
import { sessionIdsInRange } from "../classes/classSlices";
import { WORLD_COLLECTIONS } from "../world/tables";
import type { MethodSlice } from "../world/slices";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Recortes dos relatorios (doc 19, fase 2). Nenhum relatorio le mensagens nem
 * avaliacoes, e so a lista de chamada le presencas: a das aulas do mes (dela
 * sai a aula escolhida). O resto do espaco entra inteiro (cobrancas,
 * lancamentos e professores para o financeiro; alunos e matriculas para
 * cadastro, aniversarios e retencao). Conferido nos testes contra o espaco
 * inteiro (`WORLD_SLICE_CHECK=1`).
 */
const NOT_USED_BY_REPORTS = new Set(["attendances", "messageLogs", "messageTemplates", "assessments"]);

const generateReport: MethodSlice = async ([type, filter], load) => {
  await Promise.all(
    WORLD_COLLECTIONS.filter((c) => c.kind === "list" && !c.appendOnly && !NOT_USED_BY_REPORTS.has(c.key)).map((c) =>
      load.all(c.key),
    ),
  );
  load.none("auditLog");
  if ((type as ReportType) !== "attendance_sheet") {
    load.none("attendances");
    return;
  }
  // Mesmo mes do relatorio (o mes local quando nao vem no filtro).
  const competence = (filter as ReportFilter | undefined)?.competence || dateInSpace().slice(0, 7);
  const groups = (await load.all("classGroups")) as unknown as ClassGroup[];
  const ids = sessionIdsInRange(groups, firstDayOfCompetence(competence), lastDayOfCompetence(competence));
  await load.where("attendances", "sessionId", ids);
};

export const reportSlices: Record<string, MethodSlice> = {
  // So o catalogo e a permissao de quem pede (vem da sessao).
  getCatalog: async () => undefined,
  generateReport,
};
