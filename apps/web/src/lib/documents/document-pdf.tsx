import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  DocumentBlock,
  DocumentColumn,
  DocumentFieldsBlock,
  DocumentKpisBlock,
  DocumentModel,
  DocumentSignaturesBlock,
  DocumentTableBlock,
  DocumentTextBlock,
  DocumentTone,
} from "@gestarahub/contracts";
import { displayCell } from "./format";

/**
 * Layout unico dos documentos em PDF (gerado no servidor com @react-pdf):
 * faixa com as cores da marca, cabecalho (logo, espaco, titulo e meta),
 * blocos do modelo e rodape fixo com a pagina. Fonte Helvetica embutida
 * (acentos do portugues inclusos). Trocar algo aqui muda todos os documentos.
 */

const COLOR = {
  text: "#18181b",
  muted: "#71717a",
  border: "#e4e4e7",
  soft: "#f4f4f5",
  softer: "#fafafa",
  positive: "#047857",
  negative: "#be123c",
};

/** Cores do logo: laranja, azul-piscina e roxo. */
const BRAND = ["#f38020", "#25b4b8", "#8a1b9e"];

const TONE_COLOR: Record<DocumentTone, string> = {
  default: COLOR.text,
  positive: COLOR.positive,
  negative: COLOR.negative,
  muted: COLOR.muted,
};

// Sem hifenizacao automatica: "VENCIMENTO" nao quebra em "VENCIMEN-TO".
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 54,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.text,
    lineHeight: 1.35,
  },
  brandBar: { flexDirection: "row", height: 4, marginHorizontal: -36, marginBottom: 22 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  logo: { height: 34, maxWidth: 120, objectFit: "contain" },
  organization: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  details: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  meta: { alignItems: "flex-end", gap: 2, flexShrink: 0, maxWidth: 220 },
  metaLine: { fontSize: 8, color: COLOR.muted, textAlign: "right" },
  metaValue: { color: COLOR.text },
  divider: { height: 1, backgroundColor: COLOR.border, marginTop: 14, marginBottom: 14 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.2 },
  subtitle: { fontSize: 9, color: COLOR.muted, marginTop: 4, lineHeight: 1.3 },
  block: { marginTop: 16 },
  blockTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderColor: COLOR.border, borderRadius: 6, padding: 9 },
  kpiLabel: { fontSize: 7.5, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 3 },
  kpiSub: { fontSize: 7.5, color: COLOR.muted, marginTop: 2 },
  fields: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 6 },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: { color: COLOR.muted, flexShrink: 0 },
  fieldValue: { textAlign: "right", flexShrink: 1 },
  fieldStrong: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  table: { borderWidth: 1, borderColor: COLOR.border, borderRadius: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.border },
  rowLast: { borderBottomWidth: 0 },
  headRow: { backgroundColor: COLOR.soft },
  totalsRow: { backgroundColor: COLOR.softer },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  headCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLOR.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  boldCell: { fontFamily: "Helvetica-Bold" },
  numberCell: { width: 22, color: COLOR.muted, textAlign: "center" },
  empty: { padding: 14, textAlign: "center", color: COLOR.muted },
  text: { fontSize: 9 },
  signatures: { flexDirection: "row", gap: 24, marginTop: 36 },
  signature: { flex: 1, alignItems: "center" },
  signatureLine: { alignSelf: "stretch", height: 1, backgroundColor: COLOR.text, marginBottom: 4 },
  signatureLabel: { fontSize: 8, color: COLOR.muted, textAlign: "center" },
  footnote: { fontSize: 7.5, color: COLOR.muted, marginTop: 18 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLOR.muted,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    paddingTop: 6,
  },
});

/** Logo como data URI (PNG ou JPG); sem logo, o cabecalho fica so com o nome. */
export interface DocumentLogo {
  src: string;
}

function alignOf(column: DocumentColumn): "left" | "center" | "right" {
  if (column.align) return column.align;
  return column.format === "money" || column.format === "integer" || column.format === "percent"
    ? "right"
    : "left";
}

