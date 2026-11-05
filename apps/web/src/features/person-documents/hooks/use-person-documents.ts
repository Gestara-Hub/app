"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  CreatePersonDocument,
  Id,
  PersonDocumentOwnerKind,
  UpdatePersonDocument,
} from "@gestarahub/contracts";
import { queryKeys } from "@/lib/queryKeys";
import { personDocumentsService } from "@/services/personDocuments";

/** Documentos mudam a ficha, o sino (vencimentos) e a auditoria. */
function invalidateDocuments(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.personDocuments.all });
  qc.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function usePersonDocuments(ownerKind: PersonDocumentOwnerKind, ownerId: Id | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.personDocuments.owner(ownerKind, ownerId ?? ""),
    queryFn: () => personDocumentsService.list(ownerKind, ownerId ?? ""),
    enabled: Boolean(ownerId) && enabled,
  });
}

/** Vencendo e vencidos que a pessoa pode ver (sino e topo da ficha). */
export function useExpiringDocuments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.personDocuments.expiring,
    queryFn: () => personDocumentsService.listExpiring(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Grava o documento; o arquivo ja subiu no formulario, ao ser escolhido. */
export function useCreatePersonDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePersonDocument) => personDocumentsService.create(payload),
    onSuccess: () => invalidateDocuments(qc),
  });
}

export function useUpdatePersonDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: UpdatePersonDocument }) => personDocumentsService.update(id, payload),
    onSuccess: () => invalidateDocuments(qc),
  });
}

export function useRemovePersonDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => personDocumentsService.remove(id),
    onSuccess: () => invalidateDocuments(qc),
  });
}
