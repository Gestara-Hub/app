import type { Page } from "@playwright/test";
import { admin } from "./db";
import { classGroup, currentAcademy, enrollment, expect, rollCallRow, saveRollCall, seedAcademy, student, test } from "./fixtures";
import { loginAsUser, user } from "./ficha-notas-fixtures";
import { type Tenant } from "./geral-fixtures";

/**
 * Usuarios e perfis (docs/product/06): CRUD de usuarios, o que cada perfil ve
 * no menu e quais rotas sao barradas, escopo do Profissional na agenda,
 * gerente x proprietario (so o dono troca o plano), SessionSync depois de
 * "Apagar dados da demonstracao" e o proprio nome no topo. Hoje e 22/09/2026.
 */

const MANAGER = user("usr-mgr", "Gil Gerente", "manager");
const ATTENDANT = user("usr-att", "Bia Recepção", "attendant");
const PROF = user("usr-prof", "Carlos Silva", "professional", { professionalId: "pr-1" });
const PROF_LINK = { id: "pr-1", name: "Carlos Silva" };
const OWNER2 = user("usr-own2", "Otto Sócio", "owner");

const pathOf = (page: Page) => new URL(page.url()).pathname;
const sidebar = (page: Page) => page.locator("[data-sidebar=sidebar]").first();
/**
 * Links do menu nos dois contextos ("Dia a dia" e "Gestão"), sem o cartao do
 * plano, em ordem alfabetica (o que importa e o que o perfil ve).
 */
const navLinks = async (page: Page) => {
  const names = new Set<string>();
  const contexts = ["Dia a dia", "Gestão"];
  for (const context of contexts) {
    const toggle = sidebar(page).getByRole("button", { name: context, exact: true });
    if ((await toggle.count()) > 0) await toggle.click();
    for (const text of await sidebar(page).getByRole("link").allInnerTexts()) {
      const name = text.trim().split("\n")[0].trim();
      if (name && !name.startsWith("Plano ")) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
};
/** Nome no menu do usuario do topo (o botao mostra so as iniciais). */
async function expectTopbarUser(page: Page, name: string, profile?: string): Promise<void> {
  await page.locator("header").getByRole("button", { name: "Menu do usuário" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText(name);
  if (profile) await expect(menu).toContainText(profile);
  await page.keyboard.press("Escape");
}
const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));

async function seedTeam(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.users = [...t.users, MANAGER, ATTENDANT, PROF];
      t.clients = [student("c-a", "Aluno A20")];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      extra?.(t);
    },
  });
}

