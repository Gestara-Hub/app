import { describe, expect, it } from "vitest";
import { getAllSegmentPresets, getSegmentPreset } from "../business-segment-presets";
import { INSTRUCTOR_WORDS, PROFESSIONAL_WORDS, TEACHER_WORDS, teamWordsFor } from "../team-words";

describe("palavra de quem dá aula", () => {
  it("em turmas segue a área; no agendamento é profissional", () => {
    expect(teamWordsFor(true, "Instrutor")).toBe(INSTRUCTOR_WORDS);
    expect(teamWordsFor(true, "Professor")).toBe(TEACHER_WORDS);
    expect(teamWordsFor(false, "Professor")).toBe(PROFESSIONAL_WORDS);
  });

  it("guarda o singular e o plural, com maiúscula e sem", () => {
    expect(INSTRUCTOR_WORDS).toEqual({
      title: "Instrutor",
      titlePlural: "Instrutores",
      lower: "instrutor",
      lowerPlural: "instrutores",
    });
    expect(TEACHER_WORDS.lowerPlural).toBe("professores");
  });

  it("toda área define a sua palavra, e Lutas e Música seguem a decisão de 24/10", () => {
    for (const preset of getAllSegmentPresets()) expect(["Instrutor", "Professor"]).toContain(preset.teacherTitle);
    expect(getSegmentPreset("martial_arts").teacherTitle).toBe("Instrutor");
    expect(getSegmentPreset("pilates_yoga").teacherTitle).toBe("Instrutor");
    expect(getSegmentPreset("music").teacherTitle).toBe("Professor");
    expect(getSegmentPreset("languages").teacherTitle).toBe("Professor");
  });
});
