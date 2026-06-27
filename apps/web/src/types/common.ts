// Shared contract types (see docs/frontend/02-camada-de-dados-mock.md).

export type Id = string
export type DateTimeISO = string // e.g.: '2026-06-26T18:00:00.000Z'

export type RecordStatus = 'active' | 'inactive'

// Simulated error from the mock layer, in the shape of an API error.
export type ApiErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'NETWORK_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  fields?: Record<string, string> // per-field errors (validation)
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e
}
