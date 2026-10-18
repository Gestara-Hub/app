import type { Page } from "@playwright/test";
import { expect, seedAcademy, setSessionCookie, test } from "./fixtures";

type Org = {
  name: string;
  segment: string;
  classSegment?: string;
  customSegmentName?: string;
  customSegmentProgression?: string;
};

/** Organizacao e modalidades da academia gravadas no mundo do mock. */
async function savedAcademy(page: Page) {
  const raw = await page.evaluate(() => localStorage.getItem("gestarahub:db"));
  const world = JSON.parse(raw as string);
  const tenant = world.data.tenants["org-academia-x"];
  return {
    organization: tenant.organization as Org,
    unitName: tenant.unit.name as string,
    categories: tenant.categories as { name: string; progressionTrack?: { templateKey?: string } }[],
  };
}

test("configuração inicial orienta cada passo e aceita uma área fora da lista", async ({ page }) => {
  await setSessionCookie(page, "Ana Ribeiro");
  await page.goto("/setup");

  // Passo 1: dica, previa ao vivo e unidade escondida atras do link.
  await expect(page.getByRole("heading", { name: "Como se chama o seu espaço?" })).toBeVisible();
  await expect(page.getByText("Dá aula sozinho? Pode usar o seu nome.")).toBeVisible();
  await expect(page.getByText("Assim aparece no topo:")).toContainText("Seu espaço");
  await expect(page.getByLabel("Unidade ou filial (opcional)")).toHaveCount(0);

  await page.getByLabel("Nome").fill("Clube do Tabuleiro");
  await expect(page.getByText("Assim aparece no topo:")).toContainText("Clube do Tabuleiro");
  await page.getByRole("button", { name: "Tenho mais de um endereço" }).click();
  await page.getByLabel("Unidade ou filial (opcional)").fill("Centro");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Passo 2: area padrao avanca no clique; a confirmacao (no passo 3) muda conforme a area.
  await expect(page.getByRole("heading", { name: "O que você ensina?" })).toBeVisible();
  const status = page.getByRole("status");
  const back = page.getByRole("button", { name: "Voltar" });

  await page.getByRole("radio", { name: /^Lutas/ }).click();
  await expect(status).toHaveText("Seus alunos avançam por faixas e graus. Dá para trocar depois.");
  await back.click();
  await page.getByRole("radio", { name: /^Música/ }).click();
  await expect(status).toHaveText("Seus alunos avançam por módulos. Dá para trocar depois.");
  await back.click();
  await page.getByRole("radio", { name: /^Pilates e yoga/ }).click();
  await expect(status).toHaveText("Sem etapas de evolução por enquanto. Dá para ligar depois.");
  await back.click();

  // Outra area: nome obrigatorio (chip preenche) e como os alunos avancam.
  await page.getByRole("radio", { name: /^Outra área/ }).click();
  await expect(status).toHaveCount(0);
  const next = page.getByRole("button", { name: "Continuar" });
  await next.click();
  await expect(page.getByRole("alert")).toHaveText("Informe o que você ensina.");
  await expect(page.getByRole("radio", { name: "Não avançam", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Xadrez" }).click();
  await expect(page.getByLabel("O que você ensina?")).toHaveValue("Xadrez");
  await page.getByRole("radio", { name: "Níveis", exact: true }).click();
  await next.click();

  // Passo 3: sem sugestoes na Outra area; a aula digitada entra marcada.
  await expect(page.getByRole("heading", { name: "Quais aulas você oferece?" })).toBeVisible();
  await expect(page.getByText("Aulas de Xadrez")).toBeVisible();
  await expect(page.getByText("0 selecionadas")).toBeVisible();
  await page.getByLabel("Não encontrou sua aula? Adicione abaixo:").fill("Xadrez Iniciante");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("1 selecionada")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForURL("**/dashboard");

  const saved = await savedAcademy(page);
  expect(saved.organization).toMatchObject({
    name: "Clube do Tabuleiro",
    segment: "Xadrez",
    classSegment: "custom",
    customSegmentName: "Xadrez",
    customSegmentProgression: "levels",
  });
  expect(saved.unitName).toBe("Centro");
  const created = saved.categories.find((c) => c.name === "Xadrez Iniciante");
  expect(created?.progressionTrack?.templateKey).toBe("general_levels");
});

test("área da lista cria as modalidades marcadas com a trilha da área", async ({ page }) => {
  await setSessionCookie(page, "Ana Ribeiro");
  await page.goto("/setup");
  await page.getByLabel("Nome").fill("Doce Escola");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("radio", { name: /^Gastronomia/ }).click();
  await expect(page.getByRole("status")).toHaveText("Seus alunos avançam por módulos. Dá para trocar depois.");

  await expect(page.getByText("Aulas de Gastronomia")).toBeVisible();
  await expect(page.getByText("2 selecionadas")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForURL("**/dashboard");

  const saved = await savedAcademy(page);
  expect(saved.organization).toMatchObject({ segment: "Gastronomia", classSegment: "gastronomy" });
  expect(saved.organization.customSegmentProgression).toBeUndefined();
  const names = saved.categories.map((c) => c.name);
  expect(names).toEqual(expect.arrayContaining(["Confeitaria", "Panificação"]));
  for (const c of saved.categories.filter((x) => ["Confeitaria", "Panificação"].includes(x.name))) {
    expect(c.progressionTrack?.templateKey).toBe("modules");
  }
});

test("Configurações: Outra área grava o nome e como os alunos avançam", async ({ page }) => {
  await seedAcademy(page);
  await page.goto("/settings");
  await page.getByRole("combobox", { name: /Área do espaço/ }).click();
  await page.getByRole("menuitem", { name: "Outra área" }).click();
  await page.getByLabel("O que você ensina?").fill("Teatro");
  await page.getByRole("combobox", { name: /Como seus alunos avançam/ }).click();
  await page.getByRole("menuitem", { name: "Faixas" }).click();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  const saved = await savedAcademy(page);
  expect(saved.organization).toMatchObject({
    segment: "Teatro",
    classSegment: "custom",
    customSegmentName: "Teatro",
    customSegmentProgression: "belts",
  });
});
