import { beforeEach, describe, expect, it } from "vitest";
import { attentionReminderKeys, buildReminders, pendingReminders } from "@/lib/messages/reminders";
import { clientsService } from "@/services/clients";
import { communicationService } from "@/services/communication";
import { resetAcademy } from "@/test/academy";

/**
 * Resumo do sino (12/11/2026): o servidor monta os lembretes e devolve so o
 * numero e as chaves de atencao. Tem de dar o mesmo que a lista do Painel.
 * Hoje: 22/09/2026.
 */
const TODAY = "2026-09-22";

beforeEach(async () => {
  resetAcademy();
  // Aniversario hoje e aniversario ha 2 dias: dois lembretes de parabens.
  await clientsService.create({ name: "Ana Hoje", phone: "+5511999990001", status: "active", birthDate: "2000-09-22" });
  await clientsService.create({ name: "Bia Antes", phone: "+5511999990002", status: "active", birthDate: "2001-09-20" });
});

describe("communicationService.getReminderSummary", () => {
  it("dá o mesmo número e as mesmas chaves que a lista inteira", async () => {
    const sources = await communicationService.getReminderSources();
    const groups = buildReminders(sources, { today: TODAY });
    expect(pendingReminders(groups)).toBeGreaterThan(0);

    const summary = await communicationService.getReminderSummary({ today: TODAY });

    expect(summary).toEqual({
      pending: pendingReminders(groups),
      levelChanges: sources.levelChanges.length,
      attentionKeys: attentionReminderKeys(groups),
    });
  });

  it("\"Lembrar amanhã\" tira o item do número", async () => {
    const sources = await communicationService.getReminderSources();
    const groups = buildReminders(sources, { today: TODAY });
    const before = pendingReminders(groups);
    const key = groups.flatMap((g) => g.items.filter((i) => !i.done)).at(0)!.key;

    const summary = await communicationService.getReminderSummary({ today: TODAY, snoozes: { [key]: "2026-09-23" } });

    expect(summary.pending).toBe(before - 1);
  });

  it("o resumo é bem menor que a lista inteira", async () => {
    const sources = await communicationService.getReminderSources();
    const summary = await communicationService.getReminderSummary({ today: TODAY });
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(sources).length / 5);
  });
});
