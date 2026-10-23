import type { DocumentModel } from "@gestarahub/contracts";
import { csvCell } from "./format";

/** Campo entre aspas (aspas internas dobradas), separador ";" do Excel em pt-BR. */
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const line = (cells: string[]) => `${cells.map(quote).join(";")}\n`;

/**
 * CSV do documento, gerado no servidor junto com o PDF: titulo e periodo,
 * indicadores e campos como "rotulo;valor" e cada tabela com cabecalho, linhas
 * e total. Comeca com BOM (o Excel le os acentos).
 */
export function documentToCsv(model: DocumentModel): string {
  let out = "﻿";
  out += line([model.title, ...(model.subtitle ? [model.subtitle] : [])]);
  for (const meta of model.meta) out += line([meta.label, meta.value]);

  for (const block of model.blocks) {
    out += "\n";
    switch (block.type) {
      case "kpis":
        for (const kpi of block.items) out += line([kpi.label, csvCell(kpi.value, kpi.format)]);
        break;
      case "fields":
        if (block.title) out += line([block.title]);
        for (const field of block.items) out += line([field.label, csvCell(field.value, field.format)]);
        break;
      case "table": {
        if (block.title) out += line([block.title]);
        const columns = block.numbered ? [{ key: "#", label: "#" }, ...block.columns] : block.columns;
        out += line(columns.map((c) => c.label));
        block.rows.forEach((row, index) => {
          out += line(
            columns.map((c) =>
              c.key === "#" && block.numbered
                ? String(index + 1)
                : csvCell(row.cells[c.key], "format" in c ? c.format : undefined),
            ),
          );
        });
        if (block.totals) {
          const totals = block.totals;
          out += line(columns.map((c) => csvCell(totals[c.key], "format" in c ? c.format : undefined)));
        }
        break;
      }
      case "text":
        if (block.title) out += line([block.title]);
        out += line([block.text]);
        break;
      case "signatures":
        break;
    }
  }
  return out;
}