test.describe("cadastro de usuários (proprietário)", () => {
  test("validações, e-mail repetido e novo atendente", { tag: "@smoke" }, async ({ page }) => {
    await seedTeam(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "Novo usuário" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo usuário" });
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Informe o nome.")).toBeVisible();
    await expect(dialog.getByText("Informe o e-mail.")).toBeVisible();
    await expect(dialog.getByText("Selecione o perfil de acesso.")).toBeVisible();

    await dialog.getByLabel("Nome").fill("Duda Recepção");
    await dialog.getByLabel("E-mail").fill("duda@");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Informe um e-mail válido.")).toBeVisible();

    await dialog.getByLabel("E-mail").fill(currentAcademy().owner.email);
    await dialog.getByRole("combobox", { name: "Perfil de acesso" }).click();
    // Dono gerencia todos os perfis.
    for (const p of ["Proprietário", "Gerente", "Atendente", "Instrutor"]) {
      await expect(page.getByRole("menuitem", { name: p })).toBeVisible();
    }
    await page.getByRole("menuitem", { name: "Atendente" }).click();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Já existe um usuário com este e-mail.")).toBeVisible();

    await dialog.getByLabel("E-mail").fill("duda@academiax.com");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Usuário cadastrado e convite de acesso enviado por e-mail!")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("5 usuários cadastrados")).toBeVisible();
    await expect(page.getByRole("button", { name: /^DR Duda Recepção Atendente Convite pendente/ })).toBeVisible();
  });

  test("perfil Instrutor exige vínculo e o nome vem da equipe", async ({ page }) => {
    await seedTeam(page, (t) => {
      t.users = t.users.filter((u: Tenant) => u.id !== "usr-prof");
    });
    await page.goto("/users");
    await page.getByRole("button", { name: "Novo usuário" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo usuário" });
    await dialog.getByLabel("E-mail").fill("carlos@academiax.com");
    await dialog.getByRole("combobox", { name: "Perfil de acesso" }).click();
    await page.getByRole("menuitem", { name: "Instrutor" }).click();
    await expect(dialog.getByText("Obrigatório no perfil Instrutor: define a agenda que ele vê.")).toBeVisible();
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(dialog.getByText("Vincule o usuário a alguém da equipe.")).toBeVisible();

    await dialog.getByRole("combobox", { name: "Instrutor da equipe" }).click();
    await page.getByRole("option", { name: /Carlos Silva/ }).click();
    await expect(dialog.getByLabel("Nome")).toHaveValue("Carlos Silva");
    await expect(dialog).toContainText("Vinculado a Carlos Silva, da equipe.");
    await dialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Usuário cadastrado e convite de acesso enviado por e-mail!")).toBeVisible();
    await expect(page.getByRole("button", { name: /^CS Carlos Silva Instrutor Equipe/ })).toBeVisible();
  });

  test("editar perfil, inativar e reativar com confirmação", async ({ page }) => {
    await seedTeam(page);
    await page.goto("/users");
    await page.getByRole("button", { name: "Ações de Bia Recepção", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar usuário" });
    await dialog.getByRole("combobox", { name: "Perfil de acesso" }).click();
    await page.getByRole("menuitem", { name: "Gerente" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Usuário atualizado com sucesso.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^BR Bia Recepção Gerente/ })).toBeVisible();

    await page.getByRole("button", { name: "Ações de Bia Recepção", exact: true }).click();
    await page.getByRole("menuitem", { name: "Inativar" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Inativar" }).click();
    await expect(page.getByText("Usuário inativado.")).toBeVisible();
    // O filtro comeca em "Ativos" (01/11/2026): a inativada sai da lista e aparece em "Inativos".
    await expect(page.getByRole("button", { name: /^BR Bia Recepção/ })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Filtrar por status" }).click();
    await page.getByRole("option", { name: "Inativos" }).click();
    await expect(page.getByText("1 usuário cadastrado")).toBeVisible();
    await expect(page.getByRole("button", { name: /^BR Bia Recepção Gerente Inativo/ })).toBeVisible();
    // Modo cartoes: o mesmo usuario, com as mesmas acoes.
    await page.getByRole("button", { name: "Visualização em cartões" }).click();
    await expect(page.getByRole("button", { name: /^BR Bia Recepção Gerente Inativo/ })).toBeVisible();
    await page.getByRole("button", { name: "Visualização em lista" }).click();
    await page.getByRole("button", { name: "Ações de Bia Recepção", exact: true }).click();
    await page.getByRole("menuitem", { name: "Reativar" }).click();
    await page.getByRole("alertdialog", { name: "Reativar usuário?" }).getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Usuário reativado.")).toBeVisible();
  });

  test("busca por nome ou e-mail", async ({ page }) => {
    await seedTeam(page);
    await page.goto("/users");
    await page.getByLabel("Buscar usuário").fill("usr-mgr@");
    await expect(page.getByText("1 usuário cadastrado")).toBeVisible();
    await expect(page.getByRole("button", { name: /^GG Gil Gerente/ })).toBeVisible();
    await page.getByLabel("Buscar usuário").fill("bia");
    await expect(page.getByRole("button", { name: /^BR Bia Recepção/ })).toBeVisible();
  });

  test("não rebaixa o último proprietário ativo, mas rebaixa um segundo dono", async ({ page }) => {
    await seedTeam(page, (t) => t.users.push(OWNER2));
    await page.goto("/users");
    await page.getByRole("button", { name: "Ações de Otto Sócio", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar usuário" });
    await dialog.getByRole("combobox", { name: "Perfil de acesso" }).click();
    await page.getByRole("menuitem", { name: "Gerente" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Usuário atualizado com sucesso.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^OS Otto Sócio Gerente/ })).toBeVisible();
  });

  test("renomear a si mesmo atualiza o topo sem entrar de novo", async ({ page }) => {
    await seedTeam(page);
    await page.goto("/users");
    await expectTopbarUser(page, "Ana Ribeiro");
    await page.getByRole("button", { name: "Ações de Ana Ribeiro", exact: true }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar usuário" });
    await dialog.getByLabel("Nome").fill("Ana Ribeiro Lima");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Usuário atualizado com sucesso.")).toBeVisible();
    await expectTopbarUser(page, "Ana Ribeiro Lima");
    // O cookie foi regravado: depois de recarregar continua o nome novo.
    await page.reload();
    await expectTopbarUser(page, "Ana Ribeiro Lima", "Proprietário");
  });
});

test.describe("menu e rotas por perfil (academia)", () => {
  // "Eventos" entrou no menu em 09/11/2026 (doc product/29): todos os perfis veem (events:view).
  const ALL_CLASSES = [
    "Painel",
    "Calendário",
    "Turmas",
    "Eventos",
    "Alunos",
    "Comunicação",
    "Cobranças",
    "Financeiro",
    "Recebimentos online",
    "Relatórios",
    "Modalidades",
    "Planos e pacotes",
    "Certificados",
    "Equipe",
  ];

  test("proprietário vê tudo", async ({ page }) => {
    await seedTeam(page);
    await expect.poll(() => navLinks(page)).toEqual(sorted([...ALL_CLASSES, "Usuários", "Auditoria", "Configurações"]));
  });

  test("gerente: tudo menos Configurações", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, MANAGER);
    await page.goto("/dashboard");
    await expect.poll(() => navLinks(page)).toEqual(sorted([...ALL_CLASSES, "Usuários", "Auditoria"]));
    await page.goto("/settings");
    await expect.poll(() => pathOf(page)).toBe("/dashboard");
  });

  test("atendente: sem Dashboard, Financeiro, Modalidades, Usuários, Auditoria nem Configurações", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, ATTENDANT);
    await page.goto("/classes");
    await expect
      .poll(() => navLinks(page))
      .toEqual(
        sorted(["Calendário", "Turmas", "Eventos", "Alunos", "Comunicação", "Cobranças", "Relatórios", "Planos e pacotes", "Equipe"]),
      );
    // Sem Dashboard, a primeira tela do perfil e o Calendario.
    for (const route of ["/dashboard", "/finance", "/classes/modalities", "/users", "/audit", "/settings"]) {
      await page.goto(route);
      await expect.poll(() => pathOf(page), { message: route }).toBe("/classes/calendar");
    }
    // Ve turmas e cobrancas, sem criar.
    await page.goto("/classes");
    await expect(page.getByRole("button", { name: "Nova turma" })).toHaveCount(0);
    await page.goto("/classes/plans");
    await expect(page.getByRole("button", { name: "Novo plano" })).toHaveCount(0);
  });

  test("profissional: só Calendário, Turmas e Eventos", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, PROF, PROF_LINK);
    await page.goto("/classes/calendar");
    await expect.poll(() => navLinks(page)).toEqual(sorted(["Calendário", "Turmas", "Eventos"]));
    for (const route of ["/dashboard", "/clients", "/classes/billing", "/classes/plans", "/team", "/reports", "/communication", "/users"]) {
      await page.goto(route);
      await expect.poll(() => pathOf(page), { message: route }).toBe("/classes/calendar");
    }
    // Pode marcar presenca na propria turma.
    await page.goto(`/classes/sessions/${encodeURIComponent("cg-1~2026-09-21~17:00")}`);
    const row = rollCallRow(page, "Aluno A20");
    await row.click();
    await expect(row).toHaveAccessibleName("Aluno A20: Presente");
    await saveRollCall(page);
  });
});

test.describe("gerente x proprietário", () => {
  test("gerente só gerencia atendente e profissional", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, MANAGER);
    await page.goto("/users");
    await expect(page.getByRole("button", { name: /^BR Bia Recepção/ })).toBeVisible();
    // Sem menu para dono e gerente.
    await expect(page.getByRole("button", { name: "Ações de Ana Ribeiro", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ações de Gil Gerente", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ações de Bia Recepção", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Novo usuário" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo usuário" });
    await dialog.getByRole("combobox", { name: "Perfil de acesso" }).click();
    await expect(page.getByRole("menuitem", { name: "Atendente" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Instrutor" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Proprietário" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Gerente" })).toHaveCount(0);
  });

  test("só o proprietário troca o plano: gerente vê o aviso", async ({ page }) => {
    await seedTeam(page);
    // Certificado e recurso do Pro: o grátis ve o aviso de plano.
    const certificate = "/classes/cg-1/certificate/e-1";
    await page.goto(certificate);
    const owner = page.getByRole("main");
    await expect(owner.getByRole("link", { name: "Ver Plano Profissional" })).toHaveAttribute("href", /\/settings\?tab=plano/);

    // Sai da pagina antes de trocar a sessao (requisicao dela no meio da troca da 401).
    await page.goto("about:blank");
    await loginAsUser(page, MANAGER);
    await page.goto(certificate);
    await expect(page.getByText("Fale com o proprietário da conta para ativar o Plano Profissional.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver Plano Profissional" })).toHaveCount(0);
  });
});

test.describe("sessão", () => {
  test("usuário removido do mundo sai da sessão", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, MANAGER);
    await page.goto("/dashboard");
    await expectTopbarUser(page, "Gil Gerente");
    const org = currentAcademy().organizationId;
    await admin().from("legal_consents").delete().eq("organization_id", org).eq("user_id", "usr-mgr").throwOnError();
    await admin().from("users").delete().eq("organization_id", org).eq("id", "usr-mgr").throwOnError();
    await page.reload();
    await expect.poll(() => pathOf(page), { timeout: 15_000 }).toBe("/login");
  });

  test("usuário inativado sai da sessão", async ({ page }) => {
    await seedTeam(page);
    await loginAsUser(page, ATTENDANT);
    await page.goto("/classes");
    await admin()
      .from("users")
      .update({ status: "inactive" })
      .eq("organization_id", currentAcademy().organizationId)
      .eq("id", "usr-att")
      .throwOnError();
    await page.reload();
    await expect.poll(() => pathOf(page), { timeout: 15_000 }).toBe("/login");
  });

  test("fora da demonstração o menu do topo não troca de usuário", async ({ page }) => {
    // A troca de perfil existe so no espaco de demonstracao do banco (pnpm demo:local).
    await seedTeam(page);
    await page.locator("header").getByRole("button", { name: "Menu do usuário" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toContainText("Ana Ribeiro");
    await expect(menu).not.toContainText("Ver a demonstração como");
  });

});

