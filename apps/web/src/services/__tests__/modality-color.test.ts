import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { resetAcademy } from "@/test/academy";

/** Cor da modalidade no Calendario, versao 2 (doc product/29 §Calendario, 13/11/2026). */

beforeEach(() => resetAcademy());

describe("cor da modalidade", () => {
  it("a nova ganha a primeira cor livre, contando as antigas sem cor salva pela ordem", async () => {
    const before = store.categories.length;
    const created = await categoriesService.create({ name: "Capoeira" });
    // As da academia de teste sem cor mostram azul, verde... pela ordem: a nova nao repete.
    const shown = ["blue", "emerald", "amber", "rose", "cyan", "orange", "lime", "stone"].slice(0, before);
    expect(shown).not.toContain(created.color);
    expect(created.color).toBeDefined();
  });

  it("a escolhida vale, muda na edicao e cor de fora da paleta e recusada", async () => {
    const created = await categoriesService.create({ name: "Capoeira", color: "lime" });
    expect(created.color).toBe("lime");
    const updated = await categoriesService.update(created.id, { color: "stone" });
    expect(updated.color).toBe("stone");
    await expect(categoriesService.update(created.id, { color: "violet" as never })).rejects.toMatchObject({
      fields: [{ field: "color", message: "Escolha uma das cores." }],
    });
  });
});
