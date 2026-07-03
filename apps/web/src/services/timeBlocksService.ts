import type {
  CreateTimeBlock,
  Id,
  TimeBlock,
  TimeBlockFilter,
  UpdateTimeBlock,
} from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { timeToMinutes } from "@gestarahub/core/scheduling";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const NOT_FOUND = "Bloqueio não encontrado.";

function validateBlock(
  payload: Partial<CreateTimeBlock>,
  { partial }: { partial: boolean },
): void {
  const fields = [];
  const has = (key: keyof CreateTimeBlock) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has("professionalId")) {
    if (!payload.professionalId) {
      fields.push({ field: "professionalId", message: "Selecione um profissional." });
    }
  }
  if (!partial || has("date")) {
    if (!payload.date) fields.push({ field: "date", message: "Selecione a data." });
  }
  if (
    payload.start !== undefined &&
    payload.end !== undefined &&
    timeToMinutes(payload.start) >= timeToMinutes(payload.end)
  ) {
    fields.push({ field: "end", message: "O horário de início deve ser anterior ao de fim." });
  }
  if (fields.length > 0) throw validationError(fields);
}

export const timeBlocksService = {
  list(filter?: TimeBlockFilter): Promise<TimeBlock[]> {
    return simulateRead(() => {
      let result = store.timeBlocks;
      if (filter?.dateFrom) result = result.filter((b) => b.date >= filter.dateFrom!);
      if (filter?.dateTo) result = result.filter((b) => b.date <= filter.dateTo!);
      if (filter?.professionalId) {
        result = result.filter((b) => b.professionalId === filter.professionalId);
      }
      const sorted = [...result].sort(
        (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      );
      return clone(sorted);
    });
  },

  create(payload: CreateTimeBlock): Promise<TimeBlock> {
    return simulateWrite(() => {
      validateBlock(payload, { partial: false });
      const ts = nowIso();
      const block: TimeBlock = {
        id: newId(),
        organizationId: payload.organizationId ?? store.organization.id,
        unitId: payload.unitId ?? store.unit.id,
        professionalId: payload.professionalId,
        date: payload.date,
        start: payload.start,
        end: payload.end,
        reason: payload.reason?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
      };
      store.timeBlocks.push(block);
      return clone(block);
    });
  },

  update(id: Id, payload: UpdateTimeBlock): Promise<TimeBlock> {
    return simulateWrite(() => {
      const idx = store.timeBlocks.findIndex((b) => b.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      validateBlock(payload, { partial: true });
      store.timeBlocks[idx] = {
        ...store.timeBlocks[idx],
        ...payload,
        updatedAt: nowIso(),
      };
      return clone(store.timeBlocks[idx]);
    });
  },

  remove(id: Id): Promise<void> {
    return simulateWrite(() => {
      const idx = store.timeBlocks.findIndex((b) => b.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      store.timeBlocks.splice(idx, 1);
    });
  },
};
