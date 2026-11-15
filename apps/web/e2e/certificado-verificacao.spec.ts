import { readTenant, waitForStore } from "./areas-helpers";
import { classGroup, editWorld, enrollment, expect, seedAcademy, student, test } from "./fixtures";

/**
 * Codigo de verificacao do certificado (doc 21 §1.3): abrir emite (codigo e QR
 * no rodape), a pagina publica confirma com o nome mascarado, cancelar marca
 * o registro e a pagina passa a dizer que nao vale. Hoje: 22/09/2026.
 */

const CODE_RE = /GH-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/;

async function seedCourse(page: Parameters<typeof seedAcademy>[0]) {
  await seedAcademy(page, {
    extra: (t) => {
      t.clients = [student("c-a", "Ana Souza")];
      t.classGroups = [
        classGroup("cg-course", "Defesa Pessoal", {
          billingMode: "course",
          coursePriceCents: 30000,
          courseMaxInstallments: 1,
          startDate: "2026-08-03",
          endDate: "2026-09-10",
          allowDropin: false,
          sessionPriceCents: undefined,
        }),
      ];
      t.enrollments = [{ ...enrollment("e-course", "cg-course", "c-a"), course: { priceCents: 30000, installments: 1 } }];
    },
  });
  await editWorld(page, "org-academia-x", (t) => {
    t.organization.subscription = { tier: "pro", interval: "monthly", status: "active", paymentMethod: "pix", priceCents: 7990, asaasSubscriptionId: "sub_mock_e2e", renewsOn: "2026-10-12", nextDueDate: "2026-10-12", changedAt: "2026-09-12T12:00:00.000Z" };
  });
}

