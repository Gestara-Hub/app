import { describe, expect, it } from "vitest";
import { actionsMatching, auditRange, parseAuditFilters, validDay } from "../audit-filters";
import { escapeLike, likePattern, normalizeSearch, pickOne } from "../list-filters";
import { filterTeam, parseTeamFilters } from "../team-filters";

describe("filtros do endereço", () => {
  it("normaliza a busca: apara, limita a 100 e descarta vazio", () => {
    expect(normalizeSearch("  oi  ")).toBe("oi");
    expect(normalizeSearch("   ")).toBeUndefined();
    expect(normalizeSearch(undefined)).toBeUndefined();
    expect(normalizeSearch("a".repeat(150))).toHaveLength(100);
  });
  it("só aceita valores da lista", () => {
    expect(pickOne("pro", ["free", "pro"] as const)).toBe("pro");
    expect(pickOne("x", ["free", "pro"] as const)).toBeUndefined();
    expect(pickOne(undefined, ["free"] as const)).toBeUndefined();
  });
  it("escapa curingas do LIKE", () => {
    expect(escapeLike("50%_a\\")).toBe("50\\%\\_a\\\\");
    expect(likePattern(" a% ")).toBe("%a\\%%");
    expect(likePattern("")).toBeNull();
  });
});

describe("filtros da auditoria", () => {
  it("acha ações pelo rótulo em português, sem acento nem caixa", () => {
    expect(actionsMatching("convidou")).toEqual(expect.arrayContaining(["admin.invited"]));
    expect(actionsMatching("CONVIDOU")).toContain("admin.invited");
    expect(actionsMatching("renovacao")).toContain("plan.grace_extend");
    expect(actionsMatching("support.reply")).toEqual(["support.reply"]);
    expect(actionsMatching("zzzz")).toEqual([]);
    expect(actionsMatching("  ")).toEqual([]);
  });
  it("valida datas", () => {
    expect(validDay("2026-10-24")).toBe("2026-10-24");
    expect(validDay("2026-02-31")).toBeUndefined();
    expect(validDay("24/10/2026")).toBeUndefined();
    expect(validDay(undefined)).toBeUndefined();
  });
  it("calcula o período em dias de Brasília", () => {
    const now = new Date("2026-10-25T02:00:00Z"); // ainda 24/10 em Brasília
    expect(auditRange({ period: "today" }, now)).toEqual({ from: "2026-10-24", to: "2026-10-24" });
    expect(auditRange({ period: "7" }, now)).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(auditRange({ period: "30" }, now)).toEqual({ from: "2026-09-25", to: "2026-10-24" });
    expect(auditRange({ period: "90" }, now)).toEqual({});
  });
  it("datas escolhidas valem mais que a lista, ignoram inválidas e trocam se invertidas", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(auditRange({ period: "7", from: "2026-10-01", to: "2026-10-05" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-05" });
    expect(auditRange({ from: "2026-10-05", to: "2026-10-01" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-05" });
    expect(auditRange({ from: "lixo", to: "2026-10-05" }, now)).toEqual({ from: undefined, to: "2026-10-05" });
    expect(auditRange({ period: "today", from: "lixo" }, now)).toEqual({ from: "2026-10-25", to: "2026-10-25" });
  });
  it("lê o endereço inteiro com validação", () => {
    const { filters } = parseAuditFilters({ group: "xx", q: " oi ", admin: "nao-uuid", space: "a b", period: "7" }, 2);
    expect(filters).toMatchObject({ group: "all", q: "oi", admin: undefined, space: undefined, period: "7", page: 2 });
    const ok = parseAuditFilters({ group: "plan", admin: "123e4567-e89b-12d3-a456-426614174000", space: "abc-123" }, 1).filters;
    expect(ok).toMatchObject({ group: "plan", admin: "123e4567-e89b-12d3-a456-426614174000", space: "abc-123" });
  });
});

describe("filtros da equipe", () => {
  const rows = [
    { name: "Ana Souza", email: "ana@x.com", role: "platform_owner", status: "active" },
    { name: "Bruno Lima", email: "bruno@x.com", role: "platform_support", status: "invited" },
    { name: "Célia", email: "celia@x.com", role: "platform_support", status: "disabled" },
  ];
  it("valida e filtra", () => {
    expect(parseTeamFilters({ role: "x", status: "y" })).toEqual({ q: undefined, role: undefined, status: undefined });
    expect(filterTeam(rows, parseTeamFilters({ q: "celia" })).map((r) => r.name)).toEqual(["Célia"]);
    expect(filterTeam(rows, parseTeamFilters({ role: "platform_support" }))).toHaveLength(2);
    expect(filterTeam(rows, parseTeamFilters({ role: "platform_support", status: "invited" })).map((r) => r.name)).toEqual(["Bruno Lima"]);
    expect(filterTeam(rows, parseTeamFilters({}))).toHaveLength(3);
  });
});
