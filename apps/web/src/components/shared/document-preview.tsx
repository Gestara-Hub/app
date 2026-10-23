import type {
  DocumentBlock,
  DocumentColumn,
  DocumentModel,
  DocumentTableBlock,
  DocumentTone,
} from "@gestarahub/contracts";
import { displayCell } from "@/lib/documents/format";
import { cn } from "@/lib/utils";

/**
 * Previa na tela do `DocumentModel`, no mesmo desenho do PDF gerado no
 * servidor (lib/documents/document-pdf): faixa da marca, cabecalho com logo e
 * meta, blocos e rodape. A logo vem de /api/documents/logo (a do espaco ou a
 * do GestaraHub).
 */

const TONE_CLASS: Record<DocumentTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-rose-700 dark:text-rose-400",
  muted: "text-muted-foreground",
};

function alignClass(column: DocumentColumn): string {
  const align =
    column.align ??
    (column.format === "money" || column.format === "integer" || column.format === "percent" ? "right" : "left");
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

function TablePreview({ block }: { block: DocumentTableBlock }) {
  return (
    <div className="space-y-2">
      {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              {block.numbered ? <th className="w-8 px-2 py-2 text-center">#</th> : null}
              {block.columns.map((column) => (
                <th key={column.key} className={cn("px-2.5 py-2", alignClass(column))}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {block.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={block.columns.length + (block.numbered ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {block.emptyText}
                </td>
              </tr>
            ) : (
              block.rows.map((row, index) => (
                <tr key={index}>
                  {block.numbered ? (
                    <td className="px-2 py-2 text-center text-muted-foreground">{index + 1}</td>
                  ) : null}
                  {block.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-2.5 py-2 break-words",
                        alignClass(column),
                        TONE_CLASS[row.tones?.[column.key] ?? "default"],
                        column.key === "signature" && "min-w-32 border-l border-border",
                      )}
                    >
                      {column.key === "signature" ? null : displayCell(row.cells[column.key], column.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {block.totals && block.rows.length > 0 ? (
            <tfoot className="border-t border-border bg-muted/30 font-semibold">
              <tr>
                {block.numbered ? <td /> : null}
                {block.columns.map((column) => (
                  <td key={column.key} className={cn("px-2.5 py-2", alignClass(column))}>
                    {block.totals?.[column.key] === undefined ? null : displayCell(block.totals[column.key], column.format)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function BlockPreview({ block }: { block: DocumentBlock }) {
  switch (block.type) {
    case "kpis":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {block.items.slice(0, 4).map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className={cn("mt-1 text-lg font-bold break-words", TONE_CLASS[kpi.tone ?? "default"])}>
                {displayCell(kpi.value, kpi.format)}
              </p>
              {kpi.sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p> : null}
            </div>
          ))}
        </div>
      );
    case "fields":
      return (
        <div className="space-y-2">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <dl className="divide-y divide-border rounded-lg border border-border text-sm">
            {block.items.map((field, index) => (
              <div key={`${field.label}-${index}`} className="flex items-baseline justify-between gap-4 px-3 py-2">
                <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
                <dd
                  className={cn(
                    "min-w-0 break-words text-right",
                    field.strong ? "text-base font-bold" : "font-medium",
                    TONE_CLASS[field.tone ?? "default"],
                  )}
                >
                  {displayCell(field.value, field.format)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "table":
      return <TablePreview block={block} />;
    case "text":
      return (
        <div className="space-y-1">
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <p className={cn("text-sm", block.tone === "muted" ? "text-muted-foreground" : "text-foreground")}>
            {block.text}
          </p>
        </div>
      );
    case "signatures":
      return (
        <div className="grid gap-8 pt-8 sm:grid-cols-2">
          {block.lines.map((label) => (
            <div key={label} className="text-center">
              <div className="h-px bg-foreground/70" />
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      );
  }
}

export function DocumentPreview({ model, className }: { model: DocumentModel; className?: string }) {
  return (
    <article
      className={cn(
        "mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex h-1" aria-hidden>
        <span className="flex-1 bg-[#f38020]" />
        <span className="flex-1 bg-[#25b4b8]" />
        <span className="flex-1 bg-[#8a1b9e]" />
      </div>
      <div className="space-y-6 p-4 sm:p-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo dinamica do espaco */}
            <img src="/api/documents/logo" alt="" className="h-10 w-auto max-w-32 object-contain" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight break-words">{model.header.organizationName}</p>
              {model.header.details ? (
                <p className="text-xs text-muted-foreground break-words">{model.header.details}</p>
              ) : null}
            </div>
          </div>
          <dl className="shrink-0 space-y-0.5 text-xs text-muted-foreground sm:text-right">
            {model.meta.map((meta) => (
              <div key={meta.label}>
                <dt className="inline">{meta.label}: </dt>
                <dd className="inline text-foreground">{meta.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div>
          <h2 className="text-xl font-bold tracking-tight">{model.title}</h2>
          {model.subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{model.subtitle}</p> : null}
        </div>

        {model.blocks.map((block, index) => (
          <BlockPreview key={index} block={block} />
        ))}

        {model.footnote ? <p className="text-xs text-muted-foreground">{model.footnote}</p> : null}
      </div>
    </article>
  );
}
