import { describe, expect, it } from "vitest";
import { SERVICE_NAMESPACES } from "../registry";

/**
 * Permissao de cada metodo que grava (auditoria de 30/10/2026): no servidor,
 * metodo sem permissao no registro e liberado para qualquer membro logado. Todo
 * metodo que grava (`writeOp`) declara permissao, ou fica nesta lista de quem se
 * protege por dentro (com o motivo). Metodo novo sem nenhum dos dois reprova.
 */
const SELF_CHECKED: Record<string, string> = {
  // Evolucao: assertCanManageProgression (permissao progression:manage e recorte do professor).
  "clients.saveModalityProgression": "assertCanManageProgression",
  "clients.promoteStudent": "assertCanManageProgression",
  // Graduar varios (doc product/30 §3): confere cada aluno.
  "clients.promoteStudents": "assertCanManageProgression",
  "clients.addClassRecord": "assertCanManageProgression",
  "clients.addClassRecords": "assertCanManageProgression",
  "clients.updateStrengths": "assertCanManageProgression",
  "clients.addGoal": "assertCanManageProgression",
  "clients.setGoalCompleted": "assertCanManageProgression",
  "clients.removeGoal": "assertCanManageProgression",
  // Certificado de graduacao (doc 21 §1.6): abrir emite; quem gere a evolucao emite e cancela.
  "clients.getGraduationCertificate": "assertCanManageProgression",
  "clients.cancelGraduationCertificate": "assertCanManageProgression",
  // Abrir o certificado emite (doc 21 §1.3): quem ve a turma emite, e o professor so a dele
  // (`endedCourseOf` chama assertTeacherSeesClass e confere o plano e o fim do curso).
  "turmas.getCourseCertificate": "endedCourseOf",
  "turmas.issueCourseCertificates": "endedCourseOf",
};

describe("permissão dos métodos que gravam", () => {
  it("todo método que grava declara permissão ou se protege por dentro", async () => {
    const missing: string[] = [];
    for (const [namespace, entry] of Object.entries(SERVICE_NAMESPACES)) {
      const service = await entry.load();
      for (const [method, fn] of Object.entries(service)) {
        if (typeof fn !== "function" || entry.browserOnly?.includes(method)) continue;
        const name = `${namespace}.${method}`;
        const writes = /writeOp\b/.test(String(fn));
        if (!writes || (entry.permissions[method] ?? []).length > 0) continue;
        if (SELF_CHECKED[name]) {
          expect(String(fn), `${name} devia chamar ${SELF_CHECKED[name]}`).toContain(SELF_CHECKED[name]);
          continue;
        }
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
});
