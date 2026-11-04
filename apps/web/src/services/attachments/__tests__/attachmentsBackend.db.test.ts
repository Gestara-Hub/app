import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";
import { saveAttachmentInStorage } from "../attachmentsBackend";

/**
 * Revisao geral de 31/10/2026 (decisao 5, migracao 78): a linha do anexo e
 * gravada pelo servidor, com o espaco e o perfil da sessao no banco.
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

const file = () => ({ name: "recibo.pdf", type: "application/pdf", size: 14, buffer: Buffer.from("%PDF-1.4 teste") });

describe("anexo gravado pelo servidor", () => {
  it("o dono anexa: arquivo na pasta do espaço e linha com o espaço da sessão", async () => {
    const saved = await saveAttachmentInStorage(file(), tenant.organizationId);
    const { data } = await admin.from("attachments").select("organization_id, storage_path").eq("id", saved.id).single();
    expect(data?.organization_id).toBe(tenant.organizationId);
    expect(String(data?.storage_path).startsWith(`${tenant.organizationId}/`)).toBe(true);
  });

  it("acima de 4 MB é recusado (teto de 04/11/2026)", async () => {
    const big = Buffer.alloc(4 * 1024 * 1024 + 1, 1);
    await expect(
      saveAttachmentInStorage({ name: "foto.jpg", type: "image/jpeg", size: big.length, buffer: big }, tenant.organizationId),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const { count } = await admin
      .from("attachments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", tenant.organizationId);
    expect(count).toBe(0);
  });

  it("outro espaço no pedido é recusado", async () => {
    await expect(saveAttachmentInStorage(file(), randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("o professor não anexa (como o banco já recusava)", async () => {
    await signInAs(await tenant.addUser("professional"));
    await expect(saveAttachmentInStorage(file(), tenant.organizationId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { count } = await admin
      .from("attachments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", tenant.organizationId);
    expect(count).toBe(0);
  });
});
