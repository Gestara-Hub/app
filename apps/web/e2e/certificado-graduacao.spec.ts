import { readTenant, waitForStore } from "./areas-helpers";
import { classGroup, editWorld, enrollment, expect, seedAcademy, student, test } from "./fixtures";

/**
 * Certificado de graduacao (doc 21 §1.6): nasce do registro de graduacao do
 * aluno; abrir emite (codigo e QR), a pagina publica confirma a graduacao, o
 * editor tem o modelo de graduacao com galeria e variaveis proprias, cancelar
 * invalida. Hoje: 22/09/2026.
 */

const CODE_RE = /GH-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/;
const TS = "2026-09-01T12:00:00.000Z";

async function seedGraduated(page: Parameters<typeof seedAcademy>[0]) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [
        student("c-a", "Aluno Adulto", {
          birthDate: "1990-05-10",
          progressions: {
            "m-jj": {
              modalityId: "m-jj",
              modalityName: "Jiu-Jitsu",
              levelId: "lvl-blue",
              levelName: "Faixa Azul",
              levelColor: "blue",
              subLevel: 0,
              maxSubLevels: 4,
              promotedAt: "2026-09-12",
              strengths: [],
              goals: [],
              evaluations: [],
              promotionHistory: [
                { id: "ph-1", date: "2026-09-12", fromLevelName: "Faixa Branca", fromSubLevel: 4, toLevelName: "Faixa Azul", toLevelColor: "blue", toSubLevel: 0, isExam: true, examiner: "Mestre Léo", createdAt: TS },
              ],
              updatedAt: TS,
            },
          },
        }),
      ];
      t.classGroups = [classGroup("cg-1", "Jiu-Jitsu Adulto")];
      t.enrollments = [enrollment("e-1", "cg-1", "c-a")];
    },
  });
  await editWorld(page, "org-academia-x", (t) => {
    t.organization.subscription = { tier: "pro", interval: "monthly", status: "active", paymentMethod: "pix", priceCents: 7990, asaasSubscriptionId: "sub_mock_e2e", renewsOn: "2026-10-12", nextDueDate: "2026-10-12", changedAt: "2026-09-12T12:00:00.000Z" };
  });
}

test("abrir pela evolução emite; a página pública confirma a graduação; cancelar invalida", async ({ page, context }) => {
  await seedGraduated(page);
  // O atalho fica no dialogo de graduacao do aluno, ao lado da etapa alcancada.
  await page.goto("/clients/c-a?tab=evolution");
  await page.getByRole("button", { name: "Graduação" }).click();
  const dialog = page.getByRole("dialog");
  const link = dialog.getByRole("link", { name: "Certificado" });
  await expect(link).toHaveAttribute("href", "/clients/c-a/graduation-certificate/ph-1");
  await link.click();
  await expect(page).toHaveURL(/\/clients\/c-a\/graduation-certificate\/ph-1$/);

  const sheet = page.locator("article.certificate-sheet");
  await expect(sheet).toContainText("Certificado de graduação");
  await expect(sheet).toContainText("Aluno Adulto alcançou Faixa Azul em Jiu-Jitsu, em 12 de setembro de 2026, por avaliação de Mestre Léo.");
  await expect(sheet).toContainText("Mestre Léo");
  const footer = page.getByTestId("certificate-verification");
  await expect(footer).toContainText(CODE_RE);
  await waitForStore(page, (t) => t.issuedCertificates?.length === 1);
  const issued = (await readTenant(page)).issuedCertificates[0];
  expect(issued).toMatchObject({ kind: "graduation", promotionId: "ph-1", studentId: "c-a", status: "valid" });
  expect(issued.code).toMatch(CODE_RE);
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute("href", "/api/documents/certificates/graduation/c-a/ph-1");
  const pdf = await page.request.get("/api/documents/certificates/graduation/c-a/ph-1");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await readTenant(page)).issuedCertificates).toHaveLength(1);

  // Pagina publica: a graduacao no lugar do curso, nome abreviado.
  const anonymous = await context.browser()!.newContext();
  const pub = await anonymous.newPage();
  await pub.goto(`/p/certificado/${issued.code}`);
  await expect(pub.getByRole("heading", { name: "Certificado válido" })).toBeVisible();
  await expect(pub.getByText("Aluno A.", { exact: true })).toBeVisible();
  await expect(pub.getByText("Faixa Azul · Jiu-Jitsu")).toBeVisible();
  await expect(pub.getByText("Faixa Branca")).toBeVisible();
  await expect(pub.getByText("12/09/2026")).toBeVisible();
  await expect(pub.getByText("Carga horária")).toHaveCount(0);

  // Cancelar: confirma e a pagina passa a dizer que nao vale.
  await page.getByRole("button", { name: "Cancelar certificado" }).click();
  await page.getByRole("alertdialog", { name: "Cancelar o certificado?" }).getByRole("button", { name: "Cancelar certificado" }).click();
  await expect(page.getByText("Certificado cancelado.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
  await waitForStore(page, (t) => t.issuedCertificates?.[0]?.status === "canceled");
  await pub.goto(`/p/certificado/${issued.code}`);
  await expect(pub.getByRole("heading", { name: "Certificado cancelado" })).toBeVisible();
  await anonymous.close();
});

test("editor: o modelo de graduação tem galeria, variáveis e prévia próprias", async ({ page }) => {
  await seedGraduated(page);
  await page.goto("/certificates");
  const panel = page.getByRole("main");
  await panel.getByRole("tab", { name: "Graduação" }).click();
  const sheet = panel.getByTestId("certificate-preview").locator("article.certificate-sheet");
  await expect(sheet).toContainText("Certificado de graduação");
  await expect(sheet).toContainText("Ana Souza alcançou Faixa Azul em Jiu-Jitsu");
  const gallery = panel.getByRole("radiogroup", { name: "Modelos prontos" });
  await expect(gallery.getByRole("radio")).toHaveCount(11);
  await gallery.getByRole("radio", { name: /^Lutas/ }).click();
  await expect(sheet).toContainText("conquistou a Faixa Azul de Jiu-Jitsu, em 12 de setembro de 2026");

  // Variaveis da graduacao, sem as do curso; "Previa com" lista a graduacao registrada.
  await panel.getByRole("button", { name: /^Texto/ }).click();
  await expect(panel.getByRole("button", { name: "Etapa alcançada", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Data da graduação", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Curso", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("switch", { name: "Mostrar frequência" })).toHaveCount(0);
  await panel.getByRole("combobox", { name: "Prévia com" }).click();
  await page.getByRole("option", { name: "Aluno Adulto · Faixa Azul" }).click();
  await expect(sheet).toContainText("Aluno Adulto");
  await expect(sheet).toContainText("Mestre Léo");

  await panel.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Modelo de certificado salvo.")).toBeVisible();
  await waitForStore(page, (t) => t.graduationCertificateTemplate?.accentColor === "wine");
  // O modelo de curso nao mudou.
  expect((await readTenant(page)).certificateTemplate).toBeUndefined();

  // O certificado do aluno sai com o modelo salvo.
  await page.goto("/clients/c-a/graduation-certificate/ph-1");
  await expect(page.locator("article.certificate-sheet")).toContainText("conquistou a Faixa Azul de Jiu-Jitsu");
});
