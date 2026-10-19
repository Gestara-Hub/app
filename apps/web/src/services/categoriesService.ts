import type {
  ApiErrorField,
  Category,
  CategoryFilter,
  CreateCategory,
  Id,
  UpdateCategory,
} from "@gestarahub/contracts";
import {
  ASSESSMENT_SCALES,
  assessmentsEnabled,
  normalizePassingGrade,
} from "@gestarahub/core/grades";
import { store } from "@/mocks/store";
import { getSegmentPreset, segmentDefaultAssessments } from "@/lib/business-segment-presets";
import { normalizeText } from "@/lib/text";
import { firstLevelForAge, resolveModalityTrack } from "@/lib/progression-tracks";
import { plural } from "@gestarahub/core/format";
import { format } from "date-fns";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  textIncludes,
  validationError,
} from "@/mocks/helpers";
import { auditLogService } from "./auditLogService";
import { categoryNoun } from "./nouns";
import { isSupabaseOrganization } from "@/lib/session";
import {
  createCategoryInDb,
  getCategoryFromDb,
  inactivateCategoryInDb,
  listCategoriesFromDb,
  updateCategoryInDb,
} from "./categoriesBackend";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Categoria não encontrada.";

// Nome de categoria e unico por organizacao (match accent/case-insensitive).
function isDuplicateName(name: string, excludeId?: Id): boolean {
  const target = normalizeText(name);
  return store.categories.some(
    (c) => c.id !== excludeId && normalizeText(c.name) === target,
  );
}

function validateCategory(
  payload: Partial<CreateCategory>,
  { partial }: { partial: boolean },
): void {
  const fields: ApiErrorField[] = [];
  const has = (key: keyof CreateCategory) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("name")) {
    if (!payload.name || !payload.name.trim()) {
      fields.push({ field: "name", message: `Informe o nome da ${categoryNoun()}.` });
    }
  }

  if (payload.assessments) {
    const { scale, passingGrade } = payload.assessments;
    if (!ASSESSMENT_SCALES.includes(scale)) {
      fields.push({ field: "assessments.scale", message: "Escolha a escala das notas." });
    } else {
      const check = normalizePassingGrade(scale, passingGrade);
      if (!check.ok) fields.push({ field: "assessments.passingGrade", message: check.message });
    }
  }

  if (fields.length > 0) throw validationError(fields);
}

/** Avaliacoes normalizadas (nota minima na escala); desligada sem config = ausente. */
function normalizedAssessments(payload: Pick<CreateCategory, "assessments">): Category["assessments"] {
  const settings = payload.assessments;
  if (!settings) return undefined;
  const check = normalizePassingGrade(settings.scale, settings.passingGrade);
  return { ...settings, passingGrade: check.ok ? check.value : settings.passingGrade };
}

/**
 * Modalidade nova sem configuracao de avaliacoes: segue a area do espaco
 * (ligada em idiomas, musica e cursos livres). So no modelo de turmas.
 */
function defaultAssessmentsForNewModality(): Category["assessments"] {
  const org = store.organization;
  if (org.model !== "classes") return undefined;
  const defaults = segmentDefaultAssessments(
    getSegmentPreset(org.classSegment, org.customSegmentProgression),
  );
  return assessmentsEnabled(defaults) ? defaults : undefined;
}

