import type { AttendanceStatus, ClassGroupView, SaveCertificateTemplate } from "@gestarahub/contracts";
import { CERTIFICATE_CODE_RE, defaultCertificateTemplate, renderCertificate } from "@gestarahub/core/certificate";
import { beforeEach, describe, expect, it } from "vitest";
import { getFileBlob } from "@/mocks/file-blobs";
import { store } from "@/mocks/store";
import { certificatesService } from "@/services/settings/certificatesService";
import { turmasService } from "@/services/classes";
import { createInstructor, createStudent, resetAcademy, sessionIdOf } from "@/test/academy";

/**
 * Certificado de conclusao do curso (doc 20, fase D): recurso pago
 * (`certificates`, Pro e Scale), so para matricula ativa em curso terminado.
 * Hoje congelado em 22/09/2026 (terca).
 */

async function courseClass(): Promise<ClassGroupView> {
  const teacher = await createInstructor("Chef Bia");
  return turmasService.create({
    name: "Confeitaria",
    modalityId: teacher.modalityIds?.[0] ?? "",
    instructorId: teacher.id,
    capacity: 10,
    allowDropin: false,
    // Segundas de 03/08 a 21/09: 8 aulas.
    meetingSlots: [{ weekday: 1, start: "19:00", end: "21:00" }],
    startDate: "2026-08-03",
    endDate: "2026-12-14",
    billingMode: "course",
    coursePriceCents: 80000,
    courseMaxInstallments: 1,
    status: "active",
  });
}

/** Matricula no curso e encerra o curso ontem (21/09). */
async function completedEnrollment() {
  const g = await courseClass();
  const student = await createStudent("Rui Lima");
  const enrollment = await turmasService.enroll({
    classGroupId: g.id,
    studentId: student.id,
    course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
  });
  await turmasService.update(g.id, { endDate: "2026-09-21" });
  return { g, student, enrollment };
}

function mark(classGroupId: string, studentId: string, date: string, status: AttendanceStatus) {
  store.attendances.push({
    id: `att-${date}-${studentId}`,
    sessionId: sessionIdOf(classGroupId, date, "19:00"),
    studentId,
    status,
    markedAt: `${date}T22:00:00.000Z`,
  });
}

function setTier(tier: "free" | "pro" | "scale") {
  store.organization.subscription = { tier };
}

