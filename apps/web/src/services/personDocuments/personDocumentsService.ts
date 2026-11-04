import type {
  ApiErrorField,
  CreatePersonDocument,
  ExpiringPersonDocument,
  Id,
  Permission,
  PersonDocument,
  PersonDocumentKind,
  PersonDocumentOwnerKind,
  PersonDocumentView,
  UpdatePersonDocument,
} from "@gestarahub/contracts";
import { dateInSpace, isIsoDate } from "@gestarahub/core/date";
import {
  MAX_DOCUMENT_NOTES_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  documentExpiry,
  documentExpiryGroupKey,
  documentLabel,
  documentTitleMode,
  isDocumentKindOf,
  isSelectableDocumentKind,
} from "@gestarahub/core/person-documents";
import { can } from "@/lib/permissions";
import { apiError, newId, notFoundError, nowIso, readOp, validationError, writeOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { getCurrentActor } from "@/services/world/actor";
import { afterWorldCommit } from "@/services/world/effects";
import { auditLogService } from "../audit/auditLogService";
import { teacherStudentIds, teacherTeachesStudent, actorTeacherId } from "../classes/teacherScope";
import { getDocumentFileRemover } from "./personDocumentRules";

/**
 * Documentos da ficha do aluno e do instrutor (doc product/28, 04/11/2026).
 *
 * Quem ve e quem mexe:
 * - aluno: ver com `clients:view` (proprietario, gerente, atendente) ou o
 *   professor nos alunos das turmas dele (atestado e restricoes importam na
 *   aula); anexar, editar e tirar com `clients:manage`;
 * - instrutor: ver e mexer so com `team:manage` (proprietario e gerente).
 *
 * O arquivo sobe antes pelo envio de anexos (bucket privado); aqui fica a
 * linha. O download passa por `/api/person-documents/[id]`, que confere as
 * mesmas regras. Tirar o documento apaga o arquivo depois da gravacao.
 */

const NOT_FOUND = "Documento não encontrado.";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function documentsStore(): PersonDocument[] {
  if (!store.personDocuments) store.personDocuments = [];
  return store.personDocuments;
}

function actorCan(permission: Permission): boolean {
  const actor = getCurrentActor();
  return !actor || can(actor.profile, permission);
}

function forbidden(message: string) {
  return apiError("FORBIDDEN", message, { httpStatus: 403 });
}

function ownerIdOf(doc: Pick<PersonDocument, "ownerKind" | "clientId" | "professionalId">): Id {
  return (doc.ownerKind === "client" ? doc.clientId : doc.professionalId) ?? "";
}

function ownerName(ownerKind: PersonDocumentOwnerKind, ownerId: Id): string {
  const owner =
    ownerKind === "client"
      ? store.clients.find((c) => c.id === ownerId)
      : store.professionals.find((p) => p.id === ownerId);
  if (!owner) throw notFoundError(ownerKind === "client" ? "Aluno não encontrado." : "Instrutor não encontrado.");
  return owner.name;
}

function assertCanView(ownerKind: PersonDocumentOwnerKind, ownerId: Id): void {
  if (ownerKind === "professional") {
    if (!actorCan("team:manage")) throw forbidden("Só o proprietário e o gerente veem os documentos da equipe.");
    return;
  }
  if (actorCan("clients:view")) return;
  if (actorCan("clients:view_own") && teacherTeachesStudent(ownerId)) return;
  throw forbidden("Você só vê os documentos dos alunos das suas turmas.");
}

function assertCanManage(ownerKind: PersonDocumentOwnerKind): void {
  const permission: Permission = ownerKind === "client" ? "clients:manage" : "team:manage";
  if (!actorCan(permission)) throw forbidden("Você não pode mexer nos documentos desta ficha.");
}

function toView(doc: PersonDocument, today: string): PersonDocumentView {
  return {
    ...clone(doc),
    label: documentLabel(doc.ownerKind, doc.kind, doc.title),
    ...documentExpiry(doc.expiresOn, today),
  };
}

/** Tipo do dono, nome em "Outro", datas e tamanhos. */
function validate(
  ownerKind: PersonDocumentOwnerKind,
  payload: { kind?: string; title?: string; expiresOn?: string; notes?: string },
  current?: PersonDocument,
): void {
  const fields: ApiErrorField[] = [];
  const kind = payload.kind ?? current?.kind;
  const title = payload.title !== undefined ? payload.title : current?.title;
  // Tipo novo (ou trocado) so entre os da selecao; o aposentado que o documento
  // ja tem continua valendo na edicao.
  const kindOk =
    Boolean(kind) &&
    (kind === current?.kind ? isDocumentKindOf(ownerKind, kind!) : isSelectableDocumentKind(ownerKind, kind!));
  if (!kindOk) fields.push({ field: "kind", message: "Escolha o tipo do documento." });
  else if (documentTitleMode(ownerKind, kind as PersonDocumentKind) === "required" && !title?.trim()) {
    fields.push({ field: "title", message: "Dê um nome ao documento." });
  }
  if (title && title.trim().length > MAX_DOCUMENT_TITLE_LENGTH) {
    fields.push({ field: "title", message: `Use até ${MAX_DOCUMENT_TITLE_LENGTH} caracteres.` });
  }
  if (payload.expiresOn && !isIsoDate(payload.expiresOn)) fields.push({ field: "expiresOn", message: "Data inválida." });
  if (payload.notes && payload.notes.length > MAX_DOCUMENT_NOTES_LENGTH) {
    fields.push({ field: "notes", message: `Use até ${MAX_DOCUMENT_NOTES_LENGTH} caracteres.` });
  }
  if (fields.length > 0) throw validationError(fields);
}

function findDocument(id: Id): PersonDocument {
  const found = documentsStore().find((d) => d.id === id);
  if (!found) throw notFoundError(NOT_FOUND);
  return found;
}

function auditTarget(doc: Pick<PersonDocument, "ownerKind" | "clientId" | "professionalId">) {
  const id = ownerIdOf(doc);
  return { type: doc.ownerKind, id, label: ownerName(doc.ownerKind, id) } as const;
}

/** Ordem da lista: vencidos e vencendo primeiro, depois os mais novos. */
const EXPIRY_ORDER = { expired: 0, expiring: 1, valid: 2, none: 3 } as const;

export const personDocumentsServiceImpl = {
  /** Documentos de um aluno ou instrutor. */
  list(ownerKind: PersonDocumentOwnerKind, ownerId: Id): Promise<PersonDocumentView[]> {
    return readOp(async () => {
      ownerName(ownerKind, ownerId);
      assertCanView(ownerKind, ownerId);
      const today = dateInSpace();
      return documentsStore()
        .filter((d) => d.ownerKind === ownerKind && ownerIdOf(d) === ownerId)
        .map((d) => toView(d, today))
        .sort(
          (a, b) => EXPIRY_ORDER[a.expiry] - EXPIRY_ORDER[b.expiry] || b.createdAt.localeCompare(a.createdAt),
        );
    });
  },

  create(payload: CreatePersonDocument): Promise<PersonDocumentView> {
    return writeOp(async () => {
      assertCanManage(payload.ownerKind);
      const name = ownerName(payload.ownerKind, payload.ownerId);
      validate(payload.ownerKind, payload);
      if (!payload.file?.id || !payload.file.name) {
        throw validationError([{ field: "file", message: "Anexe o arquivo." }]);
      }
      const now = nowIso();
      // O nome so vale onde o tipo usa ("Outro" e "Qual documento").
      const title = documentTitleMode(payload.ownerKind, payload.kind) === "none" ? undefined : payload.title?.trim();
      const notes = payload.notes?.trim();
      const doc: PersonDocument = {
        id: newId(),
        organizationId: store.organization.id,
        ownerKind: payload.ownerKind,
        ...(payload.ownerKind === "client" ? { clientId: payload.ownerId } : { professionalId: payload.ownerId }),
        kind: payload.kind,
        ...(title ? { title } : {}),
        file: clone(payload.file),
        ...(payload.expiresOn ? { expiresOn: payload.expiresOn } : {}),
        ...(notes ? { notes } : {}),
        createdBy: getCurrentActor()?.userId ?? "system",
        createdAt: now,
        updatedAt: now,
      };
      documentsStore().push(doc);
      const label = documentLabel(doc.ownerKind, doc.kind, doc.title);
      auditLogService.record({
        action: "created",
        target: { type: doc.ownerKind, id: payload.ownerId, label: name },
        predicate: `anexou ${label} na ficha de ${name}`,
      });
      return toView(doc, dateInSpace());
    });
  },

  update(id: Id, payload: UpdatePersonDocument): Promise<PersonDocumentView> {
    return writeOp(async () => {
      const doc = findDocument(id);
      assertCanManage(doc.ownerKind);
      validate(doc.ownerKind, payload, doc);
      if (payload.kind !== undefined) doc.kind = payload.kind;
      if (payload.title !== undefined) {
        const title = payload.title.trim();
        if (title) doc.title = title;
        else delete doc.title;
      }
      // Tipo sem nome livre: o nome antigo sai (ex.: de "Outro" para atestado).
      if (documentTitleMode(doc.ownerKind, doc.kind) === "none") delete doc.title;
      if (payload.expiresOn !== undefined) {
        if (payload.expiresOn) doc.expiresOn = payload.expiresOn;
        else delete doc.expiresOn;
      }
      if (payload.notes !== undefined) {
        const notes = payload.notes.trim();
        if (notes) doc.notes = notes;
        else delete doc.notes;
      }
      doc.updatedAt = nowIso();
      const target = auditTarget(doc);
      auditLogService.record({
        action: "updated",
        target,
        predicate: `editou ${documentLabel(doc.ownerKind, doc.kind, doc.title)} na ficha de ${target.label}`,
      });
      return toView(doc, dateInSpace());
    });
  },

  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      const docs = documentsStore();
      const index = docs.findIndex((d) => d.id === id);
      if (index === -1) throw notFoundError(NOT_FOUND);
      const doc = docs[index];
      assertCanManage(doc.ownerKind);
      const target = auditTarget(doc);
      docs.splice(index, 1);
      // Arquivo de dado pessoal (as vezes de saude): sai do armazenamento junto.
      const removeFiles = getDocumentFileRemover();
      const organizationId = store.organization.id;
      if (removeFiles) afterWorldCommit(() => removeFiles(organizationId, [doc.file.id]));
      auditLogService.record({
        action: "deleted",
        target,
        predicate: `tirou ${documentLabel(doc.ownerKind, doc.kind, doc.title)} da ficha de ${target.label}`,
      });
    });
  },

  /**
   * Documentos vencendo (30 dias) ou vencidos, de alunos e instrutores ativos
   * que quem pede pode ver. Por pessoa e tipo vale so o de validade mais longa:
   * o atestado renovado tira o aviso do antigo.
   */
  listExpiring(): Promise<ExpiringPersonDocument[]> {
    return readOp(async () => {
      const today = dateInSpace();
      const seesAllStudents = actorCan("clients:view");
      const teacherStudents = !seesAllStudents && actorCan("clients:view_own") ? teacherStudentIds(actorTeacherId()) : undefined;
      const seesStudents = seesAllStudents || teacherStudents !== undefined;
      const seesTeam = actorCan("team:manage");

      const latest = new Map<string, PersonDocument>();
      for (const doc of documentsStore()) {
        if (!doc.expiresOn) continue;
        const ownerId = ownerIdOf(doc);
        if (doc.ownerKind === "client") {
          if (!seesStudents || (teacherStudents && !teacherStudents.has(ownerId))) continue;
          if (store.clients.find((c) => c.id === ownerId)?.status !== "active") continue;
        } else {
          if (!seesTeam) continue;
          if (store.professionals.find((p) => p.id === ownerId)?.status !== "active") continue;
        }
        const key = `${doc.ownerKind}:${ownerId}:${documentExpiryGroupKey(doc.ownerKind, doc.kind, doc.title)}`;
        const current = latest.get(key);
        if (!current || (current.expiresOn ?? "") < doc.expiresOn) latest.set(key, doc);
      }

      const out: ExpiringPersonDocument[] = [];
      for (const doc of latest.values()) {
        const { expiry, daysToExpire } = documentExpiry(doc.expiresOn, today);
        if ((expiry !== "expiring" && expiry !== "expired") || daysToExpire === undefined || !doc.expiresOn) continue;
        const ownerId = ownerIdOf(doc);
        out.push({
          id: doc.id,
          ownerKind: doc.ownerKind,
          ownerId,
          ownerName: ownerName(doc.ownerKind, ownerId),
          label: documentLabel(doc.ownerKind, doc.kind, doc.title),
          expiresOn: doc.expiresOn,
          expiry,
          daysToExpire,
        });
      }
      return out.sort((a, b) => a.daysToExpire - b.daysToExpire);
    });
  },
};
