import { describe, expect, it } from "vitest";
import {
  ENTRY_ATTACHMENT_RULES,
  RECEIPT_FILE_RULES,
  fileIssue,
  fileTypeLabel,
  filesSchema,
  formatBytes,
  matchesAccept,
  sameFile,
} from "@/lib/files";

function makeFile(name: string, type: string, size = 10, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, { type, lastModified });
}

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((i) => i.message) ?? [];
}

describe("matchesAccept", () => {
  it("sem accept aceita tudo", () => {
    expect(matchesAccept({ name: "a.exe", type: "application/x-msdownload" })).toBe(true);
    expect(matchesAccept({ name: "a.exe", type: "" }, [])).toBe(true);
  });

  it("MIME exato", () => {
    expect(matchesAccept({ name: "a.pdf", type: "application/pdf" }, ["application/pdf"])).toBe(true);
    expect(matchesAccept({ name: "a.png", type: "image/png" }, ["application/pdf"])).toBe(false);
  });

  it("curinga image/*", () => {
    expect(matchesAccept({ name: "a.png", type: "image/png" }, ["image/*"])).toBe(true);
    expect(matchesAccept({ name: "a.jpg", type: "IMAGE/JPEG" }, ["image/*"])).toBe(true);
    expect(matchesAccept({ name: "a.pdf", type: "application/pdf" }, ["image/*"])).toBe(false);
  });

  it("extensao .pdf, sem diferenciar caixa e mesmo sem MIME", () => {
    expect(matchesAccept({ name: "Recibo.PDF", type: "" }, [".pdf"])).toBe(true);
    expect(matchesAccept({ name: "recibo.pdf.txt", type: "" }, [".pdf"])).toBe(false);
  });

  it("basta bater com uma das regras", () => {
    expect(matchesAccept({ name: "a.pdf", type: "application/pdf" }, RECEIPT_FILE_RULES.accept)).toBe(true);
    expect(matchesAccept({ name: "a.txt", type: "text/plain" }, RECEIPT_FILE_RULES.accept)).toBe(false);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "1,5 KB"],
    [820 * 1024, "820 KB"],
    [1.2 * 1024 * 1024, "1,2 MB"],
    [10 * 1024 * 1024, "10 MB"],
    [3 * 1024 * 1024 * 1024, "3 GB"],
    [2048 * 1024 * 1024 * 1024, "2.048 GB"],
  ])("%d bytes -> %j", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("fileTypeLabel", () => {
  it("usa o subtipo do MIME, com jpeg virando JPG", () => {
    expect(fileTypeLabel("recibo.pdf", "application/pdf")).toBe("PDF");
    expect(fileTypeLabel("foto.png", "image/png")).toBe("PNG");
    expect(fileTypeLabel("foto.jpeg", "image/jpeg")).toBe("JPG");
  });

  it("sem MIME cai na extensao", () => {
    expect(fileTypeLabel("planilha.xlsx", "")).toBe("XLSX");
  });

  it("sem MIME e sem extensao vira 'Arquivo'", () => {
    expect(fileTypeLabel("LEIAME", "")).toBe("Arquivo");
  });
});

describe("fileIssue", () => {
  it("arquivo valido nao tem problema", () => {
    expect(fileIssue(makeFile("foto.png", "image/png"), RECEIPT_FILE_RULES)).toBeUndefined();
  });

  it("formato nao aceito cita o rotulo dos tipos", () => {
    expect(fileIssue(makeFile("nota.txt", "text/plain"), RECEIPT_FILE_RULES)).toBe(
      "Formato não aceito (use imagem ou PDF).",
    );
  });

  it("formato nao aceito sem rotulo", () => {
    expect(fileIssue(makeFile("nota.txt", "text/plain"), { accept: ["image/*"] })).toBe("Formato não aceito.");
  });

  it("arquivo grande demais cita o limite", () => {
    expect(fileIssue(makeFile("foto.png", "image/png", 2000), { maxSizeBytes: 1024 })).toBe(
      "Arquivo maior que 1 KB.",
    );
    expect(
      fileIssue(makeFile("foto.png", "image/png", RECEIPT_FILE_RULES.maxSizeBytes + 1), RECEIPT_FILE_RULES),
    ).toBe("Arquivo maior que 4 MB.");
  });

  it("no limite exato ainda passa", () => {
    expect(fileIssue(makeFile("foto.png", "image/png", 1024), { maxSizeBytes: 1024 })).toBeUndefined();
  });

  it("formato e checado antes do tamanho", () => {
    expect(
      fileIssue(makeFile("nota.txt", "text/plain", 2000), { accept: ["image/*"], maxSizeBytes: 1024 }),
    ).toBe("Formato não aceito.");
  });
});

describe("sameFile", () => {
  it("compara nome, tamanho e data de modificacao", () => {
    const a = makeFile("a.png", "image/png", 10, 5);
    expect(sameFile(a, makeFile("a.png", "image/png", 10, 5))).toBe(true);
    expect(sameFile(a, makeFile("a.png", "image/png", 11, 5))).toBe(false);
    expect(sameFile(a, makeFile("a.png", "image/png", 10, 6))).toBe(false);
    expect(sameFile(a, makeFile("b.png", "image/png", 10, 5))).toBe(false);
  });
});

describe("filesSchema", () => {
  it("lista vazia passa quando nao e obrigatorio", () => {
    expect(filesSchema(RECEIPT_FILE_RULES).safeParse([]).success).toBe(true);
  });

  it("obrigatorio exige ao menos um arquivo", () => {
    const result = filesSchema({ ...RECEIPT_FILE_RULES, required: true }).safeParse([]);
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(["Anexe pelo menos um arquivo."]);
  });

  it("arquivos validos passam", () => {
    const files = [makeFile("a.png", "image/png"), makeFile("b.pdf", "application/pdf")];
    const result = filesSchema({ ...RECEIPT_FILE_RULES, required: true }).safeParse(files);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(files);
  });

  it("acima do maximo de arquivos (plural)", () => {
    const files = Array.from({ length: 6 }, (_, i) => makeFile(`f${i}.png`, "image/png"));
    const result = filesSchema(RECEIPT_FILE_RULES).safeParse(files);
    expect(messages(result)).toEqual(["Anexe no máximo 5 arquivos."]);
    expect(filesSchema(ENTRY_ATTACHMENT_RULES).safeParse(files).success).toBe(true);
  });

  it("acima do maximo de arquivos (singular)", () => {
    const files = [makeFile("a.png", "image/png"), makeFile("b.png", "image/png")];
    expect(messages(filesSchema({ maxFiles: 1 }).safeParse(files))).toEqual(["Anexe no máximo 1 arquivo."]);
  });

  it("um arquivo invalido e citado pelo nome, com o motivo em minuscula", () => {
    const files = [makeFile("a.png", "image/png"), makeFile("nota.txt", "text/plain")];
    expect(messages(filesSchema(RECEIPT_FILE_RULES).safeParse(files))).toEqual([
      "Remova “nota.txt”: formato não aceito (use imagem ou PDF).",
    ]);
  });

  it("varios arquivos invalidos viram contagem", () => {
    const files = [makeFile("nota.txt", "text/plain"), makeFile("foto.png", "image/png", 2000)];
    expect(messages(filesSchema({ accept: ["image/*"], maxSizeBytes: 1024 }).safeParse(files))).toEqual([
      "Remova os 2 arquivos marcados em vermelho.",
    ]);
  });

  it("excesso de arquivos e arquivo invalido geram as duas mensagens", () => {
    const files = [makeFile("a.png", "image/png"), makeFile("nota.txt", "text/plain")];
    expect(messages(filesSchema({ ...RECEIPT_FILE_RULES, maxFiles: 1 }).safeParse(files))).toEqual([
      "Anexe no máximo 1 arquivo.",
      "Remova “nota.txt”: formato não aceito (use imagem ou PDF).",
    ]);
  });

  it("valor que nao e File e recusado", () => {
    const result = filesSchema(RECEIPT_FILE_RULES).safeParse([{ name: "a.png", type: "image/png" }]);
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("Arquivo inválido.");
  });
});
