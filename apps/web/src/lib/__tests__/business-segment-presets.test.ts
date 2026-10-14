import { describe, expect, it } from "vitest";
import {
  CLASSES_SEGMENT_PRESETS,
  DEFAULT_CLASS_SEGMENT,
  getAllSegmentPresets,
  getSegmentPreset,
  segmentDefaultTrack,
  segmentProgressionSummary,
  segmentTrackForModality,
  sharedVocabularyFor,
  vocabularyForModality,
  vocabularyForTrack,
} from "@/lib/business-segment-presets";
import { PROGRESSION_TEMPLATES } from "@/lib/progression-tracks";
import type { ClassesBusinessSegment, ModalityProgressionTrack } from "@gestarahub/contracts";

const presets = CLASSES_SEGMENT_PRESETS;

describe("getSegmentPreset", () => {
  it("sem area salva segue como lutas", () => {
    expect(DEFAULT_CLASS_SEGMENT).toBe("martial_arts");
    expect(getSegmentPreset(undefined).id).toBe("martial_arts");
  });

  it("devolve o preset da area", () => {
    expect(getSegmentPreset("dance")).toBe(presets.dance);
  });

  it("area desconhecida cai no personalizado", () => {
    expect(getSegmentPreset("bogus" as ClassesBusinessSegment).id).toBe("custom");
  });

  it("lista todas as areas, cada uma com o proprio id", () => {
    const all = getAllSegmentPresets();
    expect(all).toHaveLength(11);
    expect(all.map((p) => p.id)).toEqual([
      "martial_arts",
      "pilates_yoga",
      "functional_training",
      "dance",
      "music",
      "languages",
      "swimming_sports",
      "gastronomy",
      "arts_crafts",
      "beauty_courses",
      "custom",
    ]);
    for (const [id, preset] of Object.entries(presets)) {
      expect(preset.id).toBe(id);
    }
  });
});

describe("segmentTrackForModality", () => {
  it.each([
    ["Jiu-Jitsu", "bjj_adult"],
    ["Judô", "judo_karate"],
    ["Muay Thai", "muay_thai"],
  ])("lutas: %j usa o modelo %j", (name, key) => {
    expect(segmentTrackForModality(presets.martial_arts, name)?.templateKey).toBe(key);
  });

  it("lutas: nome desconhecido fica sem trilha", () => {
    expect(segmentTrackForModality(presets.martial_arts, "Boxe")).toBeUndefined();
  });

  it("musica usa modulos para qualquer nome", () => {
    expect(segmentTrackForModality(presets.music, "Violão")?.templateKey).toBe("modules");
    expect(segmentTrackForModality(presets.music, "Jiu-Jitsu")?.templateKey).toBe("modules");
  });

  it("idiomas e reforco usam os niveis gerais", () => {
    expect(segmentTrackForModality(presets.languages, "Inglês")?.templateKey).toBe("general_levels");
  });

  it.each([["gastronomy"], ["arts_crafts"], ["beauty_courses"]] as const)("%s usa modulos", (id) => {
    expect(segmentTrackForModality(presets[id], "Qualquer")?.templateKey).toBe("modules");
  });

  it("natacao usa as fases de aprendizado", () => {
    expect(segmentTrackForModality(presets.swimming_sports, "Natação Infantil")?.templateKey).toBe("swim_stages");
  });

  it("danca usa os niveis gerais ligados", () => {
    const track = segmentTrackForModality(presets.dance, "Ballet");
    expect(track?.templateKey).toBe("general_levels");
    expect(track?.enabled).toBe(true);
  });

  it.each([["pilates_yoga"], ["functional_training"], ["custom"]] as const)("%s fica sem trilha", (id) => {
    expect(segmentTrackForModality(presets[id], "Qualquer")).toBeUndefined();
  });

  it("devolve copia: mexer na trilha nao altera o modelo", () => {
    const track = segmentTrackForModality(presets.music, "Piano")!;
    track.levels[0].name = "Alterado";
    expect(PROGRESSION_TEMPLATES.modules.track.levels[0].name).toBe("Módulo Básico");
  });
});

