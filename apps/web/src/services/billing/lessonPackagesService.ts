import type { Id, LessonPackage, LessonPackageFilter, UpdateLessonPackage, CreateLessonPackage } from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { store } from "@/services/world/store";
import { newId, notFoundError, nowIso, readOp, writeOp, textIncludes } from "@/services/world/ops";
import { withKind } from "@/lib/text";
import { realAccountInBrowser } from "../world/delegate";
import { auditLogService } from "../audit/auditLogService";
import { unwrap } from "../server/action";
import { clone } from "./billingHelpers";
import { normalizePackage, validatePackage } from "./billingValidation";
import { createPackageAction, listPackagesAction, updatePackageAction } from "./catalogActions";
import { sortByName } from "./planRules";
import { encodeArgs } from "../world/transport";

/**
 * Catalogo de pacotes. Conta real: banco pelo servidor (`catalogActions`,
 * doc 15, fatia 2.1). Demonstracao: store.
 */

function isRealAccount(): boolean {
  return realAccountInBrowser();
}

/**
 * Transicao (doc 15, fatia 2): venda e uso de pacote ainda leem o catalogo no
 * store. Ate migrarem, a conta real mantem la uma copia. Sai na fatia 4.
 */
function cachePackages(packages: LessonPackage[]): void {
  const ids = new Set(packages.map((p) => p.id));
  store.lessonPackages = [...store.lessonPackages.filter((p) => !ids.has(p.id)), ...packages];
}

function recordCreated(pkg: LessonPackage): void {
  auditLogService.record({
    action: "created",
    target: { type: "lesson_package", id: pkg.id, label: pkg.name },
    predicate: `criou o ${withKind("pacote", pkg.name)} (${plural(pkg.lessons, "aula", "aulas")}, ${formatCents(pkg.priceCents)})`,
  });
}

function recordUpdated(id: Id, before: LessonPackage, after: LessonPackage): void {
  const statusChanged = before.status !== after.status;
  auditLogService.record({
    action: statusChanged ? (after.status === "active" ? "activated" : "inactivated") : "updated",
    target: { type: "lesson_package", id, label: after.name },
    predicate: statusChanged
      ? `${after.status === "active" ? "reativou" : "inativou"} o ${withKind("pacote", after.name)}`
      : `atualizou o ${withKind("pacote", after.name)}`,
    changes:
      before.priceCents !== after.priceCents
        ? [
            {
              field: "priceCents",
              label: "Valor",
              before: formatCents(before.priceCents),
              after: formatCents(after.priceCents),
            },
          ]
        : undefined,
  });
}

export const lessonPackagesService = {
  // --- Catalogo ------------------------------------------------------------
  listPackages(filter?: LessonPackageFilter): Promise<LessonPackage[]> {
    return readOp(async () => {
      if (isRealAccount()) {
        const packages = await unwrap(listPackagesAction(filter));
        if (!filter?.search && !filter?.status) cachePackages(packages);
        return packages;
      }
      let result = store.lessonPackages;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(sortByName(result));
    });
  },

  createPackage(input: CreateLessonPackage): Promise<LessonPackage> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const created = await unwrap(createPackageAction(input));
        cachePackages([created]);
        recordCreated(created);
        return created;
      }
      const payload = normalizePackage(input);
      validatePackage(payload, store.classGroups);
      const ts = nowIso();
      const pkg: LessonPackage = {
        ...payload,
        name: payload.name ?? "",
        status: payload.status ?? "active",
        organizationId: store.organization.id,
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
      };
      store.lessonPackages.push(pkg);
      recordCreated(pkg);
      return clone(pkg);
    });
  },

  /** Mudar o pacote vale para as proximas vendas; o que ja foi vendido fica como esta. */
  updatePackage(id: Id, payload: UpdateLessonPackage): Promise<LessonPackage> {
    return writeOp(async () => {
      if (isRealAccount()) {
        const { before, after } = await unwrap(updatePackageAction(id, encodeArgs(payload) as typeof payload));
        cachePackages([after]);
        recordUpdated(id, before, after);
        return after;
      }
      const idx = store.lessonPackages.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Pacote não encontrado.");
      const before = store.lessonPackages[idx];
      const next = normalizePackage({ ...before, ...payload });
      validatePackage(next, store.classGroups);
      store.lessonPackages[idx] = { ...before, ...next, name: next.name ?? before.name, updatedAt: nowIso() };
      const after = store.lessonPackages[idx];
      recordUpdated(id, before, after);
      return clone(after);
    });
  },
};