describe("certificado de conclusão", () => {
  beforeEach(() => resetAcademy());

  it("é do Plano Profissional: o grátis recebe FEATURE_NOT_IN_PLAN", async () => {
    const { enrollment } = await completedEnrollment();
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
      httpStatus: 403,
      message: "Certificado de conclusão está disponível no Plano Profissional.",
    });
  });

  it("Pro e Scale geram o certificado com aulas, frequência, instrutor e cidade", async () => {
    const { g, student, enrollment } = await completedEnrollment();
    mark(g.id, student.id, "2026-09-07", "present");
    mark(g.id, student.id, "2026-09-14", "present");
    mark(g.id, student.id, "2026-09-21", "absent");
    mark(g.id, student.id, "2026-09-21", "justified");
    store.unit.address = {
      postalCode: "01000-000",
      street: "Rua A",
      number: "1",
      neighborhood: "Centro",
      city: "Campinas",
      state: "SP",
    };
    for (const tier of ["pro", "scale"] as const) {
      setTier(tier);
      const { certificate } = await turmasService.getCourseCertificate(enrollment.id);
      expect(certificate).toMatchObject({
        enrollmentId: enrollment.id,
        classGroupId: g.id,
        organizationName: "Academia X",
        studentName: "Rui Lima",
        courseName: "Confeitaria",
        startDate: "2026-08-03",
        endDate: "2026-09-21",
        lessonsCount: 8,
        // 8 aulas de 2h.
        workloadMinutes: 960,
        attendancePercent: 67,
        instructorName: "Chef Bia",
        city: "Campinas",
        issuedOn: "2026-09-22",
      });
    }
  });

  it("curso ainda em andamento não tem certificado", async () => {
    setTier("pro");
    const g = await courseClass();
    const student = await createStudent("Ana");
    const enrollment = await turmasService.enroll({
      classGroupId: g.id,
      studentId: student.id,
      course: { priceCents: 80000, installments: 1, firstDueDate: "2026-09-22" },
    });
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "O certificado sai quando o curso termina.",
    });
  });

  it("matrícula cancelada ou inexistente não tem certificado", async () => {
    setTier("pro");
    const { enrollment } = await completedEnrollment();
    await turmasService.cancelEnrollment(enrollment.id);
    await expect(turmasService.getCourseCertificate(enrollment.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(turmasService.getCourseCertificate("enr-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sem chamada, a frequência fica de fora (null)", async () => {
    setTier("pro");
    const { enrollment } = await completedEnrollment();
    const { certificate: cert } = await turmasService.getCourseCertificate(enrollment.id);
    expect(cert.attendancePercent).toBeNull();
    expect("city" in cert).toBe(false);
  });
});

/** Modelo de certificado do espaco (doc 21, secao 1): Plano Profissional, um por organizacao. */
function customTemplate(over: Partial<SaveCertificateTemplate> = {}): SaveCertificateTemplate {
  return {
    layout: "modern",
    accentColor: "navy",
    title: "  Certificado de {curso}  ",
    body: "{aluno} concluiu {curso} com {carga_horaria}. Frequência de {frequencia}.",
    signatures: [{ name: " Maria Lima ", role: " Diretora " }],
    showAttendance: true,
    ...over,
  };
}

const imageFile = (sizeBytes: number, type = "image/png", name = "logo.png") =>
  new File([new Uint8Array(sizeBytes)], name, { type });

describe("modelo de certificado", () => {
  beforeEach(() => resetAcademy());

  it("sem modelo salvo vale o padrão (que reproduz o texto da fase D)", async () => {
    const template = await certificatesService.getTemplate();
    expect(template).toEqual(defaultCertificateTemplate());
    expect("updatedAt" in template).toBe(false);
  });

  it("salvar e restaurar são do Plano Profissional: o grátis recebe FEATURE_NOT_IN_PLAN", async () => {
    await expect(certificatesService.saveTemplate(customTemplate())).rejects.toMatchObject({
      code: "FEATURE_NOT_IN_PLAN",
      httpStatus: 403,
      message: "Certificado de conclusão está disponível no Plano Profissional.",
    });
    await expect(certificatesService.resetTemplate()).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
    await expect(certificatesService.uploadLogo(imageFile(10))).rejects.toMatchObject({ code: "FEATURE_NOT_IN_PLAN" });
    expect(store.certificateTemplate).toBeUndefined();
  });

  it("salva sem espaços nas pontas, devolve o mesmo na leitura e audita", async () => {
    setTier("pro");
    const saved = await certificatesService.saveTemplate(customTemplate());
    expect(saved).toMatchObject({
      layout: "modern",
      accentColor: "navy",
      title: "Certificado de {curso}",
      signatures: [{ name: "Maria Lima", role: "Diretora" }],
      showAttendance: true,
      updatedAt: expect.any(String),
    });
    expect(await certificatesService.getTemplate()).toEqual(saved);
    expect(store.auditLog.at(-1)?.summary).toBe("Ana Ribeiro atualizou o modelo de certificado");
  });

  it("recusa título, texto, assinaturas e variáveis fora das regras", async () => {
    setTier("pro");
    const fieldsOf = async (over: Partial<SaveCertificateTemplate>) => {
      try {
        await certificatesService.saveTemplate(customTemplate(over));
        return [];
      } catch (error) {
        expect(error).toMatchObject({ code: "VALIDATION" });
        return (error as { fields: { field: string }[] }).fields.map((f) => f.field);
      }
    };
    expect(await fieldsOf({ title: "   " })).toEqual(["title"]);
    expect(await fieldsOf({ title: "x".repeat(61) })).toEqual(["title"]);
    expect(await fieldsOf({ body: "" })).toEqual(["body"]);
    expect(await fieldsOf({ body: "x".repeat(601) })).toEqual(["body"]);
    expect(await fieldsOf({ signatures: [] })).toEqual(["signatures"]);
    expect(
      await fieldsOf({
        signatures: [
          { name: "A", role: "" },
          { name: "B", role: "" },
          { name: "C", role: "" },
        ],
      }),
    ).toEqual(["signatures"]);
    expect(await fieldsOf({ signatures: [{ name: "x".repeat(61), role: "y".repeat(61) }] })).toEqual([
      "signatures.0.name",
      "signatures.0.role",
    ]);
    expect(await fieldsOf({ title: "Certificado {nota}" })).toEqual(["title"]);
    expect(store.certificateTemplate).toBeUndefined();

    await expect(certificatesService.saveTemplate(customTemplate({ body: "Nota {nota} de {aluno}." }))).rejects.toMatchObject({
      fields: [{ field: "body", message: expect.stringMatching(/^Variável desconhecida: \{nota\}\. Use: \{aluno\}, \{curso\}, \{inicio\}/) }],
    });
  });

  it("restaurar padrão apaga o modelo salvo e audita", async () => {
    setTier("pro");
    await certificatesService.saveTemplate(customTemplate());
    expect(await certificatesService.resetTemplate()).toEqual(defaultCertificateTemplate());
    expect(store.certificateTemplate).toBeUndefined();
    expect(store.auditLog.at(-1)?.summary).toBe("Ana Ribeiro restaurou o modelo de certificado padrão");
  });

  it("logo: só imagem de até 1 MB; o modelo guarda o id do arquivo", async () => {
    setTier("pro");
    await expect(certificatesService.uploadLogo(imageFile(10, "application/pdf", "logo.pdf"))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "logo", message: "“logo.pdf”: Formato não aceito (use imagem)." }],
    });
    await expect(certificatesService.uploadLogo(imageFile(1024 * 1024 + 1))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "logo", message: "“logo.png”: Arquivo maior que 1 MB." }],
    });
    const logo = await certificatesService.uploadLogo(imageFile(1024 * 1024));
    expect(logo).toMatchObject({ name: "logo.png", contentType: "image/png", sizeBytes: 1024 * 1024 });
    expect(await getFileBlob(logo.id)).toBeDefined();
    const saved = await certificatesService.saveTemplate(customTemplate({ logoFileId: logo.id }));
    expect(saved.logoFileId).toBe(logo.id);
    // Salvar sem `logoFileId` tira a logo.
    expect("logoFileId" in (await certificatesService.saveTemplate(customTemplate()))).toBe(false);
  });

  it("Minha arte: PNG ou JPG até 2 MB; o modelo guarda a arte só nesse layout", async () => {
    setTier("pro");
    await expect(certificatesService.uploadArtwork(imageFile(10, "image/gif", "arte.gif"))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "artwork", message: "“arte.gif”: Formato não aceito (use PNG ou JPG)." }],
    });
    await expect(certificatesService.uploadArtwork(imageFile(2 * 1024 * 1024 + 1, "image/jpeg", "arte.jpg"))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "artwork", message: "“arte.jpg”: Arquivo maior que 2 MB." }],
    });
    const art = await certificatesService.uploadArtwork(imageFile(2 * 1024 * 1024, "image/jpeg", "arte.jpg"));
    expect(await getFileBlob(art.id)).toBeDefined();

    // Sem a arte, o layout nao vale.
    await expect(certificatesService.saveTemplate(customTemplate({ layout: "custom" }))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: [{ field: "artwork", message: "Envie a arte de fundo." }],
    });
    const artwork = { fileId: art.id, textPosition: "bottom" as const, ink: "light" as const, hidden: ["title" as const, "logo" as const, "logo" as const] };
    const saved = await certificatesService.saveTemplate(customTemplate({ layout: "custom", artwork }));
    expect(saved.artwork).toEqual({ ...artwork, hidden: ["title", "logo"] });
    // Em outro layout a arte e esquecida.
    const modern = await certificatesService.saveTemplate(customTemplate({ layout: "modern", artwork }));
    expect("artwork" in modern).toBe(false);
  });

  it("modelo por modalidade: vale nos cursos dela; sem o proprio, o do espaco", async () => {
    setTier("pro");
    const { g, enrollment } = await completedEnrollment();
    const modalityId = String(g.modalityId);
    await certificatesService.saveTemplate(customTemplate({ title: "Do espaço" }));
    expect((await turmasService.getCourseCertificate(enrollment.id)).template.title).toBe("Do espaço");
    expect(await certificatesService.getTemplate(modalityId)).toMatchObject({ title: "Do espaço", own: false });
    expect(await certificatesService.listModalitiesWithOwnTemplate()).toEqual([]);

    const own = await certificatesService.saveTemplate(customTemplate({ title: "Da modalidade" }), modalityId);
    expect(own.title).toBe("Da modalidade");
    expect(store.categories.find((c) => c.id === modalityId)?.certificateTemplate?.title).toBe("Da modalidade");
    expect(store.certificateTemplate?.title).toBe("Do espaço");
    expect(await certificatesService.listModalitiesWithOwnTemplate()).toEqual([modalityId]);
    expect((await turmasService.getCourseCertificate(enrollment.id)).template.title).toBe("Da modalidade");
    expect(store.auditLog.at(-1)?.summary).toContain("atualizou o modelo de certificado de ");

    expect((await certificatesService.removeModalityTemplate(modalityId)).title).toBe("Do espaço");
    expect((await turmasService.getCourseCertificate(enrollment.id)).template.title).toBe("Do espaço");
    await expect(certificatesService.saveTemplate(customTemplate(), "m-nao-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("abrir emite uma vez: código fixo, dados congelados, e cancelar marca o registro", async () => {
    setTier("pro");
    const { g, student, enrollment } = await completedEnrollment();
    mark(g.id, student.id, "2026-09-14", "present");
    const first = await turmasService.getCourseCertificate(enrollment.id);
    expect(first.issued.status).toBe("valid");
    expect(first.issued.code).toMatch(CERTIFICATE_CODE_RE);
    expect(first.certificate.verificationCode).toBe(first.issued.code);
    expect(store.issuedCertificates).toHaveLength(1);
    expect(store.auditLog.at(-1)?.summary).toContain(`emitiu o certificado de ${student.name}`);

    // De novo: o mesmo codigo, sem novo registro, e os dados do momento da emissao.
    mark(g.id, student.id, "2026-09-21", "absent");
    const again = await turmasService.getCourseCertificate(enrollment.id);
    expect(again.issued.code).toBe(first.issued.code);
    expect(again.certificate.attendancePercent).toBe(first.certificate.attendancePercent);
    expect(store.issuedCertificates).toHaveLength(1);

    const canceled = await turmasService.cancelCertificate(enrollment.id, "Nome errado");
    expect(canceled).toMatchObject({ code: first.issued.code, status: "canceled" });
    expect(store.issuedCertificates?.[0]).toMatchObject({ status: "canceled", cancelReason: "Nome errado" });
    expect((await turmasService.getCourseCertificate(enrollment.id)).issued.status).toBe("canceled");
    await expect(turmasService.cancelCertificate("enr-nao-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("o certificado do aluno vem com o modelo do espaco", async () => {
    setTier("pro");
    const { g, student, enrollment } = await completedEnrollment();
    mark(g.id, student.id, "2026-09-14", "present");
    const before = await turmasService.getCourseCertificate(enrollment.id);
    expect(before.template).toEqual(defaultCertificateTemplate());

    await certificatesService.saveTemplate(customTemplate({ showAttendance: false }));
    const { certificate, template } = await turmasService.getCourseCertificate(enrollment.id);
    expect(template).toMatchObject({ layout: "modern", accentColor: "navy", showAttendance: false });
    expect(renderCertificate(certificate, template)).toMatchObject({
      title: "Certificado de Confeitaria",
      // Frequência desligada: a frase dela sai.
      body: "Rui Lima concluiu Confeitaria com 16 horas.",
      signatures: [{ name: "Maria Lima", role: "Diretora" }],
    });
  });
});
