import { admin } from "./db";
import { currentAcademy, expect, seedAcademy, test } from "./fixtures";

/**
 * Fuso do espaco (doc technical/22): Configuracoes -> Endereco. O fuso escolhido
 * vale para o "hoje" de cobrancas e aulas; sem escolha, vale o do estado da unidade.
 */

async function settingsInDb(): Promise<Record<string, unknown>> {
  const { data } = await admin()
    .from("organizations")
    .select("settings")
    .eq("id", currentAcademy().organizationId)
    .single();
  return (data?.settings ?? {}) as Record<string, unknown>;
}

test("troca o fuso do espaço em Configurações → Endereço e grava", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings");
  // O bloco Endereco fica aberto (sem sanfona desde 31/10/2026).

  const zone = page.getByRole("combobox", { name: "Fuso horário" });
  await expect(zone).toContainText("Brasília (UTC−3)");
  // Opcoes curtas e os estados na dica (25/11/2026).
  await expect(page.getByText("Vale para a maior parte do Brasil. Define o dia e a hora de cobranças e aulas.")).toBeVisible();
  await zone.click();
  await page.getByRole("menuitem", { name: "Manaus (UTC−4)" }).click({ force: true });
  await page.locator("#settings-panel-geral").getByRole("button", { name: "Salvar", exact: true }).click();

  await expect.poll(async () => (await settingsInDb()).timeZone).toBe("America/Manaus");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Fuso horário" })).toContainText("Manaus (UTC−4)");
  await expect(page.getByText("Vale para AM, MT, MS, RO e RR.", { exact: false })).toBeVisible();
});
