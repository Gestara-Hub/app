import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attendancePercent,
  buildCourseCertificate,
  countCourseLessons,
  defaultCertificateText,
  type CourseCertificateInput,
} from "../src/certificate.ts";

function input(over: Partial<CourseCertificateInput> = {}): CourseCertificateInput {
  return {
    enrollmentId: "enr-1",
    classGroupId: "cg-1",
    organizationName: " Ateliê Doce ",
    studentName: "Ana Souza",
    courseName: "Confeitaria",
    startDate: "2026-09-01",
    endDate: "2026-09-29",
    // Terças.
    meetingWeekdays: [2],
    presentCount: 4,
    absentCount: 1,
    instructorName: "Chef Bia",
    city: "Campinas",
    issuedOn: "2026-10-14",
    ...over,
  };
}

describe("certificado: aulas do curso", () => {
  it("conta cada encontro entre o início e o fim, inclusive", () => {
    // Terças de 01/09 a 29/09: 1, 8, 15, 22 e 29.
    assert.equal(countCourseLessons("2026-09-01", "2026-09-29", [2]), 5);
    // Terça e quinta.
    assert.equal(countCourseLessons("2026-09-01", "2026-09-30", [2, 4]), 9);
  });

  it("dois encontros no mesmo dia contam dois", () => {
    assert.equal(countCourseLessons("2026-09-01", "2026-09-08", [2, 2]), 4);
  });

  it("oficina de um dia conta 1; fim antes do início ou sem encontros conta 0", () => {
    assert.equal(countCourseLessons("2026-09-05", "2026-09-05", [6]), 1);
    assert.equal(countCourseLessons("2026-09-05", "2026-09-04", [6]), 0);
    assert.equal(countCourseLessons("2026-09-01", "2026-09-30", []), 0);
  });
});

describe("certificado: frequência", () => {
  it("presenças / (presenças + faltas), arredondada", () => {
    assert.equal(attendancePercent(2, 1), 67);
    assert.equal(attendancePercent(8, 0), 100);
    assert.equal(attendancePercent(0, 3), 0);
  });

  it("sem chamada é null", () => {
    assert.equal(attendancePercent(0, 0), null);
  });
});

describe("certificado: dados e texto padrão", () => {
  it("monta os dados com as aulas e a frequência", () => {
    const cert = buildCourseCertificate(input());
    assert.deepEqual(cert, {
      enrollmentId: "enr-1",
      classGroupId: "cg-1",
      organizationName: "Ateliê Doce",
      studentName: "Ana Souza",
      courseName: "Confeitaria",
      startDate: "2026-09-01",
      endDate: "2026-09-29",
      lessonsCount: 5,
      attendancePercent: 80,
      instructorName: "Chef Bia",
      city: "Campinas",
      issuedOn: "2026-10-14",
    });
  });

  it("texto com período, aulas, frequência, cidade e data por extenso", () => {
    assert.deepEqual(defaultCertificateText(buildCourseCertificate(input())), {
      title: "Certificado de conclusão",
      body: "Certificamos que Ana Souza concluiu o curso Confeitaria, de 01/09/2026 a 29/09/2026, com 5 aulas e frequência de 80%.",
      placeAndDate: "Campinas, 14 de outubro de 2026",
    });
  });

  it("sem chamada, sem cidade e de um dia só", () => {
    const cert = buildCourseCertificate(
      input({ startDate: "2026-09-05", endDate: "2026-09-05", meetingWeekdays: [6], presentCount: 0, absentCount: 0, city: "  " }),
    );
    assert.equal(cert.city, undefined);
    assert.deepEqual(defaultCertificateText(cert), {
      title: "Certificado de conclusão",
      body: "Certificamos que Ana Souza concluiu o curso Confeitaria, em 05/09/2026, com 1 aula.",
      placeAndDate: "14 de outubro de 2026",
    });
  });
});
