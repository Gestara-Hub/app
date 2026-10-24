import { describe, expect, it } from "vitest";
import { toFormData } from "@/components/form/use-action-form";
import { acceptSchema, announcementSchema, courtesySchema, forceFreeSchema, loginSchema, mfaSchema, privacyUpdateSchema } from "../form-schemas";

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("schemas dos formulários (navegador)", () => {
  it("login pede e-mail válido e senha, com mensagem por campo", () => {
    expect(message(loginSchema.safeParse({ email: "", password: "" }))).toBe("Informe seu e-mail.");
    expect(message(loginSchema.safeParse({ email: "abc", password: "x" }))).toBe("Informe um e-mail válido.");
    expect(message(loginSchema.safeParse({ email: "a@b.com", password: "" }))).toBe("Informe sua senha.");
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("código do 2FA aceita espaços e exige 6 números", () => {
    expect(mfaSchema.safeParse({ factorId: "f", code: "123 456" }).success).toBe(true);
    expect(message(mfaSchema.safeParse({ factorId: "f", code: "12345" }))).toBe("Digite os 6 números do aplicativo.");
  });

  it("senha do convite: 12+ caracteres e confirmação igual", () => {
    const base = { token: "x".repeat(12) };
    expect(message(acceptSchema.safeParse({ ...base, password: "curta", confirm: "curta" }))).toBe("A senha precisa ter 12 ou mais caracteres.");
    expect(message(acceptSchema.safeParse({ ...base, password: "Senha-nova-12345", confirm: "outra" }))).toBe("As senhas não conferem.");
    expect(acceptSchema.safeParse({ ...base, password: "Senha-nova-12345", confirm: "Senha-nova-12345" }).success).toBe(true);
  });

  it("cortesia, motivo e voltar ao Grátis", () => {
    expect(message(courtesySchema.safeParse({ spaceId: "s", tier: "pro", days: "400", reason: "Piloto parceiro" }))).toBe("De 1 a 365 dias.");
    expect(message(courtesySchema.safeParse({ spaceId: "s", tier: "pro", days: "30", reason: "abc" }))).toBe("Diga o motivo (pelo menos 5 letras).");
    expect(courtesySchema.safeParse({ spaceId: "s", tier: "pro", days: "30", reason: "Piloto parceiro" }).success).toBe(true);
    expect(message(forceFreeSchema(true).safeParse({ spaceId: "s", partnerCanceled: false, reason: "Abuso comprovado" }))).toBe("Confirme que cancelou a assinatura no parceiro.");
    expect(forceFreeSchema(false).safeParse({ spaceId: "s", partnerCanceled: false, reason: "Abuso comprovado" }).success).toBe(true);
  });

  it("pedido do titular só conclui com o que foi feito", () => {
    expect(message(privacyUpdateSchema.safeParse({ id: "1", status: "done", resolution: "" }))).toBe("Descreva o que foi feito para concluir ou recusar.");
    expect(privacyUpdateSchema.safeParse({ id: "1", status: "in_progress", resolution: "" }).success).toBe(true);
  });

  it("comunicado confere o público escolhido e as datas", () => {
    const base = { title: "Manutenção", body: "Hoje à noite", severity: "info", audience: "all", tiers: [], areas: [], spaces: "", startsAt: "", endsAt: "" };
    expect(announcementSchema.safeParse(base).success).toBe(true);
    expect(message(announcementSchema.safeParse({ ...base, audience: "tier" }))).toBe("Escolha ao menos um plano.");
    expect(message(announcementSchema.safeParse({ ...base, audience: "spaces", spaces: "nao-e-codigo" }))).toBe("Informe os espaços pelo código (um por linha).");
    expect(message(announcementSchema.safeParse({ ...base, startsAt: "2030-01-02T10:00", endsAt: "2030-01-01T10:00" }))).toBe("O fim precisa ser depois do início.");
  });

  it("monta o FormData como a server action espera", () => {
    const data = toFormData({ a: "x", list: ["1", "2"], on: true, off: false, none: undefined, n: 5 });
    expect(data.get("a")).toBe("x");
    expect(data.getAll("list")).toEqual(["1", "2"]);
    expect(data.get("on")).toBe("1");
    expect(data.has("off")).toBe(false);
    expect(data.has("none")).toBe(false);
    expect(data.get("n")).toBe("5");
  });
});
