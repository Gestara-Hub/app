import { classGroup, enrollment, expect, loginAs, seedAcademy, skipWelcome, student, test } from "./fixtures";

test("boas-vindas: título sem emoji", async ({ page }) => {
  await loginAs(page, "Ana Ribeiro");
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Bem-vindo ao GestaraHub" });
  await expect(welcome).toBeVisible();
  const title = await welcome.getByRole("heading").first().innerText();
  expect(title).toBe("Bem-vindo ao GestaraHub");
  expect(title).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("dashboard: mês sem mensalidade avisa que nada foi gerado", async ({ page }) => {
  await seedAcademy(page);
  await skipWelcome(page);
  await page.goto("/");
  await expect(page.getByText("Nenhuma mensalidade gerada no mês")).toBeVisible();
});

test("dashboard: aula de hoje já encerrada conta como concluída", async ({ page }) => {
  // Hoje (terca) as 12:00: a aula das 06:00 ja acabou, a das 17:00 ainda vem.
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Aluno A20")];
      t.classGroups = [
        classGroup("cg-1", "Jiu-Jitsu Manhã", { capacity: 2, meetingSlots: [{ weekday: 2, start: "06:00", end: "07:00" }] }),
        classGroup("cg-2", "Jiu-Jitsu Noite", { meetingSlots: [{ weekday: 2, start: "17:00", end: "18:00" }] }),
      ];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
    },
  });
  await skipWelcome(page);
  await page.goto("/");
  await expect(page.getByText("1 concluída · 1 agendada")).toBeVisible();
  await expect(page.getByText(/1\/2 alunos \(1 vaga\)/)).toBeVisible();
});
