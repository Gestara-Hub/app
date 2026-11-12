import type { Locator, Page } from "@playwright/test";
import {
  classGroup,
  enrollment,
  expect,
  openProfileSection,
  profileSection,
  rollCallRow,
  openRowMenu,
  rowMenuAction,
  seedAcademy,
  student,
  test,
} from "./fixtures";
import {
  ADULT,
  MODULES_TRACK,
  STAGES_TRACK,
  TS,
  jjWhite,
  modality,
  progression,
  skipClientsCoachmark,
  type Tenant,
} from "./ficha-notas-fixtures";

/**
 * Evolucao por area num espaco misto (academia de lutas com Violao em modulos
 * e Natacao em fases): as palavras seguem a trilha de cada modalidade em todos
 * os lugares, ponto de partida, registros de aula (um a um e em lote), metas,
 * sugestoes aprendidas por modalidade e as faixas pela idade.
 * Hoje e terca 22/09/2026; as turmas sao seg/ter/qua 17h.
 */

/** Nascida em 2016-03-01: 10 anos hoje. */
const KID = "2016-03-01";
const MUSIC_SESSION = "cg-vio~2026-09-21~17:00";

const swim = (levelId: string, levelName: string, over: Record<string, unknown> = {}) =>
  progression("m-nat", "Natação", levelId, levelName, over);
const music = (levelId: string, levelName: string, over: Record<string, unknown> = {}) =>
  progression("m-vio", "Violão", levelId, levelName, over);

/**
 * Academia de lutas com tres modalidades e tres trilhas:
 * - Aluna Mista: Jiu-Jitsu, Violao e Natacao;
 * - Aluno Violão e Aluna Violino: so Violao;
 * - Aluno Peixe: so Natacao.
 */
async function seedMixed(page: Page, extra?: (t: Tenant) => void) {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.classSegment = "martial_arts";
      t.categories = [
        modality("m-jj", "Jiu-Jitsu", 0),
        modality("m-vio", "Violão", 1, { progressionTrack: MODULES_TRACK }),
        modality("m-nat", "Natação", 2, { progressionTrack: STAGES_TRACK }),
      ];
      t.professionals[0].modalityIds = ["m-jj", "m-vio", "m-nat"];
      t.clients = [
        student("c-m", "Aluna Mista", {
          birthDate: ADULT,
          progressions: {
            "m-jj": jjWhite(),
            "m-vio": music("lvl-mod-basic", "Módulo Básico"),
            "m-nat": swim("lvl-swim-adapt", "Adaptação"),
          },
        }),
        student("c-v", "Aluno Violão", {
          birthDate: ADULT,
          progressions: { "m-vio": music("lvl-mod-basic", "Módulo Básico", { strengths: ["Leitura de partitura"] }) },
        }),
        student("c-w", "Aluna Violino", { birthDate: ADULT }),
        student("c-p", "Aluno Peixe", { birthDate: ADULT, progressions: { "m-nat": swim("lvl-swim-init", "Iniciação") } }),
      ];
      t.classGroups = [
        classGroup("cg-jj", "Jiu-Jitsu Adulto"),
        classGroup("cg-vio", "Violão Iniciante", { modalityId: "m-vio" }),
        classGroup("cg-nat", "Natação Manhã", { modalityId: "m-nat" }),
      ];
      t.enrollments = [
        enrollment("e-1", "cg-jj", "c-m"),
        enrollment("e-2", "cg-vio", "c-m"),
        enrollment("e-3", "cg-nat", "c-m"),
        enrollment("e-4", "cg-vio", "c-v"),
        enrollment("e-5", "cg-vio", "c-w"),
        enrollment("e-6", "cg-nat", "c-p"),
      ];
      extra?.(t);
    },
  });
}

