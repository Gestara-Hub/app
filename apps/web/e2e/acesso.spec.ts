import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, loginAs, seedAcademy, student, test } from "./fixtures";

const pathOf = (page: Page) => new URL(page.url()).pathname;

test.describe("guarda de rota", () => {
  test("barbearia não abre telas de turmas", async ({ page }) => {
    await loginAs(page, "Marcelo Andrade");
    for (const route of ["/classes/billing", "/classes", "/classes/calendar"]) {
      await page.goto(route);
      await expect.poll(() => pathOf(page), { message: route }).toBe("/");
    }
  });

  test("academia não abre agenda nem serviços", async ({ page }) => {
    await loginAs(page, "Ana Ribeiro");
    for (const route of ["/schedule", "/services", "/appointments"]) {
      await page.goto(route);
      await expect.poll(() => pathOf(page), { message: route }).toBe("/");
    }
  });

  test("login ignora destino externo em ?from", async ({ page }) => {
    await page.goto("/login?from=//evil.com");
    await page.getByRole("button", { name: /Ana Ribeiro/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    expect(new URL(page.url()).host).toBe("localhost:3000");
    expect(pathOf(page)).toBe("/");
  });

  test("sem sessão vai ao login e volta com a query", async ({ page }) => {
    await page.goto("/classes/calendar?instructor=x");
    await expect.poll(() => pathOf(page)).toBe("/login");
    expect(new URL(page.url()).searchParams.get("from")).toBe("/classes/calendar?instructor=x");
    await page.getByRole("button", { name: /Ana Ribeiro/ }).click();
    await page.waitForURL((url) => url.pathname === "/classes/calendar");
    expect(new URL(page.url()).search).toBe("?instructor=x");
  });
});

test("página inexistente mostra o 404 em português", async ({ page, pageErrors }) => {
  await loginAs(page, "Ana Ribeiro");
  const response = await page.goto("/rota-que-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar para o início" })).toBeVisible();
  // O navegador loga o status 404 do documento; nao e erro do app.
  const rest = pageErrors.filter((e) => !/status of 404/.test(e));
  pageErrors.splice(0, pageErrors.length, ...rest);
});

test("usuário editando a si mesmo não muda perfil nem status", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await page.goto("/users");
  await page.getByRole("button", { name: "Ações de Ana Ribeiro", exact: true }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: /Perfil de acesso/ })).toBeDisabled();
  await expect(dialog.getByText("Você não pode alterar o próprio perfil de acesso.")).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Usuário ativo" })).toBeDisabled();
  await expect(dialog.getByText("Você não pode inativar o próprio usuário.")).toBeVisible();
});

test.describe("menus de linha com o nome do registro", () => {
  test.beforeEach(async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [student("c-a", "Aluno A20")];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      },
    });
  });

  for (const [route, name] of [
    ["/clients", "Ações de Aluno A20"],
    ["/classes", "Ações de Jiu-Jitsu Adulto"],
    ["/classes/cg-1", "Ações de Aluno A20"],
    ["/classes/plans", "Ações de Mensal Jiu-Jitsu"],
    ["/classes/modalities", "Ações de Jiu-Jitsu"],
    ["/team", "Ações de Carlos Silva"],
  ] as const) {
    test(`${route}: "${name}"`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    });
  }

  test("/users: \"Ações de Ana Ribeiro\"", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("button", { name: "Ações de Ana Ribeiro", exact: true })).toBeVisible({ timeout: 5000 });
  });
});
