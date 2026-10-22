import type { Page } from "@playwright/test";
import { classGroup, enrollment, expect, seedAcademy, student, test } from "./fixtures";

/**
 * Evolucao do aluno: modal de Graduacao (jornada, graduar, ponto de partida)
 * e modal de Registros de aula (metas, pontos fortes, registro da turma).
 * Hoje e terca 22/09/2026; a turma padrao (Jiu-Jitsu) e seg/ter/qua 17h.
 */

const TS = "2026-09-01T12:00:00.000Z";
/** Nascido em 10/05/1990: 36 anos hoje (adulto). */
const ADULT = "1990-05-10";

type Tenant = Record<string, unknown>;

/** Progresso salvo do aluno numa modalidade (trilha de Jiu-Jitsu por padrao). */
function progression(over: Record<string, unknown> = {}) {
  return {
    modalityId: "m-jj",
    modalityName: "Jiu-Jitsu",
    levelId: "lvl-white",
    levelName: "Faixa Branca",
    levelColor: "white",
    subLevel: 0,
    maxSubLevels: 4,
    promotedAt: "2026-03-01",
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: TS,
    ...over,
  };
}

function modality(id: string, name: string, position: number, over: Record<string, unknown> = {}) {
  return { id, organizationId: "org-academia-x", name, position, status: "active", createdAt: TS, updatedAt: TS, ...over };
}

/** Academia com um aluno adulto matriculado na turma de Jiu-Jitsu. */
async function seedStudent(page: Page, over: Record<string, unknown> = {}, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno Adulto", { birthDate: ADULT, ...over })];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      extra?.(t);
    },
  });
}

