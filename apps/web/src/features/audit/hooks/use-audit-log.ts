"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth";
import { queryKeys } from "@/lib/queryKeys";
import { AUDIT_PAGE_SIZE, auditLogService } from "@/services/audit/auditLogService";
import type { AuditLogFilter } from "@gestarahub/contracts";

/**
 * Log de auditoria visivel para o usuario logado, uma pagina por vez (doc 19,
 * fase 3: filtros e paginacao no banco). O perfil do espectador entra na
 * queryKey; na conta real, o servidor usa o perfil da sessao.
 */
export function useAuditLog(filter?: AuditLogFilter) {
  const viewer = useCurrentUser();
  return useInfiniteQuery({
    queryKey: queryKeys.audit.list(filter, viewer.profile),
    queryFn: ({ pageParam }) => auditLogService.listPage(filter, viewer.profile, pageParam, AUDIT_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}