test("abrir emite o código; a página pública confirma; cancelar invalida", async ({ page, context }) => {
  await seedCourse(page);
  await page.goto("/classes/cg-course/certificate/e-course");
  const footer = page.getByTestId("certificate-verification");
  await expect(footer).toContainText(CODE_RE);
  await expect(footer.getByRole("img", { name: "QR Code de verificação" })).toBeVisible();
  await expect(page.getByText(/Código de verificação GH-/)).toBeVisible();
  await waitForStore(page, (t) => t.issuedCertificates?.length === 1);
  const issued = (await readTenant(page)).issuedCertificates[0];
  expect(issued.code).toMatch(CODE_RE);
  expect(issued.status).toBe("valid");

  // Recarregar nao emite de novo.
  await page.reload();
  await expect(footer).toContainText(issued.code);
  expect((await readTenant(page)).issuedCertificates).toHaveLength(1);

  // Pagina publica, sem login: valido e com o nome abreviado.
  const anonymous = await context.browser()!.newContext();
  const pub = await anonymous.newPage();
  await pub.goto(`/p/certificado/${issued.code.toLowerCase()}`);
  await expect(pub.getByRole("heading", { name: "Certificado válido" })).toBeVisible();
  await expect(pub.getByText("Ana S.", { exact: true })).toBeVisible();
  await expect(pub.getByText("Ana Souza")).toHaveCount(0);
  await expect(pub.getByText("Defesa Pessoal")).toBeVisible();
  await pub.goto("/p/certificado/GH-AAAA-BBBB");
  await expect(pub.getByRole("heading", { name: "Certificado não encontrado" })).toBeVisible();

  // Cancelar: confirma, some o PDF e a pagina passa a dizer que nao vale.
  await page.getByRole("button", { name: "Cancelar certificado" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Cancelar o certificado?" });
  await confirm.getByRole("button", { name: "Voltar" }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole("button", { name: "Cancelar certificado" }).click();
  await confirm.getByRole("button", { name: "Cancelar certificado" }).click();
  await expect(page.getByText("Certificado cancelado.")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Certificado cancelado");
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancelar certificado" })).toHaveCount(0);
  await waitForStore(page, (t) => t.issuedCertificates?.[0]?.status === "canceled");

  await pub.goto(`/p/certificado/${issued.code}`);
  await expect(pub.getByRole("heading", { name: "Certificado cancelado" })).toBeVisible();
  await anonymous.close();
});

test("emitir em lote: ação na turma, tela com um certificado por aluno e PDF único", async ({ page }) => {
  await seedCourse(page);
  await editWorld(page, "org-academia-x", (t) => {
    t.clients.push(student("c-b", "Bia Lima"));
    t.enrollments.push({ ...enrollment("e-course-b", "cg-course", "c-b"), course: { priceCents: 30000, installments: 1 } });
  });
  await page.goto("/classes/cg-course");
  await page.getByRole("button", { name: "Mais ações da turma" }).click();
  await expect(page.getByRole("menuitem", { name: "Emitir certificados" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Tela de impressao: uma folha por aluno, cada uma com o proprio codigo.
  await page.goto("/classes/cg-course/certificates");
  await expect(page.getByText("2 certificados de Defesa Pessoal.")).toBeVisible();
  const footers = page.getByTestId("certificate-verification");
  await expect(footers).toHaveCount(2);
  await waitForStore(page, (t) => t.issuedCertificates?.length === 2);
  const codes = (await readTenant(page)).issuedCertificates.map((c: { code: string }) => c.code);
  expect(new Set(codes).size).toBe(2);
  await expect(page.locator("article.certificate-sheet").first()).toContainText("Ana Souza");
  await expect(page.locator("article.certificate-sheet").nth(1)).toContainText("Bia Lima");

  // O PDF unico sai do servidor.
  const pdf = await page.request.get("/api/documents/certificates/class/cg-course");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain("certificados-defesa-pessoal.pdf");
  // De novo nao emite outra vez.
  expect((await readTenant(page)).issuedCertificates).toHaveLength(2);
});

test("página para digitar o código e prévia do editor com um aluno de verdade", async ({ page, context }) => {
  await seedCourse(page);
  await page.goto("/classes/cg-course/certificate/e-course");
  await waitForStore(page, (t) => t.issuedCertificates?.length === 1);
  const code: string = (await readTenant(page)).issuedCertificates[0].code;
  // O rodape traz o endereco curto para quem digita.
  await expect(page.getByTestId("certificate-verification")).toContainText("/p/certificado");

  // Sem login: digita o codigo (minusculas, sem tracos) e chega na pagina do certificado.
  const anonymous = await context.browser()!.newContext();
  const pub = await anonymous.newPage();
  await pub.goto("/p/certificado");
  await pub.getByLabel("Código").fill("abc");
  await pub.getByRole("button", { name: "Verificar" }).click();
  await expect(pub.getByText("O código tem o formato GH-XXXX-XXXX.")).toBeVisible();
  await pub.getByLabel("Código").fill(code.toLowerCase().replace(/-/g, ""));
  await pub.getByRole("button", { name: "Verificar" }).click();
  await expect(pub).toHaveURL(new RegExp(`/p/certificado/${code}$`));
  await expect(pub.getByRole("heading", { name: "Certificado válido" })).toBeVisible();
  await anonymous.close();

  // Editor: "Previa com" um aluno concluido mostra o nome e o curso reais, sem emitir de novo.
  await page.goto("/certificates");
  const panel = page.getByRole("main");
  await panel.getByRole("combobox", { name: "Prévia com" }).click();
  await page.getByRole("option", { name: "Ana Souza · Defesa Pessoal" }).click();
  await expect(panel.getByTestId("certificate-preview").locator("article.certificate-sheet")).toContainText("Ana Souza concluiu o curso Defesa Pessoal");
  await expect(panel.getByTestId("certificate-preview").getByTestId("certificate-verification")).toContainText(code);
  await expect(panel.getByText("Dados de verdade, como sairiam agora.")).toBeVisible();
  expect((await readTenant(page)).issuedCertificates).toHaveLength(1);
});
