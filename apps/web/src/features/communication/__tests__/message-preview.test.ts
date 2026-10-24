import { describe, expect, it } from "vitest";
import { fillMessage } from "@/lib/whatsapp";
import { sampleValues, templatePreview } from "../message-meta";

describe("prévia dos modelos de mensagem (achado 8)", () => {
  it("o exemplo da cobrança serve a qualquer área, sem curso de confeitaria", () => {
    expect(sampleValues("Academia Fênix").referencia).toBe("mensalidade de novembro");
  });

  it("o aviso de mudança de horário mostra um horário de exemplo na prévia", () => {
    const filled = fillMessage("Oi, {aluno}! Aviso de {empresa}: sua turma vai mudar de horário. Novo horário:", sampleValues("Academia Fênix"));
    expect(templatePreview("schedule_change", filled)).toMatch(/Novo horário: Terças e quintas, 19h às 20h\.$/);
    expect(templatePreview("welcome_student", "Oi")).toBe("Oi");
  });
});
