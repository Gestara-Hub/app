import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_DOCUMENT_KINDS,
  PROFESSIONAL_DOCUMENT_KINDS,
  documentExpiryGroupKey,
  documentTitleMode,
  isSelectableDocumentKind,
  selectableDocumentKinds,
  documentExpiry,
  documentExpiryText,
  documentKindExpires,
  documentLabel,
  isDocumentKindOf,
} from "../src/person-documents.ts";

describe("validade do documento", () => {
  it("sem data nao vence", () => {
    assert.deepEqual(documentExpiry(undefined, "2026-11-04"), { expiry: "none" });
  });

  it("o ultimo dia ainda vale", () => {
    assert.deepEqual(documentExpiry("2026-11-04", "2026-11-04"), { expiry: "expiring", daysToExpire: 0 });
    assert.deepEqual(documentExpiry("2026-11-03", "2026-11-04"), { expiry: "expired", daysToExpire: -1 });
  });

  it("vence em breve ate 30 dias antes", () => {
    assert.equal(documentExpiry("2026-12-04", "2026-11-04").expiry, "expiring");
    assert.equal(documentExpiry("2026-12-05", "2026-11-04").expiry, "valid");
  });

  it("frase curta", () => {
    assert.equal(documentExpiryText(0), "Vence hoje");
    assert.equal(documentExpiryText(1), "Vence amanhã");
    assert.equal(documentExpiryText(12), "Vence em 12 dias");
    assert.equal(documentExpiryText(-1), "Venceu ontem");
    assert.equal(documentExpiryText(-5), "Venceu há 5 dias");
    assert.equal(documentExpiryText(undefined), undefined);
  });
});

describe("tipos de documento", () => {
  it("cada dono tem os seus tipos", () => {
    assert.equal(isDocumentKindOf("client", "medical_certificate"), true);
    assert.equal(isDocumentKindOf("professional", "medical_certificate"), false);
    assert.equal(isDocumentKindOf("professional", "professional_registration"), true);
    assert.equal(isDocumentKindOf("client", "professional_registration"), false);
  });

  it("atestado e registro profissional pedem validade", () => {
    assert.equal(documentKindExpires("client", "medical_certificate"), true);
    assert.equal(documentKindExpires("client", "contract"), false);
    assert.equal(documentKindExpires("professional", "professional_registration"), true);
  });

  it("nome: titulo dado ou o tipo", () => {
    assert.equal(documentLabel("client", "medical_certificate"), "Atestado médico");
    assert.equal(documentLabel("client", "other", "  Ficha de anamnese "), "Ficha de anamnese");
    assert.equal(documentLabel("professional", "professional_registration"), "Registro profissional (CREF)");
  });

  it("identificacao: Qual documento entra no nome; nos demais o nome nao vale", () => {
    assert.equal(documentLabel("client", "identity_document", "CNH"), "Documento de identificação (CNH)");
    assert.equal(documentLabel("client", "identity_document"), "Documento de identificação");
    assert.equal(documentLabel("client", "medical_certificate", "qualquer"), "Atestado médico");
    assert.equal(documentTitleMode("client", "other"), "required");
    assert.equal(documentTitleMode("professional", "identity_document"), "optional");
    assert.equal(documentTitleMode("client", "contract"), "none");
  });

  it("aviso: a CNH e o RG sao chaves diferentes; atestados repetidos, a mesma", () => {
    assert.notEqual(documentExpiryGroupKey("client", "identity_document", "CNH"), documentExpiryGroupKey("client", "identity_document", "RG"));
    assert.equal(documentExpiryGroupKey("client", "medical_certificate", "a"), documentExpiryGroupKey("client", "medical_certificate", "b"));
  });

  it("tipos novos e codigos sem repeticao em cada dono", () => {
    for (const list of [CLIENT_DOCUMENT_KINDS, PROFESSIONAL_DOCUMENT_KINDS]) {
      const values = list.map((k) => k.value);
      assert.equal(new Set(values).size, values.length);
      assert.equal(values.at(-1), "other");
    }
    assert.equal(isSelectableDocumentKind("client", "dermatological_exam"), true);
    assert.equal(isSelectableDocumentKind("professional", "first_aid"), true);
    assert.equal(isSelectableDocumentKind("professional", "pickup_authorization"), false);
    assert.equal(selectableDocumentKinds("client").length, CLIENT_DOCUMENT_KINDS.filter((k) => !k.retired).length);
  });
});
