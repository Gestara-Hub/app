"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth";
import { queryKeys } from "@/lib/queryKeys";
import { auditLogService } from "@/services/auditLogService";
import type { AuditLogFilter } from "@gestarahub/contracts";

/**
 * Log de auditoria visivel para o usuario logado. O perfil do espectador entra
 * na queryKey e na chamada do service — a visibilidade das entradas varia por
 * perfil (ver auditLogService.canView).
 */
export function useAuditLog(filter?: AuditLogFilter) {
  const viewer = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.audit.list(filter, viewer.profile),
    queryFn: () => auditLogService.list(filter, viewer.profile),
  });
}
