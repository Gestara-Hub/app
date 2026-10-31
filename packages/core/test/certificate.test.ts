import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attendancePercent,
  buildCourseCertificate,
  CERTIFICATE_VARIABLES,
  countCourseLessons,
  countCourseWorkloadMinutes,
  defaultCertificateTemplate,
  defaultCertificateText,
  fillCertificateText,
  formatWorkload,
  renderCertificate,
  unknownCertificateVariables,
  validateCertificateTemplate,
  newCertificateCode,
  normalizeCertificateCode,
  CERTIFICATE_CODE_RE,
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
    // Terças, das 19h às 21h.
    meetingSlots: [{ weekday: 2, start: "19:00", end: "21:00" }],
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
      workloadMinutes: 600,
      attendancePercent: 80,
      instructorName: "Chef Bia",
      city: "Campinas",
      issuedOn: "2026-10-14",
    });
  });

  it("texto com período, aulas, frequência, cidade e data por extenso", () => {
    assert.deepEqual(defaultCertificateText(buildCourseCertificate(input())), {
      title: "Certificado de conclusão",
      body: "Certificamos que Ana Souza concluiu o curso Confeitaria, de 01/09/2026 a 29/09/2026, que teve 5 aulas, com frequência de 80%.",
      placeAndDate: "Campinas, 14 de outubro de 2026",
    });
  });

  it("sem chamada, sem cidade e de um dia só", () => {
    const cert = buildCourseCertificate(
      input({
        startDate: "2026-09-05",
        endDate: "2026-09-05",
        meetingSlots: [{ weekday: 6, start: "09:00", end: "12:00" }],
        presentCount: 0,
        absentCount: 0,
        city: "  ",
      }),
    );
    assert.equal(cert.city, undefined);
    assert.deepEqual(defaultCertificateText(cert), {
      title: "Certificado de conclusão",
      body: "Certificamos que Ana Souza concluiu o curso Confeitaria, em 05/09/2026, que teve 1 aula.",
      placeAndDate: "14 de outubro de 2026",
    });
  });
});

describe("certificado: carga horária", () => {
  it("soma a duração de cada aula do curso", () => {
    // Terças 2h (5 aulas) + quintas 1h30 (4 aulas) em setembro.
    const slots = [
      { weekday: 2, start: "19:00", end: "21:00" },
      { weekday: 4, start: "19:00", end: "20:30" },
    ];
    assert.equal(countCourseWorkloadMinutes("2026-09-01", "2026-09-30", slots), 5 * 120 + 4 * 90);
    assert.equal(countCourseWorkloadMinutes("2026-09-05", "2026-09-04", slots), 0);
  });

  it("formata em horas, horas e minutos ou só minutos", () => {
    assert.equal(formatWorkload(16 * 60), "16 horas");
    assert.equal(formatWorkload(60), "1 hora");
    assert.equal(formatWorkload(12 * 60 + 30), "12h30");
    assert.equal(formatWorkload(65), "1h05");
    assert.equal(formatWorkload(45), "45 minutos");
    assert.equal(formatWorkload(0), "");
  });
});

describe("certificado: variáveis do modelo", () => {
  const values = { aluno: "Ana Souza", curso: "Confeitaria", aulas: "8 aulas", frequencia: "92%" };

  it("troca as variáveis pelos valores", () => {
    assert.equal(
      fillCertificateText("{aluno} concluiu {curso} com {aulas}.", values),
      "Ana Souza concluiu Confeitaria com 8 aulas.",
    );
  });

  it("frase sem valor sai inteira; as outras ficam", () => {
    assert.equal(
      fillCertificateText("Parabéns, {aluno}! Realizado em {cidade}. Até breve.", values),
      "Parabéns, Ana Souza! Até breve.",
    );
    assert.equal(fillCertificateText("Realizado em {cidade}.", values), "");
  });

  it("trecho sem valor no fim ou no meio sai só ele", () => {
    assert.equal(
      fillCertificateText("Concluiu {curso}, com {aulas} e frequência de {frequencia}.", { ...values, frequencia: undefined }),
      "Concluiu Confeitaria, com 8 aulas.",
    );
    assert.equal(
      fillCertificateText("Concluiu {curso}, com carga de {carga_horaria}, e frequência de {frequencia}.", values),
      "Concluiu Confeitaria, e frequência de 92%.",
    );
  });

  it("variável desconhecida conta como sem valor e é listada", () => {
    assert.equal(fillCertificateText("Olá {nome}. Fim.", values), "Fim.");
    assert.deepEqual(unknownCertificateVariables("{aluno} {nome} {nota} {nome}"), ["nome", "nota"]);
    assert.deepEqual(unknownCertificateVariables(`{${CERTIFICATE_VARIABLES.join("} {")}}`), []);
  });

  it("valor com chaves não vira variável", () => {
    assert.equal(fillCertificateText("Aluno: {aluno}.", { aluno: "{curso}" }), "Aluno: {curso}.");
  });

  it("curso de um dia: 'de {inicio} a {fim}' vira 'em {inicio}'", () => {
    assert.equal(
      fillCertificateText("De {inicio} a {fim}, curso de {inicio} a {fim}.", { inicio: "05/09/2026", fim: "05/09/2026" }, { sameDay: true }),
      "Em 05/09/2026, curso em 05/09/2026.",
    );
  });

  it("modelo com todas as variáveis, frequência escondida e assinaturas", () => {
    const cert = buildCourseCertificate(input());
    const rendered = renderCertificate(cert, {
      title: "Certificado de {curso}",
      body: "{aluno} fez {curso} ({inicio} a {fim}), {aulas}, {carga_horaria}. Frequência de {frequencia}. {cidade}, {data}. Por {professor}, {empresa}.",
      signatures: [{ name: "{professor}", role: " Chef " }],
      showAttendance: false,
    });
    assert.deepEqual(rendered, {
      title: "Certificado de Confeitaria",
      body: "Ana Souza fez Confeitaria (01/09/2026 a 29/09/2026), 5 aulas, 10 horas. Campinas, 14 de outubro de 2026. Por Chef Bia, Ateliê Doce.",
      placeAndDate: "Campinas, 14 de outubro de 2026",
      signatures: [{ name: "Chef Bia", role: "Chef" }],
    });
  });

  it("o modelo padrão traz as duas assinaturas da fase D", () => {
    const rendered = renderCertificate(buildCourseCertificate(input()), defaultCertificateTemplate());
    assert.deepEqual(rendered.signatures, [
      { name: "Chef Bia", role: "Instrutor" },
      { name: "Ateliê Doce", role: "Responsável" },
    ]);
  });
});

