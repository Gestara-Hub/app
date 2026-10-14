import type { ModalityProgressionTrack, ProgressionTrackTemplateKey } from "@gestarahub/contracts";
import { describe, expect, it } from "vitest";
import {
  PROGRESSION_TEMPLATES,
  ageAt,
  computeNextPromotionStep,
  inferDefaultTrackForModalityName,
  inferTemplateKeyForModalityName,
  isAgedOutOfLevel,
  isLevelAllowedForAge,
  levelAgeLabel,
  resolveTrackStyle,
  trackUsesAges,
} from "@/lib/progression-tracks";

const bjj = PROGRESSION_TEMPLATES.bjj_adult.track;
const judo = PROGRESSION_TEMPLATES.judo_karate.track;
const levelById = (track: ModalityProgressionTrack, id: string) => track.levels.find((l) => l.id === id)!;

describe("ageAt", () => {
  it("antes do aniversario no ano ainda tem a idade anterior", () => {
    expect(ageAt("2010-10-15", "2026-10-14")).toBe(15);
    expect(ageAt("2010-11-01", "2026-10-14")).toBe(15);
  });

  it("no dia e depois do aniversario ja tem a idade nova", () => {
    expect(ageAt("2010-10-14", "2026-10-14")).toBe(16);
    expect(ageAt("2010-01-01", "2026-10-14")).toBe(16);
  });

  it("sem nascimento (ou data incompleta) da null", () => {
    expect(ageAt(undefined, "2026-10-14")).toBeNull();
    expect(ageAt("", "2026-10-14")).toBeNull();
    expect(ageAt("2010-10", "2026-10-14")).toBeNull();
  });

  it("nascimento depois da data da null", () => {
    expect(ageAt("2027-01-01", "2026-10-14")).toBeNull();
  });

  it("nascido hoje tem 0 anos", () => {
    expect(ageAt("2026-10-14", "2026-10-14")).toBe(0);
  });
});

describe("isLevelAllowedForAge", () => {
  const green = levelById(bjj, "lvl-kids-green");
  const white = levelById(bjj, "lvl-white");

  it("dentro da faixa etaria vale (limites inclusivos)", () => {
    expect(isLevelAllowedForAge(green, 13)).toBe(true);
    expect(isLevelAllowedForAge(green, 15)).toBe(true);
  });

  it("abaixo do minimo ou acima do maximo nao vale", () => {
    expect(isLevelAllowedForAge(green, 12)).toBe(false);
    expect(isLevelAllowedForAge(green, 16)).toBe(false);
  });

  it("idade desconhecida ou nivel sem limites sempre vale", () => {
    expect(isLevelAllowedForAge(green, null)).toBe(true);
    expect(isLevelAllowedForAge(white, 3)).toBe(true);
    expect(isLevelAllowedForAge(white, 60)).toBe(true);
  });
});

describe("levelAgeLabel", () => {
  it.each([
    [{ minAge: 4, maxAge: 15 }, "4 a 15 anos"],
    [{ minAge: 16 }, "a partir de 16 anos"],
    [{ maxAge: 15 }, "até 15 anos"],
    [{ minAge: 0, maxAge: 0 }, "0 a 0 anos"],
    [{}, null],
  ])("%j -> %j", (level, expected) => {
    expect(levelAgeLabel(level)).toBe(expected);
  });
});

describe("isAgedOutOfLevel", () => {
  const green = levelById(bjj, "lvl-kids-green");
  const blue = levelById(bjj, "lvl-blue");

  it("passou da idade maxima do nivel", () => {
    expect(isAgedOutOfLevel(green, 16)).toBe(true);
  });

  it("dentro da idade nao precisa trocar", () => {
    expect(isAgedOutOfLevel(green, 15)).toBe(false);
  });

  it("nivel sem idade maxima, idade desconhecida ou sem nivel: nunca", () => {
    expect(isAgedOutOfLevel(blue, 60)).toBe(false);
    expect(isAgedOutOfLevel(green, null)).toBe(false);
    expect(isAgedOutOfLevel(undefined, 16)).toBe(false);
  });

  it("abaixo da idade minima nao conta como 'passou da idade'", () => {
    expect(isAgedOutOfLevel(green, 10)).toBe(false);
  });
});