describe("segmentDefaultTrack", () => {
  it("area sem trilha cai nos niveis gerais desligados", () => {
    const track = segmentDefaultTrack(presets.pilates_yoga, "Pilates Solo");
    expect(track.templateKey).toBe("general_levels");
    expect(track.enabled).toBe(false);
    expect(track.levels).toEqual(PROGRESSION_TEMPLATES.general_levels.track.levels);
    expect(PROGRESSION_TEMPLATES.general_levels.track.enabled).toBe(true);
  });

  it("lutas com nome desconhecido tambem cai nos niveis gerais desligados", () => {
    const track = segmentDefaultTrack(presets.martial_arts, "Boxe");
    expect(track.templateKey).toBe("general_levels");
    expect(track.enabled).toBe(false);
  });

  it("area com trilha usa a trilha da area", () => {
    expect(segmentDefaultTrack(presets.martial_arts, "Jiu-Jitsu").templateKey).toBe("bjj_adult");
    expect(segmentDefaultTrack(presets.swimming_sports, "Hidroginástica").templateKey).toBe("swim_stages");
  });
});

describe("vocabulario por area", () => {
  it("lutas falam em faixa (feminino) e graduacao", () => {
    const v = presets.martial_arts.vocabulary;
    expect(v.level).toBe("Faixa");
    expect(v.newLevel).toBe("Nova faixa");
    expect(v.selectLevel).toBe("Selecione a faixa");
    expect(v.levelName).toBe("Nome da faixa");
    expect(v.inLevel).toBe("nesta faixa");
    expect(v.currentLevel).toBe("Faixa atual");
    expect(v.promotion).toBe("Graduação");
    expect(v.promotionLower).toBe("graduação");
    expect(v.promoteVerb).toBe("Graduar");
    expect(v.trackTitle).toBe("Trilha de graduação");
    expect(v.levelsTitle).toBe("Graduação");
  });

  it("pilates fala em nivel (masculino) e avanco", () => {
    const v = presets.pilates_yoga.vocabulary;
    expect(v.newLevel).toBe("Novo nível");
    expect(v.selectLevel).toBe("Selecione o nível");
    expect(v.levelName).toBe("Nome do nível");
    expect(v.inLevel).toBe("neste nível");
    expect(v.promotion).toBe("Avanço");
    expect(v.promoteVerb).toBe("Avançar");
    expect(v.trackTitle).toBe("Trilha de níveis");
    expect(v.levelsTitle).toBe("Níveis");
  });

  it("musica fala em modulo; natacao em fase (feminino)", () => {
    expect(presets.music.vocabulary.newLevel).toBe("Novo módulo");
    expect(presets.music.vocabulary.levelsTitle).toBe("Módulos");
    expect(presets.languages.vocabulary.newLevel).toBe("Novo nível");
    expect(presets.gastronomy.vocabulary.level).toBe("Módulo");
    expect(presets.swimming_sports.vocabulary.newLevel).toBe("Nova fase");
    expect(presets.swimming_sports.vocabulary.selectLevel).toBe("Selecione a fase");
    expect(presets.swimming_sports.vocabulary.levelsTitle).toBe("Fases");
    expect(presets.swimming_sports.vocabulary.trackTitle).toBe("Trilha de fases");
  });

  it("so lutas usam 'Graduação' como titulo", () => {
    for (const preset of getAllSegmentPresets()) {
      const expected = preset.id === "martial_arts" ? "Graduação" : preset.vocabulary.levelPlural;
      expect(preset.vocabulary.levelsTitle).toBe(expected);
    }
  });
});

describe("modelos sugeridos por area", () => {
  it("todo modelo sugerido existe", () => {
    for (const preset of getAllSegmentPresets()) {
      for (const key of preset.trackTemplates) {
        expect(PROGRESSION_TEMPLATES[key]).toBeDefined();
      }
      const template = preset.progressionTemplate;
      if (template && template !== "by_modality_name") {
        expect(PROGRESSION_TEMPLATES[template]).toBeDefined();
      }
    }
  });
});

