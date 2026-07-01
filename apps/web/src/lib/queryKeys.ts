import type {
  AppointmentFilter,
  CategoryFilter,
  ClientFilter,
  Id,
  ProfessionalFilter,
  RoleFilter,
  ServiceFilter,
  TimeBlockFilter,
  UserFilter,
} from "@/types";

/**
 * Convencao de queryKeys (hierarquia estavel):
 *  - [entity] para o namespace,
 *  - [entity, 'list', filter] para listas,
 *  - [entity, 'detail', id] para detalhe.
 * Filtros entram como objeto serializavel (o Query faz hash estrutural).
 */
export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (filter?: ClientFilter) => ["clients", "list", filter] as const,
    detail: (id: Id) => ["clients", "detail", id] as const,
  },
  professionals: {
    all: ["professionals"] as const,
    list: (filter?: ProfessionalFilter) =>
      ["professionals", "list", filter] as const,
    detail: (id: Id) => ["professionals", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filter?: UserFilter) => ["users", "list", filter] as const,
    detail: (id: Id) => ["users", "detail", id] as const,
  },
  services: {
    all: ["services"] as const,
    list: (filter?: ServiceFilter) => ["services", "list", filter] as const,
    detail: (id: Id) => ["services", "detail", id] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (filter?: CategoryFilter) => ["categories", "list", filter] as const,
    detail: (id: Id) => ["categories", "detail", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (filter?: RoleFilter) => ["roles", "list", filter] as const,
    detail: (id: Id) => ["roles", "detail", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    list: (filter?: AppointmentFilter) =>
      ["appointments", "list", filter] as const,
    detail: (id: Id) => ["appointments", "detail", id] as const,
    occurrences: (seriesId: Id) =>
      ["appointments", "series", seriesId] as const,
  },
  timeBlocks: {
    all: ["timeBlocks"] as const,
    list: (filter?: TimeBlockFilter) => ["timeBlocks", "list", filter] as const,
  },
  series: {
    detail: (id: Id) => ["series", "detail", id] as const,
  },
  organization: {
    detail: ["organization"] as const,
  },
  unit: {
    detail: ["unit"] as const,
  },
} as const;
