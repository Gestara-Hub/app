import { describe, expect, it } from "vitest";
import { userFormSchema } from "../user-schema";

const base = { name: "Bruno Lima", email: "bruno@exemplo.com", active: true };

function fieldErrors(values: unknown) {
  const result = userFormSchema.safeParse(values);
  if (result.success) return {};
  return result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

describe("userFormSchema", () => {
  it("perfil professional sem professionalId da erro no campo professionalId", () => {
    for (const professionalId of [undefined, ""]) {
      const result = userFormSchema.safeParse({ ...base, profile: "professional", professionalId });
      expect(result.success).toBe(false);
      expect(fieldErrors({ ...base, profile: "professional", professionalId }).professionalId).toEqual([
        "Vincule o usuário a um profissional da equipe.",
      ]);
    }
  });

  it("perfil professional com professionalId passa", () => {
    const result = userFormSchema.safeParse({ ...base, profile: "professional", professionalId: "prof-1" });
    expect(result.success).toBe(true);
  });

  it("outros perfis nao exigem professionalId", () => {
    for (const profile of ["owner", "manager", "attendant"]) {
      expect(userFormSchema.safeParse({ ...base, profile }).success).toBe(true);
    }
  });

  it("perfil vazio ou desconhecido da erro em profile", () => {
    expect(fieldErrors({ ...base, profile: "" }).profile?.[0]).toBe("Selecione o perfil de acesso.");
    expect(fieldErrors({ ...base, profile: "admin" }).profile?.[0]).toBe("Selecione o perfil de acesso.");
  });

  it("valida nome e e-mail", () => {
    const errors = fieldErrors({ ...base, name: "  ", email: "sem-arroba", profile: "owner" });
    expect(errors.name).toEqual(["Informe o nome."]);
    expect(errors.email).toEqual(["Informe um e-mail válido."]);
  });
});
