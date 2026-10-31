import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { loadChargeInvoice } from "../paymentPage";
import { getPublicMinorConsentDetailsAction } from "@/services/legalConsent/minorConsentActions";

/**
 * Rotas publicas (sem login, link que circula por WhatsApp) mandam para a
 * pagina so dados mascarados (decisao do usuario de 30/10/2026, doc
 * product/24): nome "Ana S.", CPF "***.982.247-**", nascimento so o ano e
 * nenhum telefone.
 */

const admin = adminClient();
let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  await tenant.remove();
});

describe("rotas públicas com dados mascarados", () => {
  it("fatura da cobrança: nome e CPF de quem paga mascarados", async () => {
    const studentId = randomUUID();
    const chargeId = randomUUID();
    await admin
      .from("organizations")
      .update({ settings: { onlinePayments: { enabled: true, acceptedMethods: { pix: true, card: false, boleto: false } } } })
      .eq("id", tenant.organizationId)
      .throwOnError();
    await admin
      .from("clients")
      .insert({ id: studentId, organization_id: tenant.organizationId, name: "Ana Souza Lima", cpf: "52998224725", birth_date: "1990-01-01", phone: "+5511977770000", status: "active" })
      .throwOnError();
    await admin
      .from("charges")
      .insert({ id: chargeId, organization_id: tenant.organizationId, student_id: studentId, kind: "extra", description: "Kimono", due_date: "2026-11-10", amount_cents: 15000, status: "pending" })
      .throwOnError();

    const invoice = await loadChargeInvoice(chargeId);

    expect(invoice).toMatchObject({ studentName: "Ana S. L.", payerName: "Ana S. L.", payerCpfMasked: "***.982.247-**" });
    expect(JSON.stringify(invoice)).not.toContain("Souza");
    expect(JSON.stringify(invoice)).not.toContain("52998224725");
  });

  it("termo do responsável: nome do aluno e do responsável mascarados, sem telefone e só o ano do nascimento", async () => {
    const studentId = randomUUID();
    await admin
      .from("clients")
      .insert({
        id: studentId,
        organization_id: tenant.organizationId,
        name: "Gabriela dos Santos",
        birth_date: "2015-05-05",
        phone: "+5511977770000",
        guardians: [{ name: "Maria dos Santos", relationship: "Mãe", phone: "+5511988887777", financial: true }],
        status: "active",
      })
      .throwOnError();

    const result = await getPublicMinorConsentDetailsAction(studentId);

    expect(result.student).toMatchObject({
      name: "Gabriela S.",
      birthDateMasked: "**/**/2015",
      guardians: [{ nameMasked: "Maria S.", relationship: "Mãe" }],
    });
    const sent = JSON.stringify(result);
    expect(sent).not.toContain("Santos");
    expect(sent).not.toContain("988887777");
    expect(sent).not.toContain("977770000");
    expect(sent).not.toContain("2015-05-05");
  });
});
