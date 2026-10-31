import { describe, expect, it } from "vitest";
import { accountMenuTipReason } from "../account-menu-tip";

// Dica do menu da conta (31/10/2026): uma vez, no primeiro momento que chegar.

const base = {
  state: { firstSeenAt: "2026-09-22" },
  today: "2026-09-22",
  requested: null,
  supportUnread: 0,
  onDashboard: true,
  interruptedThisSession: false,
};

describe("accountMenuTipReason", () => {
  it("primeiro dia, sem resposta do suporte: nada", () => {
    expect(accountMenuTipReason(base)).toBeNull();
  });

  it("segundo dia de uso, só no Painel", () => {
    const secondDay = { ...base, state: { firstSeenAt: "2026-09-21" } };
    expect(accountMenuTipReason(secondDay)).toBe("second_day");
    expect(accountMenuTipReason({ ...secondDay, onDashboard: false })).toBeNull();
  });

  it("resposta do suporte não lida, em qualquer tela", () => {
    expect(accountMenuTipReason({ ...base, onDashboard: false, supportUnread: 1 })).toBe("support");
  });

  it("depois do \"Agora não\" do aviso de segurança, mesmo no acesso já interrompido", () => {
    expect(accountMenuTipReason({ ...base, requested: "security", interruptedThisSession: true })).toBe("security");
  });

  it("acesso já interrompido: suporte e segundo dia esperam o próximo", () => {
    const busy = { ...base, state: { firstSeenAt: "2026-09-01" }, supportUnread: 2, interruptedThisSession: true };
    expect(accountMenuTipReason(busy)).toBeNull();
  });

  it("já mostrada: nunca mais", () => {
    const seen = { ...base, state: { firstSeenAt: "2026-09-01", shownAt: "2026-09-10" } };
    expect(accountMenuTipReason({ ...seen, requested: "security", supportUnread: 1 })).toBeNull();
  });
});