describe("novas areas: padroes de turma", () => {
  it.each([
    ["music", 60, 6],
    ["languages", 60, 10],
    ["gastronomy", 120, 12],
    ["arts_crafts", 120, 10],
    ["beauty_courses", 120, 12],
  ] as const)("%s: %i min, %i vagas", (id, durationMinutes, capacity) => {
    expect(presets[id].classDefaults).toEqual({ durationMinutes, capacity });
  });

  it("rotulos usam 'e', nunca '&'", () => {
    for (const preset of getAllSegmentPresets()) {
      expect(preset.label).not.toContain("&");
      expect(preset.examples).not.toContain("…");
    }
  });
});

describe("Outra área: como os alunos avancam", () => {
  it("sem escolha (ou 'Não avançam') fica sem trilha e fala em nivel", () => {
    for (const choice of [undefined, "none"] as const) {
      const preset = getSegmentPreset("custom", choice);
      expect(preset.id).toBe("custom");
      expect(preset.progressionTemplate).toBeNull();
      expect(preset.vocabulary.level).toBe("Nível");
      expect(segmentTrackForModality(preset, "Teatro")).toBeUndefined();
    }
  });

  it("faixas: trilha de faixas do judo e vocabulario de graduacao", () => {
    const preset = getSegmentPreset("custom", "belts");
    expect(preset.progressionTemplate).toBe("judo_karate");
    expect(preset.vocabulary.level).toBe("Faixa");
    expect(preset.vocabulary.promotion).toBe("Graduação");
    expect(preset.vocabulary.levelsTitle).toBe("Graduação");
    expect(segmentTrackForModality(preset, "Capoeira")?.templateKey).toBe("judo_karate");
  });

  it("niveis e modulos", () => {
    const levels = getSegmentPreset("custom", "levels");
    expect(levels.progressionTemplate).toBe("general_levels");
    expect(levels.vocabulary.level).toBe("Nível");
    const modules = getSegmentPreset("custom", "modules");
    expect(modules.progressionTemplate).toBe("modules");
    expect(modules.vocabulary.newLevel).toBe("Novo módulo");
  });

  it("a escolha so vale para a Outra área", () => {
    expect(getSegmentPreset("dance", "belts")).toBe(presets.dance);
  });

  it("referencia estavel (o hook nao recria o objeto a cada render)", () => {
    expect(getSegmentPreset("custom", "belts")).toBe(getSegmentPreset("custom", "belts"));
  });

  it("area desconhecida usa a escolha da Outra área", () => {
    expect(getSegmentPreset("bogus" as ClassesBusinessSegment, "modules").progressionTemplate).toBe("modules");
  });
});

describe("segmentProgressionSummary", () => {
  it.each([
    ["martial_arts", "faixas e graus"],
    ["dance", "níveis"],
    ["languages", "níveis"],
    ["music", "módulos"],
    ["swimming_sports", "fases"],
    ["pilates_yoga", null],
    ["functional_training", null],
  ] as const)("%s: %j", (id, expected) => {
    expect(segmentProgressionSummary(presets[id])).toBe(expected);
  });

  it("Outra área segue a escolha", () => {
    expect(segmentProgressionSummary(getSegmentPreset("custom", "belts"))).toBe("faixas e graus");
    expect(segmentProgressionSummary(getSegmentPreset("custom", "none"))).toBeNull();
  });
});

