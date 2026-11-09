import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("tela do convite no padrão das telas de entrada (achado 15)", () => {
  const page = read("../../app/(auth)/accept-invite/page.tsx");
  const form = read("../../app/(auth)/accept-invite/accept-invite-form.tsx");

  it("usa a mesma moldura de /login e /reset-password, com a marca", () => {
    expect(page).toContain("PublicAuthShell");
  });

  it("sem maiúscula em cada palavra, jargão ou texto de marketing", () => {
    for (const phrase of ["Nova Senha", "Perfil de Acesso", "Ativar Conta e Acessar", "Bem-vindo(a)", "criptografada", "font-mono"]) {
      expect(`${page}\n${form}`, phrase).not.toContain(phrase);
    }
  });

  it("campos com asterisco vermelho e botão de altura padrão (36 px)", () => {
    // Asterisco colado ao texto (RequiredMark dentro do span do rotulo, doc 08).
    expect(form).toContain('<RequiredMark />');
    expect(form).not.toMatch(/Button[^>]*h-10/);
  });
});