/** Abre um dos modais do aluno pelo menu ⋮ da lista de Alunos. */
async function openFromClients(page: Page, name: string, item: "Graduação" | "Registros de aula") {
  // Sem o destaque "Lista ou cards" (aparece uma vez com 3+ alunos e cobre a tela).
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
  await page.goto("/clients");
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("graduação", () => {
  test("dar o próximo grau registra quem graduou na jornada", async ({ page }) => {
    await seedStudent(page, { progressions: { "m-jj": progression() } });
    const dialog = await openFromClients(page, "Aluno Adulto", "Graduação");
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(dialog).toContainText("Aluno Adulto · Jiu-Jitsu");

    await dialog.getByRole("button", { name: "Graduar", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Registrar graduação" })).toBeVisible();
    // Com graus sobrando, o sugerido e o proximo grau na mesma faixa.
    const degree = dialog.getByRole("button", { name: /Dar o 1º grau/ });
    await expect(degree).toHaveAttribute("aria-pressed", "true");
    await expect(degree).toContainText("Sugerido");
    await dialog.getByLabel("Quem graduou (opcional)").fill("Mestre Carlos");
    await dialog.getByRole("button", { name: "Confirmar graduação" }).click();

    await expect(page.getByText("Registrado: Faixa Branca · 1º grau.")).toBeVisible();
    // Volta para a jornada: faixa atual com a data e quem graduou.
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(dialog.getByText("Desde hoje · Mestre Carlos")).toBeVisible();
    await expect(dialog.getByText("1 de 4 graus.", { exact: false })).toBeAttached();
  });

  test("trocar de faixa: adulto com 4 graus vai direto para a Azul e a jornada esconde as faixas infantis", async ({
    page,
  }) => {
    await seedStudent(page, { progressions: { "m-jj": progression({ subLevel: 4 }) } });
    const dialog = await openFromClients(page, "Aluno Adulto", "Graduação");
    // Jornada de adulto: sem Cinza/Amarela/Laranja/Verde (4 a 15 anos).
    await expect(dialog.getByText("Faixa Azul").first()).toBeVisible();
    await expect(dialog.getByText("Faixa Cinza")).toHaveCount(0);
    await expect(dialog.getByText("Faixa Verde")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Graduar", exact: true }).click();
    await expect(dialog.getByRole("button", { name: /Dar o/ })).toHaveCount(0);
    const change = dialog.getByRole("button", { name: /Trocar de faixa/ });
    await expect(change).toHaveAttribute("aria-pressed", "true");
    await expect(change).toContainText("Faixa Azul");
    await dialog.getByLabel("Quem graduou (opcional)").fill("Banca da federação");
    await dialog.getByRole("button", { name: "Confirmar graduação" }).click();

    await expect(page.getByText("Registrado: Faixa Azul.")).toBeVisible();
    await expect(dialog.getByText("Desde hoje · Banca da federação")).toBeVisible();
    // A faixa anterior fica como conquistada (sem cadeado) e o proximo passo e o 1º grau da Azul.
    await expect(dialog.getByText("Próximo:")).toBeVisible();

    // A lista de Alunos mostra a faixa nova no selo.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("main").getByText("Faixa Azul")).toBeVisible();
  });

  test("escolher outra: só as faixas da idade, com 'Mostrar todas as faixas'", async ({ page }) => {
    await seedStudent(page, { progressions: { "m-jj": progression() } });
    const dialog = await openFromClients(page, "Aluno Adulto", "Graduação");
    await dialog.getByRole("button", { name: "Graduar", exact: true }).click();
    await dialog.getByRole("button", { name: /Escolher outra/ }).click();

    await dialog.locator("#graduate-other-level").click();
    await expect(page.getByRole("option", { name: /Faixa Roxa/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Faixa Cinza/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Mostrar todas as faixas" }).click();
    await expect(dialog.getByRole("button", { name: "Mostrar só para 36 anos" })).toBeVisible();
    await dialog.locator("#graduate-other-level").click();
    const kids = page.getByRole("option", { name: /Faixa Cinza/ });
    await expect(kids).toContainText("fora da idade (4 a 15 anos)");
    await kids.click();
    await expect(dialog.getByText("Fora da faixa etária (4 a 15 anos). O aluno tem 36 anos.")).toBeVisible();
  });

  test("ponto de partida 'Começou aqui': adulto em trilha com idade começa no nível adulto", async ({ page }) => {
    // Trilha propria: a primeira faixa e so infantil; o adulto deve pular para a Branca.
    const track = {
      enabled: true,
      style: "belt",
      templateKey: "custom",
      criteriaType: "attendance",
      targetAttendances: 30,
      levels: [
        { id: "kids-gray", name: "Faixa Cinza", color: "gray", maxSubLevels: 4, minAge: 4, maxAge: 15 },
        { id: "adult-white", name: "Faixa Branca", color: "white", maxSubLevels: 4, minAge: 16 },
        { id: "adult-blue", name: "Faixa Azul", color: "blue", maxSubLevels: 4, minAge: 16 },
      ],
    };
    await seedStudent(page, {}, (t) => {
      t.categories = [modality("m-jj", "Jiu-Jitsu", 0, { progressionTrack: track })];
    });
    const dialog = await openFromClients(page, "Aluno Adulto", "Graduação");
    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await expect(dialog.getByRole("heading", { name: "Ponto de partida" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Começou aqui/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText(/O aluno começa em Faixa Branca, sem graus/)).toBeVisible();

    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Ponto de partida salvo.")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    // Faixa atual = Branca (adulto); a Cinza infantil nao aparece na jornada.
    await expect(dialog.getByText("Faixa Cinza")).toHaveCount(0);
    await expect(dialog.getByText(/não vale mais/)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("main").getByText("Faixa Branca")).toBeVisible();
  });
});

test.describe("registros de aula", () => {
  test("registro com avanço de meta e lembrete para a próxima aula", async ({ page }) => {
    const goal = { id: "g-1", title: "Passagem de guarda", target: 10, progress: 2, createdAt: TS };
    await seedStudent(page, { progressions: { "m-jj": progression({ goals: [goal] }) } });
    const dialog = await openFromClients(page, "Aluno Adulto", "Registros de aula");
    await expect(dialog.getByRole("heading", { name: "Registros de aula" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Passagem de guarda\s*2\/10/ })).toBeVisible();

    // Sem anotacao, lembrete ou avanco de meta, nao ha o que registrar.
    const save = dialog.getByRole("button", { name: "Registrar", exact: true });
    await expect(save).toBeDisabled();
    await dialog.getByRole("button", { name: "+ Metas e próxima aula" }).click();
    await dialog.getByRole("button", { name: "Somar 5 em Passagem de guarda" }).click();
    await expect(dialog.getByText("7/10")).toBeVisible();
    await dialog.getByLabel("Para a próxima aula").fill("Revisar a raspagem de gancho");
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText("Aula registrada.")).toBeVisible();
    await expect(dialog.getByText("Aulas registradas (1)")).toBeVisible();
    await expect(dialog.getByText("Passagem de guarda +5")).toBeVisible();
    await expect(dialog.getByText("Para a próxima aula: Revisar a raspagem de gancho")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Passagem de guarda\s*7\/10/ })).toBeVisible();
    // Autor = usuario logado.
    await expect(dialog.getByText("hoje · Ana Ribeiro")).toBeVisible();
  });

  test("registrar a aula em lote pela chamada (presentes, tons e anotação da turma)", async ({ page }) => {
    const SESSION = "cg-1~2026-09-21~17:00";
    await seedAcademy(page, {
      extra: (t) => {
        t.clients = [
          student("c-a", "Aluno Alfa", { birthDate: ADULT }),
          student("c-b", "Aluno Beta", { birthDate: ADULT }),
          student("c-c", "Aluno Gama", { birthDate: ADULT }),
          student("c-d", "Aluno Faltou", { birthDate: ADULT }),
        ];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.enrollments = ["c-a", "c-b", "c-c", "c-d"].map((id, i) => enrollment(`e-${i}`, "cg-1", id));
        t.attendances = [
          ...["c-a", "c-b", "c-c"].map((id) => ({ id: `at-${id}`, sessionId: SESSION, studentId: id, status: "present", markedAt: TS })),
          { id: "at-c-d", sessionId: SESSION, studentId: "c-d", status: "absent", markedAt: TS },
        ];
      },
    });
    await page.goto(`/classes/sessions/${encodeURIComponent(SESSION)}`);
    // Chamada concluida: a barra de baixo oferece registrar a aula.
    await expect(page.getByText("Chamada concluída.")).toBeVisible();
    await page.getByRole("button", { name: "Registrar a aula" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar a aula" });
    await expect(dialog).toContainText("Jiu-Jitsu Adulto · 21/09 · 3 presentes");
    // So os presentes entram na lista.
    const list = dialog.getByRole("list", { name: "Presentes" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list).not.toContainText("Aluno Faltou");

    const save = dialog.getByRole("button", { name: "Salvar registros" });
    await expect(save).toBeDisabled();
    await expect(dialog.getByText("Marque só quem se destacou.")).toBeVisible();
    await dialog.getByRole("button", { name: "Evolução: Aluno Alfa" }).click();
    await dialog.getByRole("button", { name: "Ajustar: Aluno Beta" }).click();
    await dialog.getByRole("button", { name: "Anotar sobre Aluno Beta" }).click();
    await dialog.getByLabel("Anotação sobre Aluno Beta").fill("Postura na guarda");
    await expect(dialog.getByText("2 alunos com registro")).toBeVisible();
    // Com anotacao da turma, todos os presentes ganham registro.
    await dialog.getByLabel("Anotação da turma").fill("Raspagens da meia-guarda");
    await expect(dialog.getByText("3 alunos com registro")).toBeVisible();
    await save.click();
    await expect(page.getByText("3 registros salvos.")).toBeVisible();
    await expect(dialog).toBeHidden();

    // No registro de cada aluno (menu do aluno na chamada): o tom, a anotacao individual e a da turma.
    await page.getByRole("button", { name: "Ações de Aluno Beta", exact: true }).click();
    await page.getByRole("menuitem", { name: "Registrar aula", exact: true }).click();
    const beta = page.getByRole("dialog", { name: "Registros de aula" });
    await expect(beta.getByText("Aulas registradas (1)")).toBeVisible();
    await expect(beta.getByText("Ajustar · Jiu-Jitsu Adulto")).toBeVisible();
    await expect(beta.getByText("Postura na guarda")).toBeVisible();
    await expect(beta.getByText("Turma: Raspagens da meia-guarda")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Ações de Aluno Gama", exact: true }).click();
    await page.getByRole("menuitem", { name: "Registrar aula", exact: true }).click();
    const gama = page.getByRole("dialog", { name: "Registros de aula" });
    await expect(gama.getByText("Observação · Jiu-Jitsu Adulto")).toBeVisible();
    await expect(gama.getByText("Turma: Raspagens da meia-guarda")).toBeVisible();
  });

  test("sugestões aprendidas vêm só da mesma modalidade", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.categories = [modality("m-jj", "Jiu-Jitsu", 0), modality("m-mt", "Muay Thai", 1)];
        const goal = (id: string, title: string) => ({ id, title, progress: 0, createdAt: TS });
        t.clients = [
          student("c-a", "Aluno Novo", { birthDate: ADULT }),
          student("c-b", "Aluno Jiu", {
            birthDate: ADULT,
            progressions: { "m-jj": progression({ strengths: ["Guarda fechada"], goals: [goal("g-1", "Finalizar no triângulo")] }) },
          }),
          student("c-c", "Aluno Thai", {
            birthDate: ADULT,
            progressions: {
              "m-mt": progression({
                modalityId: "m-mt",
                modalityName: "Muay Thai",
                levelId: "lvl-mt-white",
                levelName: "Kruang Branco",
                maxSubLevels: 0,
                strengths: ["Chute alto"],
                goals: [goal("g-2", "Clinch")],
              }),
            },
          }),
        ];
        t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
        t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
      },
    });
    const dialog = await openFromClients(page, "Aluno Novo", "Registros de aula");
    await expect(dialog).toContainText("Aluno Novo · Jiu-Jitsu");

    await dialog.getByRole("button", { name: "+ Adicionar" }).click();
    await expect(dialog.getByRole("button", { name: "+ Guarda fechada" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+ Chute alto" })).toHaveCount(0);
    // Digitar um termo conhecido (sem acento/caixa) salva a grafia ja usada.
    const input = dialog.getByPlaceholder("Informe um ponto forte");
    await input.fill("GUARDA FECHADA");
    await input.press("Enter");
    await expect(dialog.getByRole("button", { name: "Remover Guarda fechada" })).toBeVisible();

    await dialog.getByRole("button", { name: "+ Nova meta" }).click();
    const goalDialog = page.getByRole("dialog", { name: "Nova meta" });
    await expect(goalDialog.getByRole("button", { name: "+ Finalizar no triângulo" })).toBeVisible();
    await expect(goalDialog.getByRole("button", { name: "+ Clinch" })).toHaveCount(0);
    await goalDialog.getByRole("button", { name: "+ Finalizar no triângulo" }).click();
    await goalDialog.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Meta adicionada.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Finalizar no triângulo" })).toBeVisible();
  });
});
