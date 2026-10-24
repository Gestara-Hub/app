import { describe, expect, it } from "vitest";
import type {
  ChurnReportData,
  DocumentField,
  DocumentFieldsBlock,
  DocumentKpi,
  DocumentKpisBlock,
} from "@gestarahub/contracts";
import { displayCell } from "../format";
import { reportToDocument } from "../report-documents";

const header = {
  organizationName: "Academia Exemplo",
  organizationSegment: "Lutas",
  unitName: "Unidade Centro",
  generatedAt: "2026-10-23T10:30:00.000Z",
  generatedBy: "Dono do espaço",
  periodLabel: "Outubro de 2026",
};

const churn = (over: Partial<ChurnReportData>): ChurnReportData => ({
  header,
  activeStudentsStart: 0,
  newEnrollments: 7,
  cancellations: 0,
  activeStudentsEnd: 7,
  netGrowth: 7,
  churnRatePercent: 0,
  retentionRatePercent: 0,
  modalitiesBreakdown: [],
  ...over,
});

function kpiAndFields(data: ChurnReportData) {
  const doc = reportToDocument({ type: "churn_retention", data }, "2026-10", { subtitle: "" } as never);
  const kpis = doc.blocks.find((b): b is DocumentKpisBlock => b.type === "kpis");
  const fields = doc.blocks.find((b): b is DocumentFieldsBlock => b.type === "fields");
  const shown = (items: (DocumentKpi | DocumentField)[] | undefined, label: string) => {
    const item = items?.find((i) => i.label === label);
    return displayCell(item?.value ?? null, item?.format);
  };
  return { retention: shown(kpis?.items, "Retenção"), churn: shown(fields?.items, "Cancelamento") };
}

describe("Retenção de alunos sem base (achado 50)", () => {
  it("mês com todos os alunos novos mostra — em vez de 0%", () => {
    const shown = kpiAndFields(churn({ activeStudentsStart: 0 }));
    expect(shown.retention).toBe("—");
    expect(shown.churn).toBe("—");
  });

  it("com alunos no início, mostra a porcentagem", () => {
    const shown = kpiAndFields(churn({ activeStudentsStart: 10, cancellations: 1, churnRatePercent: 10, retentionRatePercent: 90 }));
    expect(shown.retention).toBe("90%");
    expect(shown.churn).toBe("10%");
  });
});
