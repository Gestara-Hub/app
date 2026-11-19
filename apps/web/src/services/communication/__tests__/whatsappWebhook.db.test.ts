import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { handleWhatsAppWebhookPayload } from "../whatsappWebhook";

/**
 * Avisos da Meta por espaco (doc technical/07 §1.4): o numero diz de quem sao
 * os status de entrega; a conta diz de quem e o modelo, e a situacao nova vai
 * para o banco (antes so mudava a memoria do servidor).
 */

const admin = adminClient();
let tenant: TestTenant;
let other: TestTenant;
let phoneNumberId: string;
let wabaId: string;

const metaId = () => String(Math.floor(1e14 + Math.random() * 9e14));

async function connect(t: TestTenant, phone: string, waba: string) {
  await admin
    .rpc("whatsapp_credentials_save", {
      p_organization_id: t.organizationId,
      p_phone_number_id: phone,
      p_waba_id: waba,
      p_business_id: null,
      p_onboarding: "coexistence",
      p_token: "token-de-teste",
      p_pin: null,
    })
    .throwOnError();
}

async function template(t: TestTenant, trigger: string) {
  const id = randomUUID();
  await admin
    .from("message_templates")
    .insert({
      id,
      organization_id: t.organizationId,
      trigger,
      category: "billing",
      title: "Lembrete",
      description: "Lembrete",
      content: "Olá, {aluno}!",
      meta_template_name: trigger,
      meta_status: "PENDING",
    })
    .throwOnError();
  return id;
}

async function log(t: TestTenant, id: string, sentAt = new Date().toISOString(), status = "sent") {
  await admin
    .from("message_logs")
    .insert({
      id,
      organization_id: t.organizationId,
      recipient_name: "Ana",
      recipient_phone: "5511977770000",
      trigger: "billing_before_due",
      category: "billing",
      content: "Oi",
      status,
      sent_at: sentAt,
    })
    .throwOnError();
}

beforeEach(async () => {
  tenant = await createTestTenant();
  other = await createTestTenant();
  phoneNumberId = metaId();
  wabaId = metaId();
  await connect(tenant, phoneNumberId, wabaId);
  await connect(other, metaId(), metaId());
});

afterEach(async () => {
  await tenant.remove();
  await other.remove();
});

function statuses(list: { id: string; status: "sent" | "delivered" | "read" | "failed" }[]) {
  return {
    object: "whatsapp_business_account" as const,
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: "messages" as const,
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5592988887777", phone_number_id: phoneNumberId },
              statuses: list.map((s) => ({ ...s, timestamp: "1763370000", recipient_id: "5511977770000" })),
            },
          },
        ],
      },
    ],
  };
}

describe("avisos da Meta por espaco", () => {
  it("situacao do modelo vai para o banco so nos espacos daquela conta", async () => {
    const mine = await template(tenant, "billing_before_due");
    const theirs = await template(other, "billing_before_due");

    const result = await handleWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: wabaId,
          changes: [
            {
              field: "message_template_status_update",
              value: { event: "REJECTED", message_template_name: "billing_before_due", message_template_language: "pt_BR", reason: "INVALID_FORMAT" },
            },
          ],
        },
      ],
    });

    expect(result.templatesUpdated).toBe(1);
    const { data } = await admin.from("message_templates").select("id, meta_status, meta_rejection_reason").in("id", [mine, theirs]);
    expect(data?.find((r) => r.id === mine)).toMatchObject({ meta_status: "REJECTED", meta_rejection_reason: "INVALID_FORMAT" });
    expect(data?.find((r) => r.id === theirs)).toMatchObject({ meta_status: "PENDING" });
  });

  it("status de entrega muda so a mensagem do espaco dono do numero", async () => {
    const wamid = `wamid.${randomUUID()}`;
    await log(tenant, wamid);

    const result = await handleWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: wabaId,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5592988887777", phone_number_id: phoneNumberId },
                statuses: [{ id: wamid, status: "read", timestamp: "1763370000", recipient_id: "5511977770000" }],
              },
            },
          ],
        },
      ],
    });

    expect(result.statusesProcessed).toBe(1);
    const { data } = await admin.from("message_logs").select("status, read_at").eq("id", wamid).single();
    expect(data?.status).toBe("read");
    expect(data?.read_at).toBeTruthy();
  });

  it("entregue que chega depois do lida nao volta a mensagem", async () => {
    const wamid = `wamid.${randomUUID()}`;
    await log(tenant, wamid);

    await handleWhatsAppWebhookPayload(statuses([{ id: wamid, status: "read" }]));
    await handleWhatsAppWebhookPayload(statuses([{ id: wamid, status: "delivered" }]));

    const { data } = await admin.from("message_logs").select("status").eq("id", wamid).single();
    expect(data?.status).toBe("read");
  });

  it("lida marca tambem as anteriores para o mesmo numero", async () => {
    const first = `wamid.${randomUUID()}`;
    const second = `wamid.${randomUUID()}`;
    const failed = `wamid.${randomUUID()}`;
    await log(tenant, first, "2026-11-18T10:00:00Z", "delivered");
    await log(tenant, failed, "2026-11-18T10:01:00Z", "failed");
    await log(tenant, second, "2026-11-18T10:02:00Z", "delivered");

    await handleWhatsAppWebhookPayload(statuses([{ id: second, status: "read" }]));

    const { data } = await admin.from("message_logs").select("id, status").in("id", [first, second, failed]);
    expect(data?.find((r) => r.id === first)?.status).toBe("read");
    expect(data?.find((r) => r.id === second)?.status).toBe("read");
    expect(data?.find((r) => r.id === failed)?.status).toBe("failed");
  });

  it("SAIR pelo numero do espaco revoga so naquele espaco", async () => {
    const ana = randomUUID();
    const anaOutro = randomUUID();
    await admin
      .from("clients")
      .insert([
        { id: ana, organization_id: tenant.organizationId, name: "Ana", status: "active", phone: "+5511977770000", whatsapp_consent_status: "granted" },
        { id: anaOutro, organization_id: other.organizationId, name: "Ana", status: "active", phone: "+5511977770000", whatsapp_consent_status: "granted" },
      ])
      .throwOnError();

    await handleWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: wabaId,
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5592988887777", phone_number_id: phoneNumberId },
                messages: [{ from: "5511977770000", id: "wamid.in", timestamp: "1763370000", type: "text", text: { body: "SAIR" } }],
              },
            },
          ],
        },
      ],
    });

    const { data } = await admin.from("clients").select("id, whatsapp_consent_status").in("id", [ana, anaOutro]);
    expect(data?.find((r) => r.id === ana)?.whatsapp_consent_status).toBe("revoked");
    expect(data?.find((r) => r.id === anaOutro)?.whatsapp_consent_status).toBe("granted");
  });
});
