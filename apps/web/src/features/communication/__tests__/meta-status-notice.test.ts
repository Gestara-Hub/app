import { describe, expect, it } from "vitest";
import { metaStatusNotice } from "../message-meta";

// Comunicacao: a situacao do modelo no WhatsApp so aparece quando pede atencao.

describe("situação do modelo no WhatsApp", () => {
  it("aprovado (o normal) e sem situação não mostram nada", () => {
    expect(metaStatusNotice("APPROVED")).toBeNull();
    expect(metaStatusNotice(undefined)).toBeNull();
  });

  it("em análise avisa, sem pedir ação", () => {
    expect(metaStatusNotice("PENDING")).toMatchObject({ text: "Em análise no WhatsApp", tone: "warning", needsEdit: false });
  });

  it("recusado e pausado levam à edição do texto", () => {
    expect(metaStatusNotice("REJECTED")).toMatchObject({ tone: "danger", needsEdit: true });
    expect(metaStatusNotice("PAUSED")).toMatchObject({ tone: "warning", needsEdit: true });
  });

  it("o texto fala em WhatsApp, não em Meta", () => {
    for (const status of ["PENDING", "REJECTED", "PAUSED"] as const) {
      const notice = metaStatusNotice(status);
      expect(`${notice?.text} ${notice?.hint}`).not.toMatch(/Meta/);
    }
  });
});
