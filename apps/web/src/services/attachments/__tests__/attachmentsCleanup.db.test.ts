import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "@gestarahub/contracts";
import { adminClient, createTestTenant, type TestTenant } from "@/test/db";
import { saveAttachmentInStorage } from "../attachmentsBackend";
import { attachmentIsUsed, cleanupUnusedAttachments } from "../attachmentsCleanup";
import { serviceAction } from "@/services/world/serviceActions";

/**
 * Envio resistente a falha (04/11/2026, migracao 86): o arquivo sobe antes de
 * salvar; "em uso" e o que algum registro aponta; a rotina diaria apaga so o
 * sem uso ha mais de 24 horas.
 */

const admin = adminClient();
let tenant: TestTenant;

beforeEach(async () => {
  tenant = await createTestTenant();
});

afterEach(async () => {
  const { data } = await admin.from("attachments").select("storage_path").eq("organization_id", tenant.organizationId);
  const paths = (data ?? []).map((r) => String(r.storage_path));
  if (paths.length > 0) await admin.storage.from("attachments").remove(paths);
  await tenant.remove();
});

const png = () => ({ name: "comprovante.png", type: "image/png", size: 8, buffer: Buffer.from("PNGteste") });

async function upload(): Promise<string> {
  return (await saveAttachmentInStorage(png(), tenant.organizationId)).id;
}

async function makeOld(ids: string[]): Promise<void> {
  await admin.from("attachments").update({ uploaded_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).in("id", ids).throwOnError();
}

async function exists(id: string): Promise<boolean> {
  const { count } = await admin.from("attachments").select("id", { count: "exact", head: true }).eq("id", id);
  return (count ?? 0) > 0;
}

describe("anexo em uso", () => {
  it("lançamento, documento da ficha e logo do certificado contam como uso", async () => {
    const [inEntry, inDocument, inLogo, loose] = [await upload(), await upload(), await upload(), await upload()];

    const categoryId = randomUUID();
    await admin.from("financial_categories").insert({ id: categoryId, organization_id: tenant.organizationId, type: "expense", name: "Teste" }).throwOnError();
    await admin
      .from("financial_entries")
      .insert({
        organization_id: tenant.organizationId,
        type: "expense",
        category_id: categoryId,
        description: "Conta de luz",
        amount_cents: 1000,
        due_date: "2026-11-10",
        attachments: [{ id: inEntry, name: "comprovante.png" }],
      })
      .throwOnError();

    const result = await serviceAction("clients.create", [{ name: "Ana Anexo", phone: "11977770003", status: "active" }]);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const ana = result.data as Client;
    await admin
      .from("person_documents")
      .insert({
        organization_id: tenant.organizationId,
        owner_kind: "client",
        client_id: ana.id,
        kind: "contract",
        file: { id: inDocument, name: "comprovante.png" },
        created_by: "teste",
      })
      .throwOnError();

    await admin.from("organizations").update({ certificate_template: { logoFileId: inLogo } }).eq("id", tenant.organizationId).throwOnError();

    expect(await attachmentIsUsed(admin, tenant.organizationId, inEntry)).toBe(true);
    expect(await attachmentIsUsed(admin, tenant.organizationId, inDocument)).toBe(true);
    expect(await attachmentIsUsed(admin, tenant.organizationId, inLogo)).toBe(true);
    expect(await attachmentIsUsed(admin, tenant.organizationId, loose)).toBe(false);
  });
});

describe("limpeza diária", () => {
  it("apaga só o sem uso há mais de 24 horas; o usado nunca sai", async () => {
    const [usedOld, looseOld, looseNew] = [await upload(), await upload(), await upload()];
    await admin.from("organizations").update({ certificate_template: { logoFileId: usedOld } }).eq("id", tenant.organizationId).throwOnError();
    await makeOld([usedOld, looseOld]);

    await cleanupUnusedAttachments(admin);

    expect(await exists(usedOld)).toBe(true);
    expect(await exists(looseOld)).toBe(false);
    expect(await exists(looseNew)).toBe(true);
    const { data: files } = await admin.storage.from("attachments").list(tenant.organizationId);
    expect((files ?? []).map((f) => f.name)).not.toContain(looseOld);
  });
});
