import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validationError } from "@gestarahub/core/api-error";

const sonner = vi.hoisted(() => {
  const error = vi.fn();
  const base = Object.assign(vi.fn(), { error, success: vi.fn(), info: vi.fn() });
  return { toast: base, error };
});
vi.mock("sonner", () => ({ toast: sonner.toast }));

const { referenceOf, setErrorReporter, toast } = await import("../toast");

afterEach(() => {
  setErrorReporter(undefined);
  sonner.error.mockClear();
});

const UNEXPECTED = "Não foi possível concluir a operação. Tente novamente. Código do erro: K7Q2M9XD.";

describe("botão Relatar problema nos avisos de erro", () => {
  it("só o erro inesperado (com código) leva o botão", () => {
    const report = vi.fn();
    setErrorReporter(report);
    toast.error(UNEXPECTED);
    const [, options] = sonner.error.mock.calls[0];
    expect(options.action.label).toBe("Relatar problema");
    options.action.onClick();
    expect(report).toHaveBeenCalledWith("K7Q2M9XD");
  });

  it("validação e regra de negócio não levam o botão", () => {
    setErrorReporter(vi.fn());
    toast.error("Turma lotada.");
    toast.error(validationError([{ field: "name", message: "Informe o nome." }]).message);
    toast.error("Você não tem permissão para esta ação.");
    for (const [, options] of sonner.error.mock.calls) expect(options?.action).toBeUndefined();
  });

  it("sem o app ligado, o aviso sai como o do sonner", () => {
    toast.error(UNEXPECTED);
    expect(sonner.error).toHaveBeenCalledWith(UNEXPECTED, undefined);
  });

  it("respeita um botão que a tela já pôs", () => {
    setErrorReporter(vi.fn());
    const action = { label: "Tentar de novo", onClick: vi.fn() };
    toast.error(UNEXPECTED, { action });
    expect(sonner.error.mock.calls[0][1].action).toBe(action);
  });

  it("acha o código só no formato certo", () => {
    expect(referenceOf(UNEXPECTED)).toBe("K7Q2M9XD");
    expect(referenceOf("Código do erro: curto")).toBeUndefined();
    expect(referenceOf(undefined)).toBeUndefined();
  });
});

describe("toast do app", () => {
  it("ninguém importa o toast direto do sonner (perderia o botão)", () => {
    const allowed = new Set(["lib/toast.ts", "components/ui/sonner.tsx"]);
    const root = join(__dirname, "../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !path.includes("__tests__")) {
          const rel = path.slice(root.length + 1);
          if (!allowed.has(rel) && /from "sonner"/.test(readFileSync(path, "utf8"))) offenders.push(rel);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
