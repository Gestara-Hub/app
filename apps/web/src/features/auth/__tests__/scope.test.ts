import { describe, expect, it } from "vitest";
import {
  UNLINKED_PROFESSIONAL_ID,
  isUnlinkedProfessional,
  scopedProfessionalId,
} from "../scope";

describe("scopedProfessionalId", () => {
  it("profissional sem vinculo retorna o sentinela (fail-closed), nao undefined", () => {
    expect(scopedProfessionalId({ profile: "professional" })).toBe(UNLINKED_PROFESSIONAL_ID);
    expect(scopedProfessionalId({ profile: "professional", professionalId: "" })).toBe(
      UNLINKED_PROFESSIONAL_ID,
    );
  });

  it("profissional com vinculo retorna o id", () => {
    expect(scopedProfessionalId({ profile: "professional", professionalId: "prof-1" })).toBe("prof-1");
  });

  it("demais perfis nao escopam", () => {
    for (const profile of ["owner", "manager", "attendant"] as const) {
      expect(scopedProfessionalId({ profile })).toBeUndefined();
      expect(scopedProfessionalId({ profile, professionalId: "prof-1" })).toBeUndefined();
    }
  });
});

describe("isUnlinkedProfessional", () => {
  it("so e verdadeiro para profissional sem vinculo", () => {
    expect(isUnlinkedProfessional({ profile: "professional" })).toBe(true);
    expect(isUnlinkedProfessional({ profile: "professional", professionalId: "" })).toBe(true);
    expect(isUnlinkedProfessional({ profile: "professional", professionalId: "prof-1" })).toBe(false);
    expect(isUnlinkedProfessional({ profile: "attendant" })).toBe(false);
    expect(isUnlinkedProfessional({ profile: "owner" })).toBe(false);
  });
});
