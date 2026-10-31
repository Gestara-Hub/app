import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Dialog, Locator, Page, TestInfo } from "@playwright/test";
import { academyJson, currentAcademy, expect, readAcademy, seedAcademy, student, test } from "./fixtures";
import { readAuditLog } from "./db";

// Fluxos longos (login + varias telas): com o `pnpm dev` ocupado, 30 s nao bastam.
test.describe.configure({ timeout: 60_000 });

const ORG = "org-academia-x";
const TS = "2026-09-01T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Arquivos gerados no teste (buffers). O campo deduplica por nome, tamanho e
// data de modificacao; com `{ name, mimeType, buffer }` o Chrome carimba a hora
// real a cada escolha (o "mesmo" arquivo nunca repetiria). Por isso os buffers
// vao para a pasta de saida do teste com data fixa, como um arquivo do disco.
// ---------------------------------------------------------------------------
const FILE_DATE = new Date("2026-09-20T10:00:00Z");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const FILES = {
  pdf: { name: "recibo.pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") },
  png: { name: "foto-recibo.png", buffer: PNG_1X1 },
  txt: { name: "notas.txt", buffer: Buffer.from("anotacoes do mes") },
} as const;
type FileKey = keyof typeof FILES;
const TXT_REASON = "Formato não aceito (use imagem ou PDF).";
const TXT_ERROR = `Remova “${FILES.txt.name}”: formato não aceito (use imagem ou PDF).`;

/** Grava os arquivos de teste e devolve o caminho de cada um. */
async function testFiles(testInfo: TestInfo): Promise<Record<FileKey, string>> {
  const dir = testInfo.outputPath("anexos");
  await mkdir(dir, { recursive: true });
  const out = {} as Record<FileKey, string>;
  for (const key of Object.keys(FILES) as FileKey[]) {
    const file = path.join(dir, FILES[key].name);
    await writeFile(file, FILES[key].buffer);
    await utimes(file, FILE_DATE, FILE_DATE);
    out[key] = file;
  }
  return out;
}

