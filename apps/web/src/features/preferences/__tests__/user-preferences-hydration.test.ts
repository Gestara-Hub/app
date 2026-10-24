import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Achado 75 do teste geral: as preferencias (tema, som) vem do armazenamento
// do navegador. Se o desenho do servidor ja mostra a escolha salva, ele difere
// do primeiro desenho do navegador e a hidratacao quebra. O servidor desenha
// sem escolha; ela aparece depois de montar.

vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: () => {} }) }));
vi.mock("@/components/theme/theme-customizer", () => ({ ThemeCustomizerPanel: () => null }));
vi.mock("../hooks/use-user-preferences", () => ({
  useUserPreferences: () => ({
    preferences: { theme: "dark", audioFeedbackEnabled: true },
    updatePreference: () => {},
    updatePreferences: () => {},
    resetPreferences: async () => {},
  }),
}));

const { UserPreferencesView } = await import("../components/user-preferences-view");

describe("Preferências: desenho do servidor", () => {
  it("não mostra o tema nem o som salvos no navegador", () => {
    const html = renderToString(createElement(UserPreferencesView));
    expect(html).toContain("Escuro");
    // Nenhum botao de tema marcado e o som desligado no desenho do servidor.
    expect(html).not.toContain("border-primary bg-primary/5");
    expect(html).not.toContain('aria-checked="true"');
  });
});
