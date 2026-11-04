import type { CreatePersonDocument, Id, PersonDocumentOwnerKind } from "@gestarahub/contracts";
import type { MethodSlice, SliceLoader } from "../world/slices";

/**
 * Recorte da leitura (doc 19, fase 2): o dono do documento e o que a regra do
 * professor precisa (turmas, matriculas e usuarios), sem o historico do aluno.
 */
async function owner(ownerKind: PersonDocumentOwnerKind, ownerId: Id, load: SliceLoader): Promise<void> {
  await Promise.all([load.all("users"), load.all("professionals"), load.all("classGroups")]);
  if (ownerKind === "client") {
    await Promise.all([load.where("clients", "id", [ownerId]), load.where("enrollments", "studentId", [ownerId])]);
  } else {
    load.none("clients");
    load.none("enrollments");
  }
  await load.where("personDocuments", ownerKind === "client" ? "clientId" : "professionalId", [ownerId]);
  load.none("auditLog");
}

/** Documento pelo id: a linha e depois o dono dela. */
const byId: MethodSlice = async ([id], load) => {
  const [doc] = await load.where("personDocuments", "id", [id as Id]);
  if (doc) {
    const ownerKind = doc.ownerKind as PersonDocumentOwnerKind;
    await owner(ownerKind, (ownerKind === "client" ? doc.clientId : doc.professionalId) as Id, load);
  } else {
    load.none("auditLog");
  }
};

export const personDocumentSlices: Record<string, MethodSlice> = {
  list: async ([ownerKind, ownerId], load) => owner(ownerKind as PersonDocumentOwnerKind, ownerId as Id, load),
  create: async ([payload], load) => {
    const p = payload as CreatePersonDocument;
    await owner(p.ownerKind, p.ownerId, load);
  },
  update: byId,
  remove: byId,
  /** Vencendo: os documentos com validade, os donos e a regra do professor. */
  listExpiring: async (_args, load) => {
    const docs = await load.all("personDocuments");
    const clientIds = docs.map((d) => d.clientId as Id | undefined).filter((id): id is Id => Boolean(id));
    await Promise.all([
      load.all("users"),
      load.all("professionals"),
      load.all("classGroups"),
      load.all("enrollments"),
      load.all("reservations"),
      load.all("sessionOverrides"),
      load.where("clients", "id", clientIds),
    ]);
  },
};
