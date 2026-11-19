import { describe, expect, it } from "vitest";
import { WhatsAppApiError } from "@/lib/whatsapp";
import type { MessageLog } from "@gestarahub/contracts";
import { isTransientWhatsAppFailure } from "../messageDelivery";
import { TRANSIENT_SEND_FAILURE_REASON, reminderAlreadyHandled } from "../communicationRules";

/** Nova tentativa no envio pela Meta (19/11/2026): so nas falhas que passam sozinhas. */
describe("falha passageira no envio do WhatsApp", () => {
  it("Meta indisponível, erro temporário e limite de envio tentam de novo", () => {
    for (const code of [131000, 131016, 130429, 2]) {
      expect(isTransientWhatsAppFailure(new WhatsAppApiError("x", code, "OAuthException"))).toBe(true);
    }
  });

  it("conta sem pagamento, fora da janela e modelo recusado não repetem", () => {
    for (const code of [131042, 131047, 132001]) {
      expect(isTransientWhatsAppFailure(new WhatsAppApiError("x", code, "OAuthException"))).toBe(false);
    }
  });

  it("falha de rede repete; tempo esgotado não (a Meta pode ter enviado)", () => {
    expect(isTransientWhatsAppFailure(new TypeError("fetch failed"))).toBe(true);
    expect(isTransientWhatsAppFailure(new DOMException("The operation timed out.", "TimeoutError"))).toBe(false);
  });
});

describe("lembrete automático depois de falha passageira", () => {
  const log = (status: MessageLog["status"], errorReason?: string) => ({ status, errorReason }) as MessageLog;

  it("sem envio hoje: não tratado", () => {
    expect(reminderAlreadyHandled([])).toBe(false);
  });

  it("enviado ou com falha definitiva: tratado (não repete)", () => {
    expect(reminderAlreadyHandled([log("sent")])).toBe(true);
    expect(reminderAlreadyHandled([log("failed", "Conta sem forma de pagamento na Meta.")])).toBe(true);
  });

  it("falha passageira: volta na próxima rodada, até 3 no dia", () => {
    const transient = log("failed", TRANSIENT_SEND_FAILURE_REASON);
    expect(reminderAlreadyHandled([transient])).toBe(false);
    expect(reminderAlreadyHandled([transient, transient])).toBe(false);
    expect(reminderAlreadyHandled([transient, transient, transient])).toBe(true);
    expect(reminderAlreadyHandled([transient, log("sent")])).toBe(true);
  });
});
