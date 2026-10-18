import type { Locator, Page } from "@playwright/test";
import { classGroup, enrollment, expect, rollCallRow, seedAcademy, student, test } from "./fixtures";

/**
 * As palavras da evolucao seguem a trilha de cada modalidade, nao a area do
 * espaco: Pilates (niveis) numa academia de lutas fala em "Nível"/"Avançar";
 * Muay Thai (faixas) num estudio de pilates fala em "Faixa"/"Graduar".
 * Hoje e terca 22/09/2026; as turmas sao seg/ter/qua 17h.
 */

const TS = "2026-09-01T12:00:00.000Z";
/** Nascido em 10/05/1990: 36 anos hoje (adulto). */
const ADULT = "1990-05-10";
const PILATES_SESSION = "cg-pil~2026-09-21~17:00";

/** Trilha de niveis gerais (Iniciante, Intermediario, Avancado). */
const LEVELS_TRACK = {
  enabled: true,
  style: "levels",
  templateKey: "general_levels",
  criteriaType: "attendance",
  targetAttendances: 24,
  targetMonths: 6,
  levels: [
    { id: "lvl-gen-beg", name: "Iniciante", maxSubLevels: 0 },
    { id: "lvl-gen-int", name: "Intermediário", maxSubLevels: 0 },
    { id: "lvl-gen-adv", name: "Avançado", maxSubLevels: 0 },
  ],
};

function modality(id: string, name: string, position: number, over: Record<string, unknown> = {}) {
  return { id, organizationId: "org-academia-x", name, position, status: "active", createdAt: TS, updatedAt: TS, ...over };
}

function progression(modalityId: string, modalityName: string, levelId: string, levelName: string, over: Record<string, unknown> = {}) {
  return {
    modalityId,
    modalityName,
    levelId,
    levelName,
    subLevel: 0,
    maxSubLevels: 0,
    promotedAt: "2026-03-01",
    strengths: [],
    goals: [],
    evaluations: [],
    promotionHistory: [],
    updatedAt: TS,
    ...over,
  };
}

/** Abre o modal de evolucao do aluno pelo menu ⋮ da lista de Alunos. */
async function openFromClients(page: Page, name: string, item: string): Promise<Locator> {
  // Sem o destaque "Lista ou cards" (aparece uma vez com 3+ alunos e cobre a tela).
  await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
  await page.goto("/clients");
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Academia de lutas com Jiu-Jitsu (faixas) e Pilates (niveis), um aluno em cada turma. */
async function seedMixedAcademy(page: Page) {
  await seedAcademy(page, {
    extra: (t) => {
      t.organization.classSegment = "martial_arts";
      t.categories = [
        modality("m-jj", "Jiu-Jitsu", 0),
        modality("m-pil", "Pilates", 1, { progressionTrack: LEVELS_TRACK }),
      ];
      t.professionals[0].modalityIds = ["m-jj", "m-pil"];
      t.clients = [
        student("c-j", "Aluna Jiu", {
          birthDate: ADULT,
          progressions: {
            "m-jj": progression("m-jj", "Jiu-Jitsu", "lvl-white", "Faixa Branca", { levelColor: "white", maxSubLevels: 4 }),
          },
        }),
        student("c-p", "Aluna Pilates", {
          birthDate: ADULT,
          progressions: { "m-pil": progression("m-pil", "Pilates", "lvl-gen-beg", "Iniciante") },
        }),
      ];
      t.classGroups = [
        classGroup("cg-jj", "Jiu-Jitsu Adulto"),
        classGroup("cg-pil", "Pilates Manhã", { modalityId: "m-pil" }),
      ];
      t.enrollments = [enrollment("e-1", "cg-jj", "c-j"), enrollment("e-2", "cg-pil", "c-p")];
      t.attendances = [{ id: "at-p", sessionId: PILATES_SESSION, studentId: "c-p", status: "present", markedAt: TS }];
    },
  });
}

test.describe("vocabulário pela modalidade", () => {
  test("academia de lutas: Pilates fala em nível e avançar", async ({ page }) => {
    await seedMixedAcademy(page);
    const dialog = await openFromClients(page, "Aluna Pilates", "Níveis");
    await expect(dialog.getByRole("heading", { name: "Níveis" })).toBeVisible();
    await expect(dialog).toContainText("Aluna Pilates · Pilates");
    await expect(dialog.getByRole("button", { name: "Avançar", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Graduar", exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await dialog.getByRole("button", { name: /Treinava aqui antes do sistema/ }).click();
    await expect(dialog.getByText("Nível atual", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Faixa atual", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await dialog.getByRole("button", { name: "Avançar", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Registrar avanço" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Avançar de nível/ })).toContainText("Intermediário");
    await expect(dialog.getByRole("button", { name: "Confirmar avanço" })).toBeVisible();
  });

  test("academia de lutas: Jiu-Jitsu segue em faixa e graduar", async ({ page }) => {
    await seedMixedAcademy(page);
    const dialog = await openFromClients(page, "Aluna Jiu", "Graduação");
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Graduar", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Avançar", exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await dialog.getByRole("button", { name: /Treinava aqui antes do sistema/ }).click();
    await expect(dialog.getByText("Faixa atual", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Nível atual", { exact: true })).toHaveCount(0);
  });

  test("chamada da turma de Pilates fala em nível", async ({ page }) => {
    await seedMixedAcademy(page);
    await page.goto(`/classes/sessions/${encodeURIComponent(PILATES_SESSION)}`);
    // Nivel em texto na linha do aluno (so faixa usa o selo colorido).
    await expect(rollCallRow(page, "Aluna Pilates")).toContainText("Iniciante");
    await page.getByRole("button", { name: "Ações de Aluna Pilates", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Graduação" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Níveis", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Níveis" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Avançar", exact: true })).toBeVisible();
  });

  test("estúdio de pilates: Muay Thai fala em faixa e graduar", async ({ page }) => {
    await seedAcademy(page, {
      extra: (t) => {
        t.organization.classSegment = "pilates_yoga";
        t.categories = [
          modality("m-mt", "Muay Thai", 0),
          modality("m-pil", "Pilates", 1, { progressionTrack: LEVELS_TRACK }),
        ];
        t.professionals[0].modalityIds = ["m-mt", "m-pil"];
        t.clients = [
          student("c-m", "Aluno Thai", {
            birthDate: ADULT,
            progressions: {
              "m-mt": progression("m-mt", "Muay Thai", "lvl-mt-white", "Kruang Branco", { levelColor: "white" }),
            },
          }),
        ];
        t.classGroups = [classGroup("cg-mt", "Muay Thai Noite", { modalityId: "m-mt" })];
        t.enrollments = [enrollment("e-1", "cg-mt", "c-m")];
      },
    });
    const dialog = await openFromClients(page, "Aluno Thai", "Graduação");
    await expect(dialog.getByRole("heading", { name: "Graduação" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Graduar", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Avançar", exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Ajustar ponto de partida" }).click();
    await dialog.getByRole("button", { name: /Treinava aqui antes do sistema/ }).click();
    await expect(dialog.getByText("Faixa atual", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Nível atual", { exact: true })).toHaveCount(0);
  });
});
