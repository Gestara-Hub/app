import type { DocumentModel } from "@gestarahub/contracts";
import { csvCell } from "./format";

/**
 * Celula que comeca como formula (`=`, `+`, `-`, `@`, tab) ganha um apostrofo:
 * o Excel a mostra como texto em vez de executar (auditoria de 30/10/2026: um
 * nome de aluno malicioso virava formula na planilha do dono). Numero negativo
 * ("-150,00", "-R$ 150,00") continua numero.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER_LIKE = /^-?\s*(R\$\s*)?[\d.,]+%?$/;
export const csvSafe = (value: string) => (FORMULA_START.test(value) && !NUMBER_LIKE.test(value) ? `'${value}` : value);

/** Campo entre aspas (aspas internas dobradas), separador ";" do Excel em pt-BR. */
const quote = (value: string) => `"${csvSafe(value).replace(/"/g, '""')}"`;
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