/** Card de uma modalidade na secao Evolucao da ficha. */
const evolutionCard = (page: Page, name: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function openFromClients(page: Page, name: string, item: string): Promise<Locator> {
  await skipClientsCoachmark(page);
  await page.goto("/clients");
  await rowMenuAction(page, name, item);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("palavras da trilha em espaço misto", () => {
  test("ficha: cada card da Evolução e o diálogo falam a língua da trilha", async ({ page }) => {
    await seedMixed(page);
    await page.goto("/clients/c-m?tab=evolution");
    await expect(evolutionCard(page, "Jiu-Jitsu").getByRole("button", { name: "Graduação" })).toBeVisible();
    await expect(evolutionCard(page, "Violão").getByRole("button", { name: "Módulos" })).toBeVisible();
    await expect(evolutionCard(page, "Natação").getByRole("button", { name: "Fases" })).toBeVisible();
    await expect(evolutionCard(page, "Violão")).toContainText("Avanço em 01/03/2026");
    await expect(evolutionCard(page, "Jiu-Jitsu")).toContainText("Graduação em 01/03/2026");

    await evolutionCard(page, "Violão").getByRole("button", { name: "Módulos" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Módulos" })).toBeVisible();
    await expect(dialog).toContainText("Aluna Mista · Violão");
    await expect(dialog.getByRole("button", { name: "Avançar", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Graduar", exact: true })).toHaveCount(0);

    // Trocar a modalidade no proprio dialogo troca as palavras.
    const picker = dialog.getByRole("tablist", { name: "Modalidade" });
    await picker.getByRole("tab", { name: /Natação/ }).click();
    await expect(dialog.getByRole("heading", { name: "Fases" })).toBeVisible();
    await expect(dialog).toContainText("Aluna Mista · Natação");
    await picker.getByRole("tab", { name: /Jiu-Jitsu/ }).click();
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Graduar", exact: true })).toBeVisible();
  });

  test("Alunos: o item do menu segue a trilha do aluno (Módulos, Fases; misto fica no da área)", async ({ page }) => {
    await seedMixed(page);
    await skipClientsCoachmark(page);
    await page.goto("/clients");
    const items = async (name: string) => {
      // Graduacao e afins ficam no submenu "Acompanhamento" (09/11/2026).
      await openRowMenu(page, name, { followUp: true });
      const texts = await page.getByRole("menuitem").allTextContents();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      return texts;
    };
    // As modalidades chegam do banco depois da lista: espera a palavra da trilha.
    await expect.poll(() => items("Aluno Violão")).toContain("Módulos");
    await expect.poll(() => items("Aluno Peixe")).toContain("Fases");
    await expect.poll(() => items("Aluna Mista")).toContain("Graduação");
  });

  test("módulos: avançar registra o próximo módulo e a ficha atualiza o card", async ({ page }) => {
    await seedMixed(page);
    const dialog = await openFromClients(page, "Aluno Violão", "Módulos");
    await dialog.getByRole("button", { name: "Avançar", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Registrar avanço" })).toBeVisible();
    const next = dialog.getByRole("button", { name: /Avançar de módulo/ });
    await expect(next).toContainText("Módulo Pré-intermediário");
    await expect(next).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: /Dar o/ })).toHaveCount(0);
    await dialog.getByLabel("Quem graduou (opcional)").or(dialog.getByLabel(/Quem avaliou/)).first().fill("Prof. Carlos");
    await dialog.getByRole("button", { name: "Confirmar avanço" }).click();
    await expect(page.getByText("Registrado: Módulo Pré-intermediário.")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Módulos" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Na ficha: o resumo da Evolucao e o card de Violao ja no modulo novo.
    await page.goto("/clients/c-v");
    await expect(profileSection(page, "Evolução")).toContainText("Módulo Pré-intermediário");
    await openProfileSection(page, "Evolução");
    await expect(evolutionCard(page, "Violão")).toContainText("Módulo Pré-intermediário");
  });

  test("fases: ponto de partida 'Veio de outro lugar' com a fase atual", async ({ page }) => {
    await seedMixed(page);
    await page.goto("/clients/c-p?tab=evolution");
    await evolutionCard(page, "Natação").getByRole("button", { name: "Fases" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await expect(dialog.getByRole("heading", { name: "Ponto de partida" })).toBeVisible();
    await dialog.getByRole("button", { name: /Veio de outro lugar/ }).click();
    await expect(dialog.getByText("Fase atual", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Nesta fase desde")).toBeVisible();
    await expect(dialog.getByText("Professor que avaliou")).toBeVisible();
    await dialog.getByLabel("Onde aprendia antes").fill("Clube Aquático");
    await dialog.locator("#start-level").click();
    await page.getByRole("option", { name: /Aperfeiçoamento/ }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Ponto de partida salvo.")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Fases" })).toBeVisible();
    await expect(dialog).toContainText("Veio de Clube Aquático");
    await page.keyboard.press("Escape");
    await expect(evolutionCard(page, "Natação")).toContainText("Aperfeiçoamento");
  });
});

test.describe("registros de aula e metas", () => {
  test("registro único pela ficha: tom, anotação, meta nova com alvo, +1, feita e remover", async ({ page }) => {
    await seedMixed(page);
    await page.goto("/clients/c-v?tab=evolution");
    await evolutionCard(page, "Violão").getByRole("button", { name: "Registros de aula" }).click();
    const dialog = page.getByRole("dialog", { name: "Registros de aula" });
    await expect(dialog).toContainText("Aluno Violão · Violão");

    // Meta nova com quantidade.
    await dialog.getByRole("button", { name: "+ Nova meta" }).click();
    const goal = page.getByRole("dialog", { name: "Nova meta" });
    await goal.getByRole("button", { name: "Adicionar" }).click();
    await expect(goal.getByText("Informe a meta.")).toBeVisible();
    await goal.getByLabel("Meta").fill("Escala de dó maior");
    await goal.getByLabel("Quantidade (opcional)").fill("3");
    await goal.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Meta adicionada.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Escala de dó maior\s*0\/3/ })).toBeVisible();

    // Registro com tom, anotacao e +1 na meta.
    await dialog.getByRole("radiogroup", { name: "Como foi" }).getByRole("radio").first().click();
    await dialog.getByLabel("Anotação da aula").fill("Troca de acordes mais limpa");
    await dialog.getByRole("button", { name: "+ Metas e próxima aula" }).click();
    await dialog.getByRole("button", { name: "Somar 1 em Escala de dó maior" }).click();
    await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText("Aula registrada.")).toBeVisible();
    await expect(dialog.getByText("Aulas registradas (1)")).toBeVisible();
    await expect(dialog.getByText("Troca de acordes mais limpa")).toBeVisible();
    await expect(dialog.getByText("Escala de dó maior +1")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Escala de dó maior\s*1\/3/ })).toBeVisible();

    // Marcar como feita e depois remover.
    await dialog.getByRole("button", { name: /Escala de dó maior\s*1\/3/ }).click();
    await page.getByRole("menuitem", { name: "Marcar como feita" }).click();
    await expect(dialog.getByRole("button", { name: /Escala de dó maior\s*3\/3/ })).toBeVisible();
    await dialog.getByRole("button", { name: /Escala de dó maior/ }).click();
    await page.getByRole("menuitem", { name: "Remover meta" }).click();
    await expect(page.getByText("Meta removida.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Escala de dó maior/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Fechar" }).last().click();
    await expect(dialog).toBeHidden();

    // A ficha mostra o registro no card da modalidade.
    await expect(evolutionCard(page, "Violão")).toContainText("Troca de acordes mais limpa");
  });

  test("registro em lote pela chamada de Violão salva só para quem se destacou", async ({ page }) => {
    await seedMixed(page, (t) => {
      t.attendances = ["c-m", "c-v", "c-w"].map((id) => ({
        id: `at-${id}`,
        sessionId: MUSIC_SESSION,
        studentId: id,
        status: "present",
        markedAt: TS,
      }));
    });
    await page.goto(`/classes/sessions/${encodeURIComponent(MUSIC_SESSION)}`);
    // A chamada de Violao fala em modulos: o nivel em texto e "Módulos" no menu do aluno.
    await expect(rollCallRow(page, "Aluno Violão")).toContainText("Módulo Básico");
    await openRowMenu(page, "Aluno Violão", { followUp: true });
    await expect(page.getByRole("menuitem", { name: "Módulos", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Registrar a aula" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar a aula" });
    await expect(dialog).toContainText("Violão Iniciante · 21/09 · 3 presentes");
    await dialog.getByRole("button", { name: "Evolução: Aluno Violão" }).click();
    await expect(dialog.getByText("1 aluno com registro")).toBeVisible();
    await dialog.getByRole("button", { name: "Salvar registros" }).click();
    await expect(page.getByText("1 registro salvo.")).toBeVisible();

    await page.getByRole("button", { name: "Ações de Aluno Violão", exact: true }).click();
    await page.getByRole("menuitem", { name: "Registrar aula", exact: true }).click();
    const records = page.getByRole("dialog", { name: "Registros de aula" });
    await expect(records.getByText("Aulas registradas (1)")).toBeVisible();
    await expect(records).toContainText("Violão Iniciante");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ações de Aluna Violino", exact: true }).click();
    await page.getByRole("menuitem", { name: "Registrar aula", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Registros de aula" }).getByText("Aulas registradas")).toHaveCount(0);
  });

  test("sugestões aprendidas: Violão sugere só termos de Violão", async ({ page }) => {
    await seedMixed(page, (t) => {
      t.clients.push(
        student("c-j", "Aluno Jiu", {
          birthDate: ADULT,
          progressions: {
            "m-jj": jjWhite({
              strengths: ["Guarda fechada"],
              goals: [{ id: "g-jj", title: "Raspagem de gancho", progress: 0, createdAt: TS }],
            }),
          },
        }),
      );
      t.clients[1].progressions["m-vio"].goals = [{ id: "g-v", title: "Ritmo de bossa", progress: 0, createdAt: TS }];
    });
    const dialog = await openFromClients(page, "Aluna Violino", "Registros de aula");
    await expect(dialog).toContainText("Aluna Violino · Violão");
    await dialog.getByRole("button", { name: "+ Adicionar" }).click();
    await expect(dialog.getByRole("button", { name: "+ Leitura de partitura" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+ Guarda fechada" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "+ Leitura de partitura" }).click();
    await expect(dialog.getByRole("button", { name: "Remover Leitura de partitura" })).toBeVisible();

    await dialog.getByRole("button", { name: "+ Nova meta" }).click();
    const goal = page.getByRole("dialog", { name: "Nova meta" });
    await expect(goal.getByRole("button", { name: "+ Ritmo de bossa" })).toBeVisible();
    await expect(goal.getByRole("button", { name: "+ Raspagem de gancho" })).toHaveCount(0);
  });
});

test.describe("faixas pela idade", () => {
  test("criança de 10 anos com 4 graus: a troca sugerida é a Cinza, não a Azul", async ({ page }) => {
    await seedMixed(page, (t) => {
      t.clients.push(student("c-k", "Aluna Kids", { birthDate: KID, progressions: { "m-jj": jjWhite({ subLevel: 4 }) } }));
      t.enrollments.push(enrollment("e-k", "cg-jj", "c-k"));
    });
    const dialog = await openFromClients(page, "Aluna Kids", "Graduação");
    // Jornada infantil: aparece a Cinza, nao a Azul (16+).
    await expect(dialog.getByText("Faixa Cinza").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Graduar", exact: true }).click();
    const change = dialog.getByRole("button", { name: /Trocar de faixa/ });
    await expect(change).toHaveAttribute("aria-pressed", "true");
    await expect(change).toContainText("Faixa Cinza");
    await expect(change).not.toContainText("Faixa Azul");

    await dialog.getByRole("button", { name: /Escolher outra/ }).click();
    await dialog.locator("#graduate-other-level").click();
    await expect(page.getByRole("option", { name: /Faixa Amarela/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Faixa Azul/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Mostrar todas as faixas" }).click();
    await dialog.locator("#graduate-other-level").click();
    await expect(page.getByRole("option", { name: /Faixa Azul/ })).toContainText("fora da idade");
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: /Trocar de faixa/ }).click();
    await dialog.getByRole("button", { name: "Confirmar graduação" }).click();
    await expect(page.getByText("Registrado: Faixa Cinza.")).toBeVisible();
  });

  test("ponto de partida 'Começou aqui' para criança começa na faixa da idade", async ({ page }) => {
    await seedMixed(page, (t) => {
      t.clients.push(student("c-k", "Aluna Kids", { birthDate: KID }));
      t.enrollments.push(enrollment("e-k", "cg-jj", "c-k"));
    });
    await page.goto("/clients/c-k?tab=evolution");
    await evolutionCard(page, "Jiu-Jitsu").getByRole("button", { name: "Graduação" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await expect(dialog.getByRole("button", { name: /Começou aqui/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText(/O aluno começa em Faixa Branca, sem graus/)).toBeVisible();
    await dialog.getByRole("button", { name: /Treinava aqui antes do sistema/ }).click();
    await dialog.locator("#start-level").click();
    // Para 10 anos: faixas infantis, sem a Azul.
    await expect(page.getByRole("option", { name: /Faixa Cinza/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Faixa Azul/ })).toHaveCount(0);
    await page.getByRole("option", { name: /Faixa Cinza/ }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Ponto de partida salvo.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(evolutionCard(page, "Jiu-Jitsu")).toContainText("Faixa Cinza");
  });
});