describe("certificado: validação do modelo", () => {
  it("o padrão é válido", () => {
    assert.deepEqual(validateCertificateTemplate(defaultCertificateTemplate()), []);
  });

  it("recusa título, texto e assinaturas fora das regras", () => {
    const base = defaultCertificateTemplate();
    const fields = (over: Partial<typeof base>) =>
      validateCertificateTemplate({ ...base, ...over }).map((issue) => issue.field);
    assert.deepEqual(fields({ title: "  " }), ["title"]);
    assert.deepEqual(fields({ title: "x".repeat(61) }), ["title"]);
    assert.deepEqual(fields({ body: "" }), ["body"]);
    assert.deepEqual(fields({ body: "x".repeat(601) }), ["body"]);
    assert.deepEqual(fields({ signatures: [] }), ["signatures"]);
    assert.deepEqual(fields({ signatures: [...base.signatures, { name: "C", role: "" }] }), ["signatures"]);
    assert.deepEqual(fields({ signatures: [{ name: " ", role: "x".repeat(61) }] }), ["signatures.0.name", "signatures.0.role"]);
    assert.deepEqual(fields({ layout: "kids" as never, accentColor: "pink" as never }), ["layout", "accentColor"]);
  });

  it("Minha arte: exige a imagem, ajustes conhecidos e pelo menos título ou texto", () => {
    const base = { ...defaultCertificateTemplate(), layout: "custom" as const };
    const fields = (artwork: unknown) =>
      validateCertificateTemplate({ ...base, artwork: artwork as never }).map((issue) => issue.field);
    assert.deepEqual(fields(undefined), ["artwork"]);
    assert.deepEqual(fields({ fileId: " ", textPosition: "center", ink: "dark", hidden: [] }), ["artwork"]);
    assert.deepEqual(fields({ fileId: "f-1", textPosition: "center", ink: "dark", hidden: [] }), []);
    assert.deepEqual(fields({ fileId: "f-1", textPosition: "middle", ink: "neon", hidden: ["logo"] }), [
      "artwork.textPosition",
      "artwork.ink",
    ]);
    assert.deepEqual(fields({ fileId: "f-1", textPosition: "top", ink: "light", hidden: ["qr"] }), ["artwork.hidden"]);
    assert.deepEqual(fields({ fileId: "f-1", textPosition: "top", ink: "light", hidden: ["title", "body"] }), ["artwork.hidden"]);
    // Nos outros layouts a arte nao e conferida.
    assert.deepEqual(validateCertificateTemplate({ ...defaultCertificateTemplate(), artwork: { fileId: "" } as never }), []);
  });

  it("variável desconhecida vem com a lista das válidas", () => {
    const [issue] = validateCertificateTemplate({ ...defaultCertificateTemplate(), body: "Nota {nota} de {aluno}." });
    assert.equal(issue.field, "body");
    assert.match(issue.message, /^Variável desconhecida: \{nota\}\. Use: \{aluno\}, \{curso\}, .*\{data\}\.$/);
  });
});

describe("certificado: nome do curso que já diz \"curso\" (achado 48)", () => {
  it("não repete a palavra no texto padrão", () => {
    const text = defaultCertificateText(buildCourseCertificate(input({ courseName: "Yoga Flow curso" })));
    assert.match(text.body, /concluiu o Yoga Flow curso, de /);
    assert.doesNotMatch(text.body, /curso Yoga Flow curso/);
  });

  it("nome sem a palavra continua com \"o curso\"", () => {
    const text = defaultCertificateText(buildCourseCertificate(input({ courseName: "Confeitaria" })));
    assert.match(text.body, /concluiu o curso Confeitaria, de /);
  });
});

describe("certificado: código de verificação", () => {
  it("gera GH-XXXX-XXXX sem 0, O, 1 e I, sempre diferente", () => {
    const codes = new Set(Array.from({ length: 200 }, () => newCertificateCode()));
    assert.equal(codes.size, 200);
    for (const code of codes) assert.match(code, CERTIFICATE_CODE_RE);
  });

  it("aceita o código como a pessoa digita e recusa o que não é código", () => {
    assert.equal(normalizeCertificateCode(" gh-7k3m-2a9f "), "GH-7K3M-2A9F");
    assert.equal(normalizeCertificateCode("7K3M2A9F"), "GH-7K3M-2A9F");
    assert.equal(normalizeCertificateCode("GH 7K3M 2A9F"), "GH-7K3M-2A9F");
    assert.equal(normalizeCertificateCode("GH-7K3M-2A90"), null);
    assert.equal(normalizeCertificateCode("GH-7K3M"), null);
    assert.equal(normalizeCertificateCode("' OR 1=1"), null);
  });
});
