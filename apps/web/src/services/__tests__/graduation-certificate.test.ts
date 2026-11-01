import { beforeEach, describe, expect, it } from "vitest";
import { CERTIFICATE_CODE_RE, defaultGraduationCertificateTemplate, renderCertificate } from "@gestarahub/core/certificate";
import { store } from "@/mocks/store";
import { categoriesService } from "@/services/catalog/categoriesService";
import { clientsService } from "@/services/clients";
import { certificatesService } from "@/services/settings/certificatesService";
import { createStudent, resetAcademy } from "@/test/academy";

/**
 * Certificado de graduacao (doc 21 §1.6): nasce do registro de graduacao do
 * aluno, com codigo de verificacao proprio; modelo de graduacao do espaco ou da
 * modalidade; cancelar marca o registro.
 */

async function graduatedStudent() {
  const bjj = (await categoriesService.create({ name: "Jiu-Jitsu" })).id;
  const student = await createStudent("Ana Souza");
  const client = await clientsService.promoteStudent({
    studentId: student.id,
    modalityId: bjj,
    toLevelName: "Faixa Azul",
    toLevelColor: "blue",
    toSubLevel: 2,
    date: "2026-09-12",
    isExam: true,
    examiner: "Mestre Léo",
  });
  const promotionId = client.progressions![bjj].promotionHistory[0].id;
  return { bjj, student, promotionId };
}

describe("certificado de graduação", () => {
  beforeEach(() => {
    resetAcademy();
    store.organization.subscription = { tier: "pro" };
  });

  it("abrir emite uma vez, com código, dados do registro e modelo da área", async () => {
    const { student, promotionId } = await graduatedStudent();
    const doc = await clientsService.getGraduationCertificate(student.id, promotionId);
    expect(doc.issued.code).toMatch(CERTIFICATE_CODE_RE);
    expect(doc.issued.status).toBe("valid");
    expect(doc.certificate).toMatchObject({
      promotionId,
      studentName: "Ana Souza",
      modalityName: "Jiu-Jitsu",
      levelName: "Faixa Azul",
      degree: "2º grau",
      graduatedOn: "2026-09-12",
      instructorName: "Mestre Léo",
      verificationCode: doc.issued.code,
    });
    expect(doc.template.body).toBe(defaultGraduationCertificateTemplate().body);
    const text = renderCertificate(doc.certificate, doc.template);
    expect(text.body).toContain("Ana Souza alcançou Faixa Azul em Jiu-Jitsu, em 12 de setembro de 2026, por avaliação de Mestre Léo.");

    // Abrir de novo nao emite outra vez; o registro guarda o tipo e o aluno.
    const again = await clientsService.getGraduationCertificate(student.id, promotionId);
    expect(again.issued.code).toBe(doc.issued.code);
    expect(store.issuedCertificates).toHaveLength(1);
    expect(store.issuedCertificates![0]).toMatchObject({ kind: "graduation", promotionId, studentId: student.id });
    expect(store.issuedCertificates![0].enrollmentId).toBeUndefined();
    expect(store.auditLog.map((e) => e.summary).filter((s) => s.includes("emitiu o certificado de graduação"))).toHaveLength(1);
  });

  it("registro que não existe e plano sem o recurso", async () => {
    const { student, promotionId } = await graduatedStudent();
    await expect(clientsService.getGraduationCertificate(student.id, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    store.organization.subscription = { tier: "free" };
    await expect(clientsService.getGraduationCertificate(student.id, promotionId)).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
    expect(store.issuedCertificates ?? []).toHaveLength(0);
  });

  it("modelo de graduação é separado do de curso, do espaço ou da modalidade", async () => {
    const { bjj, student, promotionId } = await graduatedStudent();
    const course = await certificatesService.getTemplate();
    const graduation = await certificatesService.getTemplate(undefined, "graduation");
    expect(graduation.body).not.toBe(course.body);
    await certificatesService.saveTemplate({ ...graduation, title: "Diploma de faixa" }, undefined, "graduation");
    expect((await certificatesService.getTemplate()).title).toBe(course.title);
    expect((await clientsService.getGraduationCertificate(student.id, promotionId)).template.title).toBe("Diploma de faixa");
    // Modelo so da modalidade, e a volta ao do espaco.
    await certificatesService.saveTemplate({ ...graduation, title: "Diploma de Jiu-Jitsu" }, bjj, "graduation");
    expect(await certificatesService.listModalitiesWithOwnTemplate("graduation")).toEqual([bjj]);
    expect(await certificatesService.listModalitiesWithOwnTemplate()).toEqual([]);
    expect((await clientsService.getGraduationCertificate(student.id, promotionId)).template.title).toBe("Diploma de Jiu-Jitsu");
    await certificatesService.removeModalityTemplate(bjj, "graduation");
    expect((await clientsService.getGraduationCertificate(student.id, promotionId)).template.title).toBe("Diploma de faixa");
    // Variavel de curso nao vale no modelo de graduacao.
    await expect(certificatesService.saveTemplate({ ...graduation, body: "Curso {curso}." }, undefined, "graduation")).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "body" }],
    });
  });

  it("lista as graduações para a prévia, dá a prévia sem emitir e cancela", async () => {
    const { student, promotionId } = await graduatedStudent();
    const options = await clientsService.listGraduations();
    expect(options).toEqual([
      expect.objectContaining({ promotionId, studentId: student.id, studentName: "Ana Souza", modalityName: "Jiu-Jitsu", levelName: "Faixa Azul", graduatedOn: "2026-09-12" }),
    ]);
    const preview = await clientsService.previewGraduationCertificate(student.id, promotionId);
    expect(preview.verificationCode).toBe("GH-7K3M-2A9F");
    expect(store.issuedCertificates ?? []).toHaveLength(0);

    await clientsService.getGraduationCertificate(student.id, promotionId);
    const canceled = await clientsService.cancelGraduationCertificate(student.id, promotionId, "errado");
    expect(canceled.status).toBe("canceled");
    expect((await clientsService.getGraduationCertificate(student.id, promotionId)).issued.status).toBe("canceled");
    expect(store.auditLog.map((e) => e.summary).some((s) => s.includes("cancelou o certificado de graduação"))).toBe(true);
  });
});
