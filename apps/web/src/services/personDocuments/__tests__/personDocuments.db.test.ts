import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Client, FileAttachment, PersonDocumentView } from "@gestarahub/contracts";
import { adminClient, createTestTenant, signInAs, type TestTenant } from "@/test/db";
import { saveAttachmentInStorage } from "@/services/attachments/attachmentsBackend";
import { serviceAction } from "@/services/world/serviceActions";
import { removeDocumentFiles } from "../personDocumentFiles";

/**
 * Documentos da ficha no banco (doc product/28): a linha gravada pelo servidor,
 * a leitura pelo recorte e o arquivo apagado quando o documento sai.
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

async function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const result = await serviceAction(method, args);
  if (!result.ok) throw new Error(`${method}: ${JSON.stringify(result.error)}`);
  return result.data as T;
}

const pdf = () => ({ name: "atestado.pdf", type: "application/pdf", size: 14, buffer: Buffer.from("%PDF-1.4 teste") });

async function storedPaths(): Promise<string[]> {
  const { data } = await admin.from("attachments").select("storage_path").eq("organization_id", tenant.organizationId);
  return (data ?? []).map((r) => String(r.storage_path));
}

describe("documento da ficha no banco", () => {
  it("grava, lê pelo recorte e o arquivo sai junto com o documento", async () => {
    const ana = await call<Client>("clients.create", { name: "Ana Banco", phone: "11977770000", status: "active" });
    const file: FileAttachment = await saveAttachmentInStorage(pdf(), tenant.organizationId);
    const doc = await call<PersonDocumentView>("personDocuments.create", {
      ownerKind: "client",
      ownerId: ana.id,
      kind: "medical_certificate",
      file,
      expiresOn: "2099-01-31",
    });

    const { data: row } = await admin
      .from("person_documents")
      .select("organization_id, owner_kind, client_id, kind, expires_on, file")
      .eq("id", doc.id)
      .single();
    expect(row).toMatchObject({
      organization_id: tenant.organizationId,
      owner_kind: "client",
      client_id: ana.id,
      kind: "medical_certificate",
      expires_on: "2099-01-31",
    });
    expect((row?.file as { id: string }).id).toBe(file.id);

    const listed = await call<PersonDocumentView[]>("personDocuments.list", "client", ana.id);
    expect(listed.map((d) => d.label)).toEqual(["Atestado médico"]);

    // Ainda na ficha: o arquivo nao sai.
    await removeDocumentFiles(tenant.organizationId, [file.id]);
    expect(await storedPaths()).toHaveLength(1);

    await call("personDocuments.remove", doc.id);
    const { count } = await admin.from("person_documents").select("id", { count: "exact", head: true }).eq("id", doc.id);
    expect(count).toBe(0);
    await removeDocumentFiles(tenant.organizationId, [file.id]);
    expect(await storedPaths()).toHaveLength(0);
  });

  it("tipo novo grava sem migração; código fora do formato o banco recusa", async () => {
    const ana = await call<Client>("clients.create", { name: "Ana Tipos", phone: "11977770002", status: "active" });
    const file: FileAttachment = await saveAttachmentInStorage(pdf(), tenant.organizationId);
    const doc = await call<PersonDocumentView>("personDocuments.create", {
      ownerKind: "client",
      ownerId: ana.id,
      kind: "dermatological_exam",
      file,
      expiresOn: "2099-03-01",
    });
    expect(doc.label).toBe("Exame dermatológico");
    const { error } = await admin.from("person_documents").update({ kind: "Tipo Errado!" }).eq("id", doc.id);
    expect(error?.message).toMatch(/person_documents_kind_format/);
  });

  it("o usuário logado não grava direto no banco", async () => {
    const ana = await call<Client>("clients.create", { name: "Ana RLS", phone: "11977770001", status: "active" });
    const ownerSession = await signInAs(tenant.owner);
    const { error } = await ownerSession
      .from("person_documents")
      .insert({
        organization_id: tenant.organizationId,
        owner_kind: "client",
        client_id: ana.id,
        kind: "contract",
        file: { id: "x", name: "x.pdf" },
        created_by: "x",
      });
    expect(error).not.toBeNull();
  });
});
