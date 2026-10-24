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
  const address = page.getByRole("button", { name: /Endereço/ });
  if ((await address.getAttribute("aria-expanded")) !== "true") await address.click();

  const zone = page.getByRole("combobox", { name: "Fuso horário" });
  await expect(zone).toContainText("Brasília (UTC−3)");
  await expect(page.getByText("Define o dia e a hora de cobranças e aulas.")).toBeVisible();
  await zone.click();
  await page.getByRole("menuitem", { name: /Amazonas, Mato Grosso, MS, Rondônia e Roraima/ }).click({ force: true });
  await page.getByRole("button", { name: "Salvar configurações" }).click();

  await expect.poll(async () => (await settingsInDb()).timeZone).toBe("America/Manaus");
  await page.reload();
  const reopened = page.getByRole("button", { name: /Endereço/ });
  if ((await reopened.getAttribute("aria-expanded")) !== "true") await reopened.click();
  await expect(page.getByRole("combobox", { name: "Fuso horário" })).toContainText("Amazonas, Mato Grosso");
});
