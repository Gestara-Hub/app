import { randomBytes } from "node:crypto";
import type { Browser, Page } from "@playwright/test";
import { resetRateLimits } from "./db";
import { editAcademy, expect, readAcademy, seedAcademy, student, test } from "./fixtures";

/**
 * Inscricao em evento por link, ingresso e entrada (doc product/29, aprovada em
 * 12/11/2026). Relogio fixo em 22/09/2026: o evento "de hoje" acontece nesse dia.
 */

const TS = "2026-09-01T12:00:00.000Z";
const ORG = "org-academia-x";
const UNIT = "unit-academia-x";

function linkEvent(id: string, name: string, code: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG,
    unitId: UNIT,
    name,
    instructors: [{ id: `${id}-i1`, guestName: "Mestre Convidado", guestOrigin: "Curitiba" }],
    billingMode: "free",
    status: "active",
    publicSignup: { enabled: true, code },
    seatGuarantee: "on_signup",
    holdMinutes: 30,
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

const day = (id: string, eventId: string, date: string) => ({
  id,
  eventId,
  date,
  start: "19:00",
  end: "21:00",
  status: "scheduled",
  createdAt: TS,
  updatedAt: TS,
});

const newCode = () => randomBytes(6).toString("hex");

/** A pagina publica abre sem login: outro navegador, sem a sessao da equipe. */
async function publicPage(browser: Browser, page: Page, path: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const visitor = await context.newPage();
  await visitor.goto(path);
  return visitor;
}

async function seedLinkEvent(page: Page, code: string, over: Record<string, unknown> = {}, extra?: (t: Record<string, unknown[]>) => void) {
  await resetRateLimits("event_signup:");
  await seedAcademy(page);
  await editAcademy((t) => {
    t.organization.subscription = { tier: "pro" };
    t.events = [linkEvent("ev-link", "Seminário aberto", code, over)];
    t.eventSessions = [day("evs-link", "ev-link", "2026-09-22")];
    t.eventRegistrations = [];
    extra?.(t as unknown as Record<string, unknown[]>);
  });
}

test("Inscrição pelo link: pessoa nova se inscreve, recebe o ingresso e a equipe confirma a entrada digitando o código", async ({ page, browser }) => {
  const code = newCode();
  await seedLinkEvent(page, code);
  await page.goto("/dashboard");

  const visitor = await publicPage(browser, page, `/p/e/${code}`);
  await expect(visitor.getByRole("heading", { name: "Seminário aberto" })).toBeVisible();
  await expect(visitor.getByText("Mestre Convidado (Curitiba)")).toBeVisible();
  await visitor.getByRole("textbox", { name: /^Nome/ }).fill("Bruno Lima Souza");
  await visitor.getByRole("textbox", { name: /^WhatsApp/ }).fill("11966660000");
  await visitor.getByRole("button", { name: "Inscrever", exact: true }).click();
  // Sem o aceite: o servidor recusa e diz o que falta.
  await expect(visitor.getByText("Aceite para concluir a inscrição.")).toBeVisible();
  await visitor.getByRole("checkbox", { name: /Li e aceito/ }).click();
  await visitor.getByRole("button", { name: "Inscrever", exact: true }).click();
  // Vai direto para a pagina do ingresso: endereco proprio, atualizar nao perde.
  await expect(visitor).toHaveURL(/\/p\/i\/[A-F0-9]{12}\?nova=1/);
  await expect(visitor.getByText("Inscrição confirmada, Bruno L. S.")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText("Bruno L. S.", { exact: true })).toBeVisible();
  await expect(visitor.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(visitor.getByRole("img", { name: "QR code do ingresso" })).toBeVisible();
  await expect(visitor.getByText("Souza")).toHaveCount(0);

  // O aparelho lembra: reabrir o link do evento mostra o ingresso de quem se inscreveu aqui.
  await visitor.goto(`/p/e/${code}`);
  await expect(visitor.getByText("Você se inscreveu neste aparelho")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Ver ingresso" })).toHaveAttribute("href", /\/p\/i\/[A-F0-9]{12}$/);
  await expect(visitor.getByRole("heading", { name: "Inscrever outra pessoa" })).toBeVisible();

  const world = await readAcademy();
  const registration = (world.eventRegistrations ?? []).find((r: { source?: string }) => r.source === "public_link");
  expect(registration).toMatchObject({ status: "confirmed" });
  await visitor.context().close();

  // Equipe: o inscrito aparece com "Pelo link"; na porta, digita o codigo.
  await page.goto("/events/ev-link");
  await expect(page.getByText("Pelo link", { exact: true })).toBeVisible();
  await page.goto(`/events/sessions/evs-link`);
  await page.getByRole("button", { name: "Ler ingressos" }).click();
  await page.getByRole("button", { name: "Digitar código" }).click();
  await page.getByLabel("Código do ingresso").fill(registration.ticketCode.toLowerCase());
  await page.getByRole("button", { name: "Conferir" }).click();
  await expect(page.getByText("Pode entrar")).toBeVisible();

  // A mesma leitura de novo (o campo volta depois do "Pode entrar"): ja entrou.
  await page.getByLabel("Código do ingresso").fill(registration.ticketCode);
  await page.getByRole("button", { name: "Conferir" }).click();
  await expect(page.getByText(/Já entrou hoje/)).toBeVisible();
});

test("Inscrição pelo link: lotado entra na espera; menor com o aceite do responsável; link desligado recusa", async ({ page, browser }) => {
  const code = newCode();
  await seedLinkEvent(page, code, { capacity: 1 }, (t) => {
    t.clients.push(student("c-cheio", "Já Inscrito", { planId: undefined }));
    t.eventRegistrations.push({
      id: "reg-cheio",
      eventId: "ev-link",
      studentId: "c-cheio",
      scope: "full",
      status: "confirmed",
      amountCents: 0,
      installments: 1,
      registeredAt: TS,
    });
  });
  await page.goto("/dashboard");

  const visitor = await publicPage(browser, page, `/p/e/${code}`);
  await expect(visitor.getByText("Lotado: entre na lista de espera")).toBeVisible();
  await visitor.getByRole("textbox", { name: /^Nome/ }).fill("Lia Rocha");
  await visitor.getByRole("switch", { name: "Participante menor de 18 anos" }).click();
  await visitor.getByLabel("Nome do responsável").fill("Marta Rocha");
  await visitor.getByLabel("WhatsApp do responsável").fill("11933330000");
  await visitor.getByRole("checkbox", { name: /Sou o responsável legal/ }).click();
  await visitor.getByRole("button", { name: "Entrar na lista de espera" }).click();
  await expect(visitor.getByText("Você está na lista de espera")).toBeVisible();

  const world = await readAcademy();
  const lia = world.clients.find((c: { name: string }) => c.name === "Lia Rocha");
  expect(lia).toMatchObject({ minorConsentStatus: "confirmed_whatsapp", minorConsentBy: "Marta Rocha" });
  await visitor.context().close();

  // O sino avisa da inscricao nova pelo link.
  await page.goto("/events");
  await page.getByRole("button", { name: /^Lembretes/ }).click();
  await expect(page.getByText(/inscrição nova pelo link/).first()).toBeVisible();
  await page.keyboard.press("Escape");

  // Link desligado: a pagina mostra o evento e "fechadas".
  await editAcademy((t) => {
    (t.events[0] as { publicSignup: { enabled: boolean } }).publicSignup.enabled = false;
  });
  const closed = await publicPage(browser, page, `/p/e/${code}`);
  await expect(closed.getByText("As inscrições por este link estão fechadas. Fale com o espaço.")).toBeVisible();
  await expect(closed.getByRole("button", { name: /Inscrever/ })).toHaveCount(0);
  await closed.context().close();
});

test("Equipe logada abre o link do ingresso (câmera comum): confere e confirma a entrada na página", async ({ page, browser }) => {
  const code = newCode();
  await seedLinkEvent(page, code);
  await page.goto("/dashboard");

  const visitor = await publicPage(browser, page, `/p/e/${code}`);
  await visitor.getByRole("textbox", { name: /^Nome/ }).fill("Davi Moura");
  await visitor.getByRole("textbox", { name: /^WhatsApp/ }).fill("11944441111");
  await visitor.getByRole("checkbox", { name: /Li e aceito/ }).click();
  await visitor.getByRole("button", { name: "Inscrever", exact: true }).click();
  await expect(visitor.getByText("Inscrição confirmada, Davi M.")).toBeVisible();
  await visitor.context().close();

  // A pagina publica nao carrega o espaco no navegador: a conferencia vai ao servidor pela sessao.
  const world = await readAcademy();
  const registration = (world.eventRegistrations ?? []).find((r: { source?: string }) => r.source === "public_link");
  await page.goto(`/p/i/${registration.ticketCode}`);
  await expect(page.getByText("Ingresso válido")).toBeVisible();
  await expect(page.getByText(/Sem espaço carregado/)).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar entrada" }).click();
  await expect(page.getByText("Pode entrar")).toBeVisible();
});

test("Ingresso com pagamento pendente: a leitura para e a entrada é confirmada com o aviso", async ({ page, browser }) => {
  const code = newCode();
  await seedLinkEvent(page, code, { billingMode: "fixed", priceCents: 5000, maxInstallments: 1 });
  await page.goto("/dashboard");

  const visitor = await publicPage(browser, page, `/p/e/${code}`);
  await expect(visitor.getByText("R$ 50,00").first()).toBeVisible();
  await visitor.getByRole("textbox", { name: /^Nome/ }).fill("Carla Dias");
  await visitor.getByRole("textbox", { name: /^WhatsApp/ }).fill("11955550000");
  await visitor.getByRole("checkbox", { name: /Li e aceito/ }).click();
  await visitor.getByRole("button", { name: "Inscrever (R$ 50,00)" }).click();
  await expect(visitor.getByText("Falta pagar R$ 50,00", { exact: false })).toBeVisible();
  await visitor.context().close();

  const world = await readAcademy();
  const registration = (world.eventRegistrations ?? []).find((r: { source?: string }) => r.source === "public_link");
  await page.goto(`/events/sessions/evs-link`);
  await page.getByRole("button", { name: "Ler ingressos" }).click();
  await page.getByRole("button", { name: "Digitar código" }).click();
  await page.getByLabel("Código do ingresso").fill(registration.ticketCode);
  await page.getByRole("button", { name: "Conferir" }).click();
  await expect(page.getByText("Pagamento pendente: R$ 50,00")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar entrada" }).click();
  await expect(page.getByText("Entrou com pagamento pendente")).toBeVisible();
});
