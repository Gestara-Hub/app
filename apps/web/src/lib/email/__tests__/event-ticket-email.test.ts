import { describe, expect, it } from "vitest";
import {
  buildEventTicketEmailHtml,
  buildEventTicketEmailSubject,
  buildEventTicketEmailText,
  eventTicketStatusLine,
  type SendEventTicketEmailInput,
} from "../mailersend";

/** E-mail do ingresso na inscricao pelo link (12/11/2026). */
const base: SendEventTicketEmailInput = {
  toEmail: "pessoa@exemplo.com",
  toName: "Bruno Lima Souza",
  organizationName: "Dojo Norte",
  eventName: "Seminário aberto",
  days: ["Terça-feira, 10/11 · 09:00 às 12:00"],
  ticketUrl: "https://app.exemplo/p/i/A1B2C3D4E5F6",
  status: "confirmed",
  pendingCents: 0,
};

describe("e-mail do ingresso", () => {
  it("leva o link do ingresso, o evento, o espaço e os dias", () => {
    const text = buildEventTicketEmailText(base);
    expect(buildEventTicketEmailSubject(base)).toBe("Seu ingresso: Seminário aberto");
    expect(text).toContain("Inscrição feita, Bruno!");
    expect(text).toContain("Seminário aberto · Dojo Norte");
    expect(text).toContain("Terça-feira, 10/11 · 09:00 às 12:00");
    expect(text).toContain("Seu ingresso: https://app.exemplo/p/i/A1B2C3D4E5F6");
    expect(buildEventTicketEmailHtml({ ...base, hasInlineIcon: false })).toContain('href="https://app.exemplo/p/i/A1B2C3D4E5F6"');
  });

  it("diz o que falta: nada, pagar ou pagar no prazo da reserva", () => {
    expect(eventTicketStatusLine(base)).toBe("Sua vaga está garantida. Mostre o ingresso na entrada.");
    expect(eventTicketStatusLine({ ...base, pendingCents: 25000 })).toMatch(/Falta pagar R\$\s250,00: pague pela página do ingresso\./);
    expect(eventTicketStatusLine({ ...base, status: "reserved", pendingCents: 25000, holdMinutes: 30 })).toMatch(
      /reservada por 30 minutos\. Pague R\$\s250,00 pela página do ingresso/,
    );
  });

  it("escapa o que veio digitado no HTML", () => {
    const html = buildEventTicketEmailHtml({ ...base, toName: "<b>Bruno</b>", hasInlineIcon: false });
    expect(html).not.toContain("<b>Bruno</b>");
    expect(html).toContain("&lt;b&gt;Bruno&lt;/b&gt;");
  });
});
