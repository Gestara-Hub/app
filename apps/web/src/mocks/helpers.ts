import type { ApiError, ApiErrorCode } from '@/types/common'

// Latencia simulada da "rede" mockada.
const LATENCY_MS = 350

export function sleep(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let seq = 0
export function generateId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq.toString().padStart(4, '0')}`
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
): ApiError {
  return { code, message, fields }
}

export function now(): string {
  return new Date().toISOString()
}
