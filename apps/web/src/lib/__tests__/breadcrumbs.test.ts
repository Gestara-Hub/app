import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePath, noteActionResult, pushCrumb, resetCrumbs, sanitizeCrumbs, setCrumbSender, snapshotCrumbs } from "../breadcrumbs";

/** Rastro de passos (doc technical/21): o que guarda, o que nunca guarda e o que o servidor aceita. */

beforeEach(() => {
  vi.stubGlobal("window", {});
  resetCrumbs();
});

afterEach(() => {
  setCrumbSender(undefined);
  vi.unstubAllGlobals();
});

describe("caminho da tela", () => {
  it("troca ids por :id e tira a query", () => {
    expect(normalizePath("/classes/6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f?tab=alunos#x")).toBe("/classes/:id");
    expect(normalizePath("/clients/123456/ficha")).toBe("/clients/:id/ficha");
    expect(normalizePath("/settings?tab=horarios")).toBe("/settings");
    expect(normalizePath("/dashboard")).toBe("/dashboard");
  });
});

describe("guardar e ler os passos", () => {
  it("do mais antigo para o mais novo, com os segundos antes de agora", () => {
    pushCrumb("nav", "/dashboard", 1_000_000);
    pushCrumb("action", "turmas.markAttendance", 1_010_000);
    expect(snapshotCrumbs(20, 1_030_000)).toEqual([
      { s: 30, k: "nav", v: "/dashboard" },
      { s: 20, k: "action", v: "turmas.markAttendance" },
    ]);
  });

  it("a mesma tela em seguida conta uma vez; ação repetida conta cada vez", () => {
    pushCrumb("nav", "/clients", 1);
    pushCrumb("nav", "/clients", 2);
    pushCrumb("action", "a", 3);
    pushCrumb("action", "a", 4);
    expect(snapshotCrumbs(20, 5).map((c) => c.k)).toEqual(["nav", "action", "action"]);
  });

  it("guarda só os 30 últimos e envia no máximo 20", () => {
    for (let i = 0; i < 40; i += 1) pushCrumb("action", `a${i}`, i);
    const all = snapshotCrumbs(100, 100);
    expect(all).toHaveLength(30);
    expect(all[0].v).toBe("a10");
    expect(snapshotCrumbs(undefined, 100)).toHaveLength(20);
  });

  it("fora do navegador não guarda nada", () => {
    vi.unstubAllGlobals();
    pushCrumb("nav", "/x");
    vi.stubGlobal("window", {});
    expect(snapshotCrumbs()).toEqual([]);
  });
});

describe("o que o servidor aceita", () => {
  it("só tipos conhecidos, tempo e texto limitados, texto mascarado", () => {
    const out = sanitizeCrumbs([
      { s: 5, k: "nav", v: "/classes/:id" },
      { s: -4, k: "action", v: "cpf 529.982.247-25 ana@teste.com" },
      { s: 99999, k: "action_error", v: "x".repeat(500) },
      { s: 1, k: "clique", v: "tipo desconhecido" },
      { s: "1", k: "nav", v: "tempo de texto" },
      { s: 1, k: "nav", v: "   " },
      null,
      "texto",
    ]);
    expect(out.map((c) => c.k)).toEqual(["nav", "action", "action_error"]);
    expect(out[1]).toEqual({ s: 0, k: "action", v: "cpf [cpf] a***@[email]" });
    expect(out[2].s).toBe(3600);
    expect(out[2].v.length).toBeLessThanOrEqual(123);
  });

  it("não-lista vira lista vazia e mais de 20 ficam os 20 últimos", () => {
    expect(sanitizeCrumbs("x")).toEqual([]);
    expect(sanitizeCrumbs(undefined)).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ s: i, k: "nav", v: `/p${i}` }));
    const out = sanitizeCrumbs(many);
    expect(out).toHaveLength(20);
    expect(out[0].v).toBe("/p10");
  });
});

describe("resultado de uma ação do servidor", () => {
  it("sucesso anota a ação e não envia nada", () => {
    const send = vi.fn();
    setCrumbSender(send);
    noteActionResult({ ok: true, event: "turmas.save" });
    expect(snapshotCrumbs().map((c) => `${c.k}:${c.v}`)).toEqual(["action:turmas.save"]);
    expect(send).not.toHaveBeenCalled();
  });

  it("erro com código anota o erro e manda os passos desse código", () => {
    const send = vi.fn();
    setCrumbSender(send);
    noteActionResult({ ok: false, event: "support.send" }, "K7Q2M9XD");
    expect(snapshotCrumbs().map((c) => `${c.k}:${c.v}`)).toEqual(["action_error:support.send (K7Q2M9XD)"]);
    expect(send).toHaveBeenCalledWith("K7Q2M9XD");
  });

  it("erro de regra (sem código) anota o erro mas não envia", () => {
    const send = vi.fn();
    setCrumbSender(send);
    noteActionResult({ ok: false, event: "turmas.save" });
    expect(snapshotCrumbs().map((c) => c.k)).toEqual(["action_error"]);
    expect(send).not.toHaveBeenCalled();
  });

  it("resultado sem o nome da ação é ignorado", () => {
    noteActionResult({ ok: true });
    expect(snapshotCrumbs()).toEqual([]);
  });
});
