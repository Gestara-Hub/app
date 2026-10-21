import type { Id, LessonPackage, LessonPackageFilter, UpdateLessonPackage, CreateLessonPackage } from "@gestarahub/contracts";
import { formatCents, plural } from "@gestarahub/core/format";
import { store } from "@/mocks/store";
import { newId, notFoundError, nowIso, simulateRead, simulateWrite, textIncludes } from "@/mocks/helpers";
import { withKind } from "@/lib/text";
import { isSupabaseOrganization } from "@/lib/session";
import { auditLogService } from "../auditLogService";
import { createLessonPackageInDb, updateLessonPackageInDb } from "../packagesBackend";
import { clone } from "./billingHelpers";
import { syncLessonPackagesFromDb } from "./billingSync";
import { normalizePackage, validatePackage } from "./billingValidation";

export const lessonPackagesService = {
  // --- Catalogo ------------------------------------------------------------
  listPackages(filter?: LessonPackageFilter): Promise<LessonPackage[]> {
    return simulateRead(async () => {
      await syncLessonPackagesFromDb(store.organization.id);
      let result = store.lessonPackages;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((p) => textIncludes(p.name, term));
      }
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone([...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    });
  },

  createPackage(input: CreateLessonPackage): Promise<LessonPackage> {
    return simulateWrite(async () => {
      const payload = normalizePackage(input);
      validatePackage(payload);
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
      if (isSupabaseOrganization(store.organization.id)) {
        await createLessonPackageInDb(pkg);
      }
      store.lessonPackages.push(pkg);
      auditLogService.record({
        action: "created",
        target: { type: "lesson_package", id: pkg.id, label: pkg.name },
        predicate: `criou o ${withKind("pacote", pkg.name)} (${plural(pkg.lessons, "aula", "aulas")}, ${formatCents(pkg.priceCents)})`,
      });
      return clone(pkg);
    });
  },

  /** Mudar o pacote vale para as proximas vendas; o que ja foi vendido fica como esta. */
  updatePackage(id: Id, payload: UpdateLessonPackage): Promise<LessonPackage> {
    return simulateWrite(async () => {
      const idx = store.lessonPackages.findIndex((p) => p.id === id);
      if (idx === -1) throw notFoundError("Pacote não encontrado.");
      const before = store.lessonPackages[idx];
      const next = normalizePackage({ ...before, ...payload });
      validatePackage(next);
      if (isSupabaseOrganization(store.organization.id)) {
        await updateLessonPackageInDb(id, payload, store.organization.id);
      }
      store.lessonPackages[idx] = { ...before, ...next, name: next.name ?? before.name, updatedAt: nowIso() };
      const after = store.lessonPackages[idx];
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
      return clone(after);
    });
  },
};