/** Lancamento manual ja gravado no mundo do mock (saida pendente de material). */
function entry(id: string, description: string) {
  return {
    id,
    organizationId: ORG,
    unitId: "unit-academia-x",
    type: "expense",
    categoryId: `fcat-${ORG}-equipment`,
    description,
    amountCents: 32000,
    dueDate: "2026-09-25",
    status: "pending",
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Lista "Arquivos anexados" do FileDropField e o item de um arquivo. */
const attached = (scope: Locator) => scope.getByRole("list", { name: "Arquivos anexados" });
const attachedItem = (scope: Locator, name: string) =>
  attached(scope).getByRole("listitem").filter({ hasText: name });

/** Eventos de auditoria do espaco com a acao e o tipo de alvo pedidos. */
async function auditCount(page: Page, action: string, targetType: string): Promise<number> {
  void page;
  const log = await readAuditLog(currentAcademy());
  return log.filter((e) => e.action === action && e.target.type === targetType).length;
}

/**
 * Grava, a cada quadro, o estado e o texto do dialog aberto (o elemento com o
 * `role` pedido que contem `title`) ate ele sair do DOM, incluindo a animacao
 * de saida (`data-state="closed"`). O no e o mesmo do inicio ao fim (Radix).
 */
async function recordDialogFrames(page: Page, role: "dialog" | "alertdialog", title: string) {
  await page.evaluate(
    ({ role, title }) => {
      const w = window as unknown as { __frames: string[] };
      w.__frames = [];
      const el = [...document.querySelectorAll(`[role="${role}"]`)].find((e) =>
        (e.textContent ?? "").includes(title),
      );
      if (!el) throw new Error(`dialog "${title}" nao encontrado`);
      const tick = () => {
        if (!el.isConnected) return;
        // Texto normalizado: o Intl formata "R$ 320,00" com espaco nao separavel.
        w.__frames.push(`${el.getAttribute("data-state")}|${(el.textContent ?? "").replace(/ /g, " ")}`);
        requestAnimationFrame(tick);
      };
      tick();
    },
    { role, title },
  );
}

/**
 * Quadros gravados: todos mantiveram o conteudo e (com `exit`) houve animacao
 * de saida, para o teste nao passar sem ter visto o fechamento.
 */
async function expectStableFrames(page: Page, mustContain: string[], { exit = true } = {}) {
  const frames = await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
  expect(frames.length).toBeGreaterThan(0);
  if (exit) {
    const closing = frames.filter((f) => f.startsWith("closed|"));
    expect(closing.length, `quadros da animacao de saida em ${JSON.stringify(frames.slice(-2))}`).toBeGreaterThan(0);
  }
  for (const frame of frames) {
    expect(frame).not.toContain("undefined");
    for (const text of mustContain) expect(frame).toContain(text);
  }
}

/** Abre "Novo lancamento" em Financeiro > Lancamentos. */
async function openNewEntry(page: Page) {
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Alunos > ⋮ > Inativar (sem o destaque "Lista ou cards" cobrindo a tela). */
async function openInactivateClient(page: Page, navigate = true) {
  if (navigate) {
    await page.evaluate(() => localStorage.setItem("gestarahub_coachmark_view_mode_clients", "1"));
    await page.goto("/clients");
  }
  await page.getByRole("button", { name: "Ações de Aluno A20", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Inativar aluno?" });
  await expect(confirm).toContainText("“Aluno A20” deixará de ser sugerido");
  return confirm;
}

/** Cobranças > ⋮ > Cancelar cobrança. */
async function openCancelCharge(page: Page) {
  await page.getByRole("button", { name: "Ações de Aluno A20", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancelar cobrança" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Cancelar a cobrança?" });
  await expect(confirm).toContainText("A cobrança de Aluno A20");
  return confirm;
}

/** Lancamentos > ⋮ > Excluir (useConfirmAction). */
async function openDeleteEntry(page: Page) {
  await page.getByRole("button", { name: "Ações de Conta de luz", exact: true }).click();
  await page.getByRole("menuitem", { name: "Excluir", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Excluir lançamento?" });
  await expect(confirm).toContainText("será apagado de vez");
  return confirm;
}

/** Lancamentos > ⋮ > Marcar pago (PaymentDialog). */
async function openMarkPaid(page: Page, description: string) {
  await page.getByRole("button", { name: `Ações de ${description}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Marcar pago" }).click();
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await expect(pay).toBeVisible();
  return pay;
}

// ===========================================================================
// 1. Configuracoes: alteracoes nao salvas (troca de aba e beforeunload)
// ===========================================================================
test.describe("configurações: alterações não salvas", () => {
  /** Anota os dialogs do navegador; `mode` decide se aceita (sai) ou recusa (fica). */
  function trackDialogs(page: Page) {
    const seen: string[] = [];
    const state = { mode: "accept" as "accept" | "dismiss" };
    page.on("dialog", (d: Dialog) => {
      seen.push(d.type());
      void (state.mode === "accept" ? d.accept() : d.dismiss());
    });
    return { seen, state };
  }

  /** O ponto de "nao salvo" da aba some (o guard do navegador segue o mesmo estado). */
  const expectTabClean = (page: Page, tab: RegExp) =>
    expect(page.getByRole("tab", { name: tab })).not.toHaveAccessibleName(/alterações não salvas/);
  /** O guard do navegador so liga quando o ponto da aba aparece (um render depois do painel). */
  const expectTabDirty = (page: Page, tab: RegExp) =>
    expect(page.getByRole("tab", { name: tab })).toHaveAccessibleName(/alterações não salvas/);

  test("Geral: trocar de aba com edição pede confirmação e mantém o rascunho", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/settings");
    const name = page.getByLabel("Nome do espaço");
    await name.fill("Academia Rascunho");
    await expect(page.locator("#settings-panel-geral").getByText("Alterações não salvas")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Geral/ })).toHaveAccessibleName(/alterações não salvas/);

    await page.getByRole("tab", { name: /Horários/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "Alterações não salvas" });
    await expect(confirm).toContainText("Você tem alterações não salvas na aba Geral");
    await confirm.getByRole("button", { name: "Trocar de aba" }).click();
    await expect(page).toHaveURL(/tab=horarios/);
    await expect(confirm).toBeHidden();

    // Horarios sem edicao: volta para Geral sem perguntar, com o rascunho intacto.
    await page.getByRole("tab", { name: /Geral/ }).click();
    await expect(page).toHaveURL(/tab=geral/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(name).toHaveValue("Academia Rascunho");
  });

  test("Geral: recarregar com edição avisa o navegador; sem edição ou depois de salvar, não", async ({ page }) => {
    await seedAcademy(page);
    const { seen, state } = trackDialogs(page);
    await page.goto("/settings");
    const panel = page.locator("#settings-panel-geral");
    const name = page.getByLabel("Nome do espaço");
    const original = await name.inputValue();

    // Editou e desfez: o formulario volta a ficar limpo e recarrega sem aviso.
    await name.click();
    await name.press("End");
    await name.pressSequentially("X");
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
    await name.press("Backspace");
    await expect(panel.getByText("Alterações não salvas")).toHaveCount(0);
    await expectTabClean(page, /Geral/);
    await page.reload();
    expect(seen).toEqual([]);

    // Com edicao: o navegador pergunta. Recusar mantem a tela e o rascunho.
    await name.click();
    await name.fill("Academia Nova");
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
    await expectTabDirty(page, /Geral/);
    state.mode = "dismiss";
    void page.reload().catch(() => undefined);
    await expect.poll(() => seen).toEqual(["beforeunload"]);
    await expect(name).toHaveValue("Academia Nova");

    // Aceitar recarrega e descarta o que nao foi salvo.
    state.mode = "accept";
    await page.reload();
    expect(seen).toEqual(["beforeunload", "beforeunload"]);
    await expect(name).toHaveValue(original);

    // Depois de salvar, sai sem aviso.
    await name.click();
    await name.fill("Academia Nova");
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Configurações salvas.")).toBeVisible();
    await expect(panel.getByText("Alterações não salvas")).toHaveCount(0);
    await expectTabClean(page, /Geral/);
    await expect
      .poll(async () => (await academyJson()).includes("Academia Nova"))
      .toBe(true);
    await page.reload();
    expect(seen).toHaveLength(2);
    await expect(name).toHaveValue("Academia Nova");
  });

  test("Horários: sair com edição avisa o navegador; sem edição ou depois de salvar, não", async ({ page }) => {
    await seedAcademy(page);
    const { seen } = trackDialogs(page);
    await page.goto("/settings?tab=horarios");
    const panel = page.locator("#settings-panel-horarios");
    const monday = panel.getByRole("switch").nth(1);

    // Liga e desliga: nada pendente, navega sem aviso.
    await monday.click();
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
    await monday.click();
    await expect(panel.getByText("Alterações não salvas")).toHaveCount(0);
    await expectTabClean(page, /Horários/);
    await page.goto("/dashboard");
    expect(seen).toEqual([]);

    // Fecha a segunda e tenta sair: o navegador pergunta; aceitar descarta.
    await page.goto("/settings?tab=horarios");
    await monday.click();
    await expect(panel.getByText("Alterações não salvas")).toBeVisible();
    await expectTabDirty(page, /Horários/);
    await page.goto("/dashboard");
    expect(seen).toEqual(["beforeunload"]);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings?tab=horarios");
    await expect(page.getByTestId("hours-summary-1")).toHaveText("06:00–22:00");

    // Salvo: sai sem aviso.
    await monday.click();
    await panel.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Horários de funcionamento salvos.")).toBeVisible();
    await expect(panel.getByText("Alterações não salvas")).toHaveCount(0);
    await expectTabClean(page, /Horários/);
    await expect
      .poll(async () => {
        const days: { weekday: number; closed: boolean }[] = (await readAcademy()).unit.businessHours;
        return days.find((d) => d.weekday === 1)?.closed;
      })
      .toBe(true);
    await page.goto("/dashboard");
    expect(seen).toEqual(["beforeunload"]);
  });
});

// ===========================================================================
// 2. Registro de formularios sujos do Dialog
// ===========================================================================
test.describe("dialog: descartar alterações", () => {
  test("Novo lançamento: X, Esc e Cancelar pedem confirmação; continuar mantém o texto", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/finance?tab=lancamentos");
    const discard = page.getByRole("alertdialog", { name: "Descartar alterações?" });

    // Sem nada digitado, fecha direto.
    let dialog = await openNewEntry(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(discard).toHaveCount(0);

    dialog = await openNewEntry(page);
    const description = dialog.getByLabel("Descrição");
    await description.fill("Conta de água");

    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(discard).toContainText("O que você preencheu neste formulário será perdido.");
    await discard.getByRole("button", { name: "Continuar editando" }).click();
    await expect(discard).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(description).toHaveValue("Conta de água");

    await description.press("Escape");
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Continuar editando" }).click();
    await expect(description).toHaveValue("Conta de água");

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await discard.getByRole("button", { name: "Descartar" }).click();
    await expect(dialog).toBeHidden();
    await expect(discard).toBeHidden();

    // Reabre limpo.
    dialog = await openNewEntry(page);
    await expect(dialog.getByLabel("Descrição")).toHaveValue("");
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();
    await expect(discard).toHaveCount(0);
  });

  test("pagamento do professor: ajuste salvo ou cancelado não deixa o detalhe pedindo descarte", async ({ page }) => {
    await seedAcademy(page);
    await page.goto("/finance?tab=professores&month=2026-08");
    await page.getByRole("button", { name: "Configurar pagamento" }).click();
    const rule = page.getByRole("dialog", { name: "Configurar pagamento" });
    await rule.getByLabel("Valor mensal").fill("200000");
    await rule.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText("Pagamento configurado.")).toBeVisible();
    await expect(rule).toBeHidden();

    const payoutRow = page.getByRole("button", { name: "Ver pagamento de Carlos Silva" });
    const detail = page.getByRole("dialog").filter({ hasText: "Carlos Silva" });
    const discard = page.getByRole("alertdialog", { name: "Descartar alterações?" });
    const closeDetail = detail.getByRole("button", { name: "Fechar", exact: true });

    // Ajuste salvo: fechar pelo X nao pergunta.
    await payoutRow.click();
    await detail.getByRole("button", { name: "Adicionar ajuste" }).click();
    await detail.getByLabel("Descrição").fill("Bônus do evento");
    await detail.locator("#adjustment-amount").fill("15000");
    await detail.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText("Ajuste salvo.")).toBeVisible();
    await expect(detail.getByLabel("Descrição")).toHaveCount(0);
    await closeDetail.click();
    await expect(detail).toBeHidden();
    await expect(discard).toHaveCount(0);

    // Ajuste digitado e ainda aberto: o X pergunta (controle do caso acima).
    await payoutRow.click();
    await detail.getByRole("button", { name: "Adicionar ajuste" }).click();
    await detail.getByLabel("Descrição").fill("Vale transporte");
    await closeDetail.click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Continuar editando" }).click();
    await expect(detail.getByLabel("Descrição")).toHaveValue("Vale transporte");

    // Cancelar o ajuste: o formulario sai do registro e o X fecha direto.
    await detail.getByRole("button", { name: "Cancelar" }).click();
    await expect(detail.getByLabel("Descrição")).toHaveCount(0);
    // Reabrir "Adicionar ajuste" comeca limpo.
    await detail.getByRole("button", { name: "Adicionar ajuste" }).click();
    await expect(detail.getByLabel("Descrição")).toHaveValue("");
    await detail.getByRole("button", { name: "Cancelar" }).click();
    await closeDetail.click();
    await expect(detail).toBeHidden();
    await expect(discard).toHaveCount(0);
    await expect(payoutRow).toContainText("R$ 2.150,00");
  });
});

// ===========================================================================
// 3. Saida dos dialogs sem piscar e confirmacao que resolve uma vez so
// ===========================================================================
test.describe("dialog: saída sem piscar", () => {
  const INACTIVATE_TEXT = ["Inativar aluno?", "“Aluno A20” deixará de ser sugerido"];
  const CANCEL_TEXT = ["Cancelar a cobrança?", "A cobrança de Aluno A20", "sai do total a receber"];
  const DELETE_TEXT = ["Excluir lançamento?", "“Conta de luz” (R$ 320,00) será apagado de vez"];

  test("inativar aluno: o texto fica na saída ao voltar e ao confirmar", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    const confirm = await openInactivateClient(page);
    await recordDialogFrames(page, "alertdialog", "Inativar aluno?");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, INACTIVATE_TEXT);

    await openInactivateClient(page, false);
    await recordDialogFrames(page, "alertdialog", "Inativar aluno?");
    await confirm.getByRole("button", { name: "Inativar", exact: true }).click();
    await expect(page.getByText("Aluno inativado.")).toBeVisible();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, INACTIVATE_TEXT);
  });

  test("cancelar cobrança: o texto fica na saída ao voltar e ao confirmar", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    await page.goto("/classes/billing?status=all");
    const confirm = await openCancelCharge(page);
    await recordDialogFrames(page, "alertdialog", "Cancelar a cobrança?");
    await confirm.getByRole("button", { name: "Voltar" }).click();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, CANCEL_TEXT);

    await openCancelCharge(page);
    await recordDialogFrames(page, "alertdialog", "Cancelar a cobrança?");
    await confirm.getByRole("button", { name: "Cancelar cobrança" }).click();
    await expect(page.getByText("Cobrança cancelada com sucesso.")).toBeVisible();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, CANCEL_TEXT);
  });

  test("excluir lançamento (useConfirmAction): o texto fica na saída ao voltar e ao confirmar", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialEntries = [entry("fe-luz", "Conta de luz")]) });
    await page.goto("/finance?tab=lancamentos");
    const confirm = await openDeleteEntry(page);
    await recordDialogFrames(page, "alertdialog", "Excluir lançamento?");
    await confirm.getByRole("button", { name: "Voltar" }).click();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, DELETE_TEXT);

    await openDeleteEntry(page);
    await recordDialogFrames(page, "alertdialog", "Excluir lançamento?");
    await confirm.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Lançamento excluído.")).toBeVisible();
    await expect(confirm).toBeHidden();
    await expectStableFrames(page, DELETE_TEXT);
  });

  test("registrar pagamento: título e resumo ficam na saída", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialEntries = [entry("fe-kimonos", "Kimonos para revenda")]) });
    await page.goto("/finance?tab=lancamentos");
    const pay = await openMarkPaid(page, "Kimonos para revenda");
    await expect(pay).toContainText("Kimonos para revenda");
    await recordDialogFrames(page, "dialog", "Registrar pagamento");
    await pay.getByRole("button", { name: "Cancelar" }).click();
    await expect(pay).toBeHidden();
    await expectStableFrames(page, ["Registrar pagamento", "Kimonos para revenda", "R$ 320,00"]);
  });

  test("registrar pagamento: Cancelar com forma escolhida pede para descartar", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialEntries = [entry("fe-kimonos", "Kimonos para revenda")]) });
    await page.goto("/finance?tab=lancamentos");
    const pay = await openMarkPaid(page, "Kimonos para revenda");
    const discard = page.getByRole("alertdialog", { name: "Descartar alterações?" });

    await pay.getByRole("radio", { name: "Pix" }).click();
    await pay.getByRole("button", { name: "Cancelar" }).click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Continuar editando" }).click();
    await expect(pay.getByRole("radio", { name: "Pix" })).toBeChecked();

    await pay.getByRole("button", { name: "Cancelar" }).click();
    await discard.getByRole("button", { name: "Descartar" }).click();
    await expect(pay).toBeHidden();
  });
});

test.describe("confirmação com duplo clique", () => {
  test("excluir lançamento (useConfirmAction): duplo clique exclui uma vez", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.financialEntries = [entry("fe-luz", "Conta de luz")]) });
    await page.goto("/finance?tab=lancamentos");
    const confirm = await openDeleteEntry(page);
    await confirm.getByRole("button", { name: "Excluir", exact: true }).dblclick();
    await expect(page.getByText("Lançamento excluído.").first()).toBeVisible();
    await expect(confirm).toBeHidden();
    await page.waitForTimeout(1000); // uma segunda gravacao (350 ms de latencia) apareceria aqui
    await expect(page.getByText("Lançamento excluído.")).toHaveCount(1);
    await expect(page.getByText("Não foi possível excluir o lançamento.")).toHaveCount(0);
    await expect.poll(() => auditCount(page, "deleted", "financial_entry")).toBe(1);
  });

  // O ConfirmActionDialog trava o segundo clique na hora (o `isPending` da
  // mutacao so chega num render posterior).
  test("inativar aluno: duplo clique inativa uma vez", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    const confirm = await openInactivateClient(page);
    await confirm.getByRole("button", { name: "Inativar", exact: true }).dblclick();
    await expect(page.getByText("Aluno inativado.").first()).toBeVisible();
    await expect(confirm).toBeHidden();
    await page.waitForTimeout(1000);
    await expect.poll(() => auditCount(page, "inactivated", "client")).toBe(1);
    await expect(page.getByText("Aluno inativado.")).toHaveCount(1);
  });

  test("cancelar cobrança: duplo clique cancela uma vez", async ({ page }) => {
    await seedAcademy(page, { extra: (t) => (t.clients = [student("c-a", "Aluno A20")]) });
    await page.goto("/classes/billing?status=all");
    const confirm = await openCancelCharge(page);
    await confirm.getByRole("button", { name: "Cancelar cobrança" }).dblclick();
    await expect(page.getByText("Cobrança cancelada com sucesso.").first()).toBeVisible();
    await expect(confirm).toBeHidden();
    await page.waitForTimeout(1000);
    await expect.poll(() => auditCount(page, "cancelled", "charge")).toBe(1);
    await expect(page.getByText("Cobrança cancelada com sucesso.")).toHaveCount(1);
  });
});

// ===========================================================================
// 4. Anexos (FileDropField): lancamento e registrar pagamento
// ===========================================================================
test.describe("anexos", () => {
  test("novo lançamento: miniatura, sem duplicar, remover, arquivo recusado bloqueia e reabre limpo", async ({
    page,
  }, testInfo) => {
    const files = await testFiles(testInfo);
    await seedAcademy(page);
    await page.goto("/finance?tab=lancamentos");
    let dialog = await openNewEntry(page);
    await dialog.getByRole("combobox").filter({ hasText: "Selecione a categoria" }).click();
    await page.getByRole("menuitem", { name: "Aluguel" }).click();
    await dialog.getByLabel("Descrição").fill("Aluguel com recibo");
    await dialog.getByLabel("Valor").fill("150000");

    const input = dialog.locator("input[type=file]");
    await input.setInputFiles([files.pdf, files.png]);
    await expect(attached(dialog).getByRole("listitem")).toHaveCount(2);
    // Imagem com miniatura; PDF com icone e o tipo.
    await expect(attachedItem(dialog, FILES.png.name).locator("img")).toHaveAttribute("src", /^blob:/);
    await expect(attachedItem(dialog, FILES.pdf.name).locator("img")).toHaveCount(0);
    await expect(attachedItem(dialog, FILES.pdf.name)).toContainText("PDF ·");
    await expect(attachedItem(dialog, FILES.png.name)).toContainText("PNG ·");

    // O mesmo arquivo de novo nao duplica.
    await input.setInputFiles([files.pdf]);
    await expect(attached(dialog).getByRole("listitem")).toHaveCount(2);

    // Formato recusado: em vermelho com o motivo, e o envio para no Zod.
    await input.setInputFiles([files.txt]);
    await expect(attached(dialog).getByRole("listitem")).toHaveCount(3);
    const reason = attachedItem(dialog, FILES.txt.name).getByText(TXT_REASON);
    await expect(reason).toBeVisible();
    await expect(reason).toHaveClass(/text-destructive/);
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(dialog.getByText(TXT_ERROR)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Lançamento criado.")).toHaveCount(0);

    // Remover o recusado limpa o erro; remover o PDF deixa so a imagem.
    await dialog.getByRole("button", { name: `Remover ${FILES.txt.name}` }).click();
    await expect(dialog.getByText(TXT_ERROR)).toHaveCount(0);
    await dialog.getByRole("button", { name: `Remover ${FILES.pdf.name}` }).click();
    await expect(attached(dialog).getByRole("listitem")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText("Lançamento criado.")).toBeVisible();
    await expect(page.locator('div.group[aria-label="Aluguel com recibo"] [title="1 comprovante"]')).toBeVisible();

    // Reabrir comeca sem anexos.
    dialog = await openNewEntry(page);
    await expect(attached(dialog)).toHaveCount(0);
    await expect(dialog.getByLabel("Descrição")).toHaveValue("");
  });

  test("registrar pagamento: comprovantes, recusado bloqueia e reabrir começa limpo", async ({ page }, testInfo) => {
    const files = await testFiles(testInfo);
    await seedAcademy(page, { extra: (t) => (t.financialEntries = [entry("fe-kimonos", "Kimonos para revenda")]) });
    await page.goto("/finance?tab=lancamentos");

    let pay = await openMarkPaid(page, "Kimonos para revenda");
    const input = () => pay.locator("input[type=file]");
    await pay.getByRole("radio", { name: "Pix" }).click();
    await input().setInputFiles([files.png, files.pdf]);
    await expect(attached(pay).getByRole("listitem")).toHaveCount(2);
    await expect(attachedItem(pay, FILES.png.name).locator("img")).toHaveAttribute("src", /^blob:/);
    await input().setInputFiles([files.png]);
    await expect(attached(pay).getByRole("listitem")).toHaveCount(2);

    // Com comprovante escolhido, o X pede para descartar.
    await pay.getByRole("button", { name: "Fechar" }).click();
    const discard = page.getByRole("alertdialog", { name: "Descartar alterações?" });
    await discard.getByRole("button", { name: "Descartar" }).click();
    await expect(pay).toBeHidden();

    // Reabre sem forma e sem comprovantes.
    pay = await openMarkPaid(page, "Kimonos para revenda");
    await expect(attached(pay)).toHaveCount(0);
    await expect(pay.getByRole("button", { name: "Marcar como pago" })).toBeDisabled();

    await pay.getByRole("radio", { name: "Pix" }).click();
    await input().setInputFiles([files.txt, files.pdf]);
    await expect(attachedItem(pay, FILES.txt.name)).toContainText(TXT_REASON);
    await pay.getByRole("button", { name: "Marcar como pago" }).click();
    await expect(pay.getByText(TXT_ERROR)).toBeVisible();
    await expect(page.getByText("Pagamento registrado (Pix).")).toHaveCount(0);

    await pay.getByRole("button", { name: `Remover ${FILES.txt.name}` }).click();
    await expect(pay.getByText(TXT_ERROR)).toHaveCount(0);
    await pay.getByRole("button", { name: "Marcar como pago" }).click();
    await expect(page.getByText("Pagamento registrado (Pix).")).toBeVisible();
    await expect(pay).toBeHidden();
    const row = page.locator('div.group[aria-label="Kimonos para revenda"]');
    await expect(row).toContainText("Pago");
    await expect(row.locator('[title="1 comprovante"]')).toBeVisible();
  });
});