describe("computeNextPromotionStep", () => {
  it("com graus sobrando, ganha um grau no mesmo nivel", () => {
    expect(computeNextPromotionStep(bjj, "lvl-white", 1)).toEqual({
      nextLevel: levelById(bjj, "lvl-white"),
      nextSubLevel: 2,
      isNewBelt: false,
    });
  });

  it("no ultimo grau, vai para o proximo nivel com grau 0", () => {
    expect(computeNextPromotionStep(bjj, "lvl-blue", 4)).toEqual({
      nextLevel: levelById(bjj, "lvl-purple"),
      nextSubLevel: 0,
      isNewBelt: true,
    });
  });

  it("16 anos na Faixa Verde com graus sobrando vai direto para a Azul", () => {
    const result = computeNextPromotionStep(bjj, "lvl-kids-green", 2, 16);
    expect(result?.nextLevel.id).toBe("lvl-blue");
    expect(result?.nextSubLevel).toBe(0);
    expect(result?.isNewBelt).toBe(true);
  });

  it("15 anos na Faixa Verde ainda ganha grau", () => {
    expect(computeNextPromotionStep(bjj, "lvl-kids-green", 2, 15)).toMatchObject({
      nextLevel: { id: "lvl-kids-green" },
      nextSubLevel: 3,
      isNewBelt: false,
    });
  });

  it("6 anos na Faixa Branca completa vai para a Cinza, nao a Amarela", () => {
    expect(computeNextPromotionStep(bjj, "lvl-white", 4, 6)?.nextLevel.id).toBe("lvl-kids-gray");
  });

  it("adulto na Faixa Branca completa pula as faixas infantis", () => {
    expect(computeNextPromotionStep(bjj, "lvl-white", 4, 17)?.nextLevel.id).toBe("lvl-blue");
  });

  it("3 anos na Faixa Branca completa: nenhuma faixa vale ainda", () => {
    expect(computeNextPromotionStep(bjj, "lvl-white", 4, 3)).toBeNull();
  });

  it("sem idade segue a ordem da trilha", () => {
    expect(computeNextPromotionStep(bjj, "lvl-white", 4)?.nextLevel.id).toBe("lvl-kids-gray");
  });

  it("acha o nivel pelo nome, sem diferenciar caixa", () => {
    expect(computeNextPromotionStep(bjj, "faixa azul", 4)?.nextLevel.id).toBe("lvl-purple");
  });

  it("nivel desconhecido conta como o primeiro", () => {
    expect(computeNextPromotionStep(bjj, "nao-existe", 0)).toMatchObject({
      nextLevel: { id: "lvl-white" },
      nextSubLevel: 1,
    });
  });

  it("trilha sem graus (Judo) troca de faixa direto", () => {
    expect(computeNextPromotionStep(judo, "lvl-jk-white", 0)).toMatchObject({
      nextLevel: { id: "lvl-jk-white-gray" },
      nextSubLevel: 0,
      isNewBelt: true,
    });
  });

  it("ultimo nivel com graus completos nao tem proximo passo", () => {
    expect(computeNextPromotionStep(bjj, "lvl-black", 6)).toBeNull();
  });

  it("trilha sem niveis nao tem proximo passo", () => {
    expect(computeNextPromotionStep({ ...bjj, levels: [] }, "lvl-white", 0)).toBeNull();
  });
});

describe("trackUsesAges", () => {
  it("Jiu-Jitsu usa idade; Judo e niveis gerais nao", () => {
    expect(trackUsesAges(bjj)).toBe(true);
    expect(trackUsesAges(judo)).toBe(false);
    expect(trackUsesAges(PROGRESSION_TEMPLATES.general_levels.track)).toBe(false);
  });

  it("basta um nivel com so idade maxima", () => {
    expect(
      trackUsesAges({ ...judo, levels: [{ id: "x", name: "Kids", maxSubLevels: 0, maxAge: 12 }] }),
    ).toBe(true);
  });

  it("sem trilha nao usa idade", () => {
    expect(trackUsesAges(undefined)).toBe(false);
  });
});