function KpisBlock({ block }: { block: DocumentKpisBlock }) {
  return (
    <View style={styles.kpis} wrap={false}>
      {block.items.slice(0, 4).map((kpi) => (
        <View key={kpi.label} style={styles.kpi}>
          <Text style={styles.kpiLabel}>{kpi.label}</Text>
          <Text style={[styles.kpiValue, { color: TONE_COLOR[kpi.tone ?? "default"] }]}>
            {displayCell(kpi.value, kpi.format)}
          </Text>
          {kpi.sub ? <Text style={styles.kpiSub}>{kpi.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function FieldsBlock({ block }: { block: DocumentFieldsBlock }) {
  return (
    <View wrap={false}>
      {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
      <View style={styles.fields}>
        {block.items.map((field, index) => (
          <View
            key={`${field.label}-${index}`}
            style={[styles.field, index === block.items.length - 1 ? styles.fieldLast : {}]}
          >
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text
              style={[
                styles.fieldValue,
                field.strong ? styles.fieldStrong : {},
                { color: TONE_COLOR[field.tone ?? "default"] },
              ]}
            >
              {displayCell(field.value, field.format)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TableBlock({ block }: { block: DocumentTableBlock }) {
  const lastIndex = block.rows.length - 1;
  return (
    <View>
      {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]} wrap={false}>
          {block.numbered ? <Text style={[styles.cell, styles.headCell, styles.numberCell]}>#</Text> : null}
          {block.columns.map((column) => (
            <Text
              key={column.key}
              style={[styles.cell, styles.headCell, { flex: column.width ?? 1, textAlign: alignOf(column) }]}
            >
              {column.label}
            </Text>
          ))}
        </View>
        {block.rows.length === 0 ? (
          <Text style={styles.empty}>{block.emptyText}</Text>
        ) : (
          block.rows.map((row, index) => (
            <View
              key={index}
              wrap={false}
              style={[styles.row, index === lastIndex && !block.totals ? styles.rowLast : {}]}
            >
              {block.numbered ? <Text style={[styles.cell, styles.numberCell]}>{index + 1}</Text> : null}
              {block.columns.map((column) => (
                <Text
                  key={column.key}
                  style={[
                    styles.cell,
                    {
                      flex: column.width ?? 1,
                      textAlign: alignOf(column),
                      color: TONE_COLOR[row.tones?.[column.key] ?? "default"],
                    },
                  ]}
                >
                  {column.key === "signature" ? " " : displayCell(row.cells[column.key], column.format)}
                </Text>
              ))}
            </View>
          ))
        )}
        {block.totals && block.rows.length > 0 ? (
          <View style={[styles.row, styles.rowLast, styles.totalsRow]} wrap={false}>
            {block.numbered ? <Text style={[styles.cell, styles.numberCell]} /> : null}
            {block.columns.map((column) => (
              <Text
                key={column.key}
                style={[styles.cell, styles.boldCell, { flex: column.width ?? 1, textAlign: alignOf(column) }]}
              >
                {block.totals?.[column.key] === undefined ? "" : displayCell(block.totals[column.key], column.format)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TextBlock({ block }: { block: DocumentTextBlock }) {
  return (
    <View wrap={false}>
      {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
      <Text style={[styles.text, block.tone === "muted" ? { color: COLOR.muted } : {}]}>{block.text}</Text>
    </View>
  );
}

function SignaturesBlock({ block }: { block: DocumentSignaturesBlock }) {
  return (
    <View style={styles.signatures} wrap={false}>
      {block.lines.map((label) => (
        <View key={label} style={styles.signature}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Block({ block }: { block: DocumentBlock }) {
  switch (block.type) {
    case "kpis":
      return <KpisBlock block={block} />;
    case "fields":
      return <FieldsBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "signatures":
      return <SignaturesBlock block={block} />;
  }
}

export function DocumentPdf({ model, logo }: { model: DocumentModel; logo?: DocumentLogo | null }) {
  return (
    <Document title={model.title} author={model.header.organizationName} creator="GestaraHub" producer="GestaraHub">
      <Page size="A4" orientation={model.landscape ? "landscape" : "portrait"} style={styles.page}>
        <View style={styles.brandBar} fixed>
          {BRAND.map((color) => (
            <View key={color} style={{ flex: 1, backgroundColor: color }} />
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf nao tem alt.
              <Image style={styles.logo} src={logo.src} />
            ) : null}
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.organization}>{model.header.organizationName}</Text>
              {model.header.details ? <Text style={styles.details}>{model.header.details}</Text> : null}
            </View>
          </View>
          <View style={styles.meta}>
            {model.meta.map((meta) => (
              <Text key={meta.label} style={styles.metaLine}>
                {meta.label}: <Text style={styles.metaValue}>{meta.value}</Text>
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{model.title}</Text>
        {model.subtitle ? <Text style={styles.subtitle}>{model.subtitle}</Text> : null}

        {model.blocks.map((block, index) => (
          <View key={index} style={styles.block}>
            <Block block={block} />
          </View>
        ))}

        {model.footnote ? <Text style={styles.footnote}>{model.footnote}</Text> : null}

        <View style={styles.footer} fixed>
          <Text>Emitido pelo GestaraHub</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
