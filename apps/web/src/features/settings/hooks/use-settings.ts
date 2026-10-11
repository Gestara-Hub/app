"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getSegmentPreset,
  type BusinessSegmentPreset,
  type SegmentVocabulary,
} from "@/lib/business-segment-presets";
import { queryKeys } from "@/lib/queryKeys";
import {
  settingsService,
  type UpdateOrganization,
  type UpdateUnit,
} from "@/services/settingsService";

export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization.detail,
    queryFn: () => settingsService.getOrganization(),
  });
}

/**
 * Perfil da area do tenant (padroes de turma e vocabulario). Enquanto a
 * organizacao carrega, usa o padrao (lutas), igual a tenants sem area salva.
 */
export function useBusinessSegment(): BusinessSegmentPreset {
  const { data: organization } = useOrganization();
  return getSegmentPreset(organization?.classSegment);
}

/** Atalho para as palavras da area ("Faixa" ou "Nível", "Graduar" ou "Avançar"). */
export function useSegmentVocabulary(): SegmentVocabulary {
  return useBusinessSegment().vocabulary;
}

export function useUnit() {
  return useQuery({
    queryKey: queryKeys.unit.detail,
    queryFn: () => settingsService.getUnit(),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrganization) =>
      settingsService.updateOrganization(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
      // Trocar a area reescreve os modelos de mensagem ainda no texto padrao.
      if (payload.classSegment !== undefined) {
        qc.invalidateQueries({ queryKey: queryKeys.communication.templates });
      }
    },
  });
}

export function useMarkModalitiesReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settingsService.markModalitiesReviewed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.organization.detail }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUnit) => settingsService.updateUnit(payload),
    // businessHours afeta a disponibilidade da Agenda — invalida tudo de leitura.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.unit.detail });
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
  });
}