describe("resolveTrackStyle", () => {
  const legacy = (track: Partial<ModalityProgressionTrack>): ModalityProgressionTrack => ({
    enabled: true,
    criteriaType: "attendance",
    levels: [],
    ...track,
  });

  it("sem trilha e 'levels'", () => {
    expect(resolveTrackStyle(undefined)).toBe("levels");
  });

  it("campo explicito vence o modelo", () => {
    expect(resolveTrackStyle({ ...bjj, style: "levels" })).toBe("levels");
    expect(
      resolveTrackStyle({ ...PROGRESSION_TEMPLATES.general_levels.track, style: "belt" }),
    ).toBe("belt");
  });

  it("sem campo, segue o modelo", () => {
    expect(resolveTrackStyle(legacy({ templateKey: "bjj_adult", levels: [{ id: "a", name: "Iniciante", maxSubLevels: 0 }] }))).toBe("belt");
    expect(resolveTrackStyle(legacy({ templateKey: "general_levels", levels: [{ id: "a", name: "Faixa Branca", maxSubLevels: 0 }] }))).toBe("levels");
  });

  it("sem campo e personalizada, decide pelos nomes dos niveis", () => {
    expect(resolveTrackStyle(legacy({ templateKey: "custom", levels: [{ id: "a", name: "Faixa Branca", maxSubLevels: 0 }] }))).toBe("belt");
    expect(resolveTrackStyle(legacy({ levels: [{ id: "a", name: "Kruang Branco", maxSubLevels: 0 }] }))).toBe("belt");
    expect(resolveTrackStyle(legacy({ levels: [{ id: "a", name: "Corda Crua", maxSubLevels: 0 }] }))).toBe("belt");
    expect(resolveTrackStyle(legacy({ templateKey: "custom", levels: [{ id: "a", name: "Iniciante", maxSubLevels: 0 }] }))).toBe("levels");
  });

  it("nome de nivel so conta como faixa pela palavra inteira", () => {
    const style = (name: string) => resolveTrackStyle(legacy({ templateKey: "custom", levels: [{ id: "a", name, maxSubLevels: 0 }] }));
    expect(style("Dança 1")).toBe("levels");
    expect(style("Standard")).toBe("levels");
    expect(style("Integrau")).toBe("levels");
    expect(style("1º Dan")).toBe("belt");
    expect(style("5º Kyu")).toBe("belt");
    expect(style("Branca 2 graus")).toBe("belt");
  });

  it("chave desconhecida (dado antigo) cai na regra pelos nomes, sem quebrar", () => {
    const unknownKey = "old_key" as ProgressionTrackTemplateKey;
    expect(resolveTrackStyle(legacy({ templateKey: unknownKey, levels: [{ id: "a", name: "Faixa Azul", maxSubLevels: 0 }] }))).toBe("belt");
    expect(resolveTrackStyle(legacy({ templateKey: unknownKey, levels: [{ id: "a", name: "Básico", maxSubLevels: 0 }] }))).toBe("levels");
  });
});

describe("inferTemplateKeyForModalityName", () => {
  it.each([
    ["Jiu-Jitsu", "bjj_adult"],
    ["BJJ Kids", "bjj_adult"],
    ["No-Gi / Submission", "bjj_adult"],
    ["Judô", "judo_karate"],
    ["Judo Infantil", "judo_karate"],
    ["Karatê", "karate"],
    ["Karate Shotokan", "karate"],
    ["Taekwondo", "taekwondo"],
    ["Kickboxing", "kickboxing"],
    ["Krav Maga", "kickboxing"],
    ["Capoeira Angola", "capoeira"],
    ["Muay Thai", "muay_thai"],
  ])("%j -> %j", (name, key) => {
    expect(inferTemplateKeyForModalityName(name)).toBe(key);
  });

  it.each([["Natação Infantil"], ["Boxe"], ["Pilates Reformer"], ["Inglês"], [""]])(
    "%j nao e modelo de luta",
    (name) => {
      expect(inferTemplateKeyForModalityName(name)).toBeNull();
    },
  );
});

describe("inferDefaultTrackForModalityName", () => {
  it("luta conhecida devolve copia do modelo", () => {
    const track = inferDefaultTrackForModalityName("Jiu-Jitsu");
    expect(track).toEqual(bjj);
    expect(track).not.toBe(bjj);
    track.levels[0].name = "Alterada";
    expect(bjj.levels[0].name).toBe("Faixa Branca");
  });

  it("nome desconhecido devolve niveis gerais desligados", () => {
    const track = inferDefaultTrackForModalityName("Natação Infantil");
    expect(track.enabled).toBe(false);
    expect(track.templateKey).toBe("general_levels");
    expect(PROGRESSION_TEMPLATES.general_levels.track.enabled).toBe(true);
  });
});

describe("PROGRESSION_TEMPLATES", () => {
  it("niveis gerais tem 3 niveis sem cor", () => {
    const { levels } = PROGRESSION_TEMPLATES.general_levels.track;
    expect(levels.map((l) => l.name)).toEqual(["Iniciante", "Intermediário", "Avançado"]);
    expect(levels.every((l) => l.color === undefined)).toBe(true);
  });

  it("cada modelo tem a propria chave, estilo, niveis e ids unicos", () => {
    for (const [key, template] of Object.entries(PROGRESSION_TEMPLATES)) {
      expect(template.track.templateKey).toBe(key);
      expect(template.track.enabled).toBe(true);
      expect(template.track.style).toBeDefined();
      expect(template.track.levels.length).toBeGreaterThan(0);
      const ids = template.track.levels.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("modelos de faixa tem cor em todos os niveis", () => {
    for (const template of Object.values(PROGRESSION_TEMPLATES)) {
      if (template.track.style !== "belt") continue;
      expect(template.track.levels.every((l) => l.color !== undefined)).toBe(true);
    }
  });

  it("faixas etarias do Jiu-Jitsu sao coerentes (min <= max)", () => {
    for (const level of bjj.levels) {
      if (level.minAge !== undefined && level.maxAge !== undefined) {
        expect(level.minAge).toBeLessThanOrEqual(level.maxAge);
      }
    }
  });
});