function sortCategories(list: Category[]): Category[] {
  return [...list].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export const categoriesService = {
  list(filter?: CategoryFilter): Promise<Category[]> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const dbCategories = await listCategoriesFromDb(store.organization.id, filter);
        const dbIds = new Set(dbCategories.map((c) => c.id));
        store.categories = [
          ...store.categories.filter((c) => c.organizationId === store.organization.id ? !dbIds.has(c.id) : true),
          ...dbCategories,
        ];
        return clone(sortCategories(dbCategories));
      }

      let result = store.categories;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((c) => textIncludes(c.name, term));
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(sortCategories(result));
    });
  },

  getById(id: Id): Promise<Category> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const dbCat = await getCategoryFromDb(id, store.organization.id);
        if (dbCat) {
          const idx = store.categories.findIndex((c) => c.id === id);
          if (idx !== -1) store.categories[idx] = dbCat;
          else store.categories.push(dbCat);
          return clone(dbCat);
        }
      }
      const found = store.categories.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateCategory): Promise<Category> {
    return simulateWrite(async () => {
      validateCategory(payload, { partial: false });
      if (isDuplicateName(payload.name)) {
        throw validationError([
          { field: "name", message: `Já existe uma ${categoryNoun()} com esse nome.` },
        ]);
      }
      const ts = nowIso();
      const nextPosition =
        payload.position ??
        Math.max(0, ...store.categories.map((c) => c.position)) + 1;
      const assessments = payload.assessments
        ? normalizedAssessments(payload)
        : defaultAssessmentsForNewModality();
      const category: Category = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        position: nextPosition,
        progressionTrack: payload.progressionTrack,
        ...(assessments ? { assessments } : {}),
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };

      if (isSupabaseOrganization(store.organization.id)) {
        const created = await createCategoryInDb(category);
        store.categories.push(created);
        auditLogService.record({
          action: "created",
          target: { type: "category", id: created.id, label: created.name },
          predicate: `criou a ${categoryNoun()} ${created.name}`,
        });
        return clone(created);
      }

      store.categories.push(category);
      auditLogService.record({
        action: "created",
        target: { type: "category", id: category.id, label: category.name },
        predicate: `criou a ${categoryNoun()} ${category.name}`,
      });
      return clone(category);
    });
  },

  update(id: Id, payload: UpdateCategory): Promise<Category> {
    return simulateWrite(async () => {
      const idx = store.categories.findIndex((c) => c.id === id);
      if (idx === -1 && !isSupabaseOrganization(store.organization.id)) throw notFoundError(NOT_FOUND);
      validateCategory(payload, { partial: true });
      if (payload.name !== undefined && isDuplicateName(payload.name, id)) {
        throw validationError([
          { field: "name", message: `Já existe uma ${categoryNoun()} com esse nome.` },
        ]);
      }

      let updated: Category;
      if (isSupabaseOrganization(store.organization.id)) {
        updated = await updateCategoryInDb(id, payload, store.organization.id);
        if (idx !== -1) {
          store.categories[idx] = updated;
        } else {
          store.categories.push(updated);
        }
      } else {
        const current = store.categories[idx];
        updated = {
          ...current,
          ...payload,
          name: payload.name !== undefined ? payload.name.trim() : current.name,
          ...(payload.assessments !== undefined ? { assessments: normalizedAssessments(payload) } : {}),
          updatedAt: nowIso(),
        };
        store.categories[idx] = updated;
      }

      const reset = payload.progressionTrack !== undefined ? resetMissingLevels(updated) : 0;
      const settings = store.organization.settings;
      if (
        settings?.modalitiesReviewed === false &&
        (payload.name !== undefined || payload.progressionTrack !== undefined)
      ) {
        store.organization.settings = { ...settings, modalitiesReviewed: true };
      }
      auditLogService.record({
        action: updated.status === "active" ? "updated" : "inactivated",
        target: { type: "category", id: updated.id, label: updated.name },
        predicate: `atualizou a ${categoryNoun()} ${updated.name}${reset > 0 ? ` (${plural(reset, "aluno voltou", "alunos voltaram")} ao primeiro nível da nova trilha)` : ""}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; categoria inativa nao e sugerida em novos servicos.
  remove(id: Id): Promise<void> {
    return simulateWrite(async () => {
      const idx = store.categories.findIndex((c) => c.id === id);
      if (idx === -1 && !isSupabaseOrganization(store.organization.id)) throw notFoundError(NOT_FOUND);
      const name = idx !== -1 ? store.categories[idx].name : "modalidade";

      if (isSupabaseOrganization(store.organization.id)) {
        await inactivateCategoryInDb(id, store.organization.id);
      }
      if (idx !== -1) {
        store.categories[idx] = {
          ...store.categories[idx],
          status: "inactive",
          updatedAt: nowIso(),
        };
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "category", id, label: name },
        predicate: `inativou a ${categoryNoun()} ${name}`,
      });
    });
  },
};

/**
 * Alunos da modalidade num nivel que a trilha nova nao tem: voltam ao 1o
 * nivel da idade, sem grau. Grau acima do maximo do nivel cai para o maximo.
 * Devolve quantos voltaram.
 */
function resetMissingLevels(category: Category): number {
  const track = resolveModalityTrack(category);
  if (!track.enabled || track.levels.length === 0) return 0;
  const today = format(new Date(), "yyyy-MM-dd");
  let reset = 0;
  for (const client of store.clients) {
    const progression = client.progressions?.[category.id];
    if (!progression) continue;
    const level = track.levels.find((l) => l.id === progression.levelId || l.name === progression.levelName);
    if (level) {
      const max = level.maxSubLevels ?? 0;
      if (progression.subLevel > max) progression.subLevel = max;
      continue;
    }
    const first = firstLevelForAge(track, client.birthDate, today) ?? track.levels[0];
    progression.levelId = first.id;
    progression.levelName = first.name;
    progression.levelColor = first.color;
    progression.subLevel = 0;
    progression.maxSubLevels = first.maxSubLevels;
    progression.updatedAt = nowIso();
    reset += 1;
  }
  return reset;
}