describe("vocabularyForTrack: palavras seguem a trilha da modalidade", () => {
  const martial = presets.martial_arts.vocabulary;
  const pilates = presets.pilates_yoga.vocabulary;
  const track = (key: keyof typeof PROGRESSION_TEMPLATES): ModalityProgressionTrack =>
    structuredClone(PROGRESSION_TEMPLATES[key].track);

  it("modelo de faixa fala em faixa e graduacao, mesmo numa area de niveis", () => {
    const v = vocabularyForTrack(track("muay_thai"), pilates);
    expect(v.level).toBe("Faixa");
    expect(v.currentLevel).toBe("Faixa atual");
    expect(v.promoteVerb).toBe("Graduar");
    expect(v.levelsTitle).toBe("Graduação");
    expect(v).toBe(martial);
  });

  it("trilha personalizada com estilo faixa tambem fala em faixa", () => {
    const custom: ModalityProgressionTrack = {
      enabled: true,
      style: "belt",
      templateKey: "custom",
      criteriaType: "attendance",
      levels: [{ id: "a", name: "Corda Crua", maxSubLevels: 0 }],
    };
    expect(vocabularyForTrack(custom, pilates).level).toBe("Faixa");
    // Sem estilo salvo: os nomes decidem (Faixa Branca = faixa).
    const legacy = { ...custom, style: undefined, levels: [{ id: "b", name: "Faixa Branca", maxSubLevels: 0 }] };
    expect(vocabularyForTrack(legacy, pilates).promoteVerb).toBe("Graduar");
  });

  it("fases da natacao: feminino e avancar", () => {
    const v = vocabularyForTrack(track("swim_stages"), martial);
    expect(v.level).toBe("Fase");
    expect(v.newLevel).toBe("Nova fase");
    expect(v.promoteVerb).toBe("Avançar");
    expect(v).toBe(presets.swimming_sports.vocabulary);
  });

  it("modulos", () => {
    const v = vocabularyForTrack(track("modules"), martial);
    expect(v.level).toBe("Módulo");
    expect(v.newLevel).toBe("Novo módulo");
    expect(v.promoteVerb).toBe("Avançar");
  });

  it("niveis gerais, idiomas e demais trilhas de niveis falam em nivel", () => {
    for (const key of ["general_levels", "language_cefr", "functional_categories"] as const) {
      const v = vocabularyForTrack(track(key), martial);
      expect(v.level).toBe("Nível");
      expect(v.currentLevel).toBe("Nível atual");
      expect(v.promoteVerb).toBe("Avançar");
      expect(v.levelsTitle).toBe("Níveis");
    }
  });

  it("sem trilha, desligada ou sem etapas = palavras da area", () => {
    expect(vocabularyForTrack(undefined, martial)).toBe(martial);
    expect(vocabularyForTrack({ ...track("general_levels"), enabled: false }, martial)).toBe(martial);
    expect(vocabularyForTrack({ ...track("bjj_adult"), levels: [] }, pilates)).toBe(pilates);
  });

  it("referencia estavel para a mesma entrada", () => {
    expect(vocabularyForTrack(track("general_levels"), martial)).toBe(
      vocabularyForTrack(track("general_levels"), martial),
    );
    expect(vocabularyForTrack(track("bjj_adult"), pilates)).toBe(vocabularyForTrack(track("judo_karate"), pilates));
  });

  it("pela modalidade: trilha salva, inferida pelo nome ou nenhuma", () => {
    expect(vocabularyForModality({ name: "Pilates", progressionTrack: track("general_levels") }, martial).level).toBe(
      "Nível",
    );
    expect(vocabularyForModality({ name: "Jiu-Jitsu" }, pilates).level).toBe("Faixa");
    expect(vocabularyForModality({ name: "Yoga" }, martial)).toBe(martial);
    expect(vocabularyForModality(undefined, pilates)).toBe(pilates);
    expect(vocabularyForModality(track("modules"), martial).level).toBe("Módulo");
  });

  it("lista: a palavra comum quando todas falam igual, senao a area", () => {
    expect(sharedVocabularyFor([track("general_levels"), track("language_cefr")], martial).level).toBe("Nível");
    expect(sharedVocabularyFor([track("general_levels"), track("bjj_adult")], pilates)).toBe(pilates);
    expect(sharedVocabularyFor([], pilates)).toBe(pilates);
    // Modalidade sem trilha nao conta.
    expect(sharedVocabularyFor([{ name: "Yoga" }, track("muay_thai")], pilates).level).toBe("Faixa");
  });
});
