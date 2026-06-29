"use client";

import {
  EntityManagerDialog,
  type EntityManagerLabels,
} from "@/components/shared/entity-manager-dialog";
import { ORG_ID } from "@/config/tenant";
import type { Role } from "@/types";
import {
  useCreateRole,
  useInactivateRole,
  useRoles,
  useUpdateRole,
} from "../hooks/use-roles";

const labels: EntityManagerLabels = {
  title: "Cargos",
  description: "Cadastre e gerencie os cargos da equipe.",
  nameLabel: "Nome do cargo",
  namePlaceholder: "Ex.: Barbeiro",
  nameRequired: "Informe o nome do cargo.",
  createButton: "Criar cargo",
  empty: "Nenhum cargo cadastrado ainda.",
  actionsTitle: "Ações do cargo",
  editAriaLabel: "Editar nome do cargo",
  loadError: "Não foi possível carregar os cargos.",
  createdToast: "Cargo criado com sucesso.",
  updatedToast: "Cargo atualizado com sucesso.",
  inactivatedToast: "Cargo inativado.",
  reactivatedToast: "Cargo reativado.",
  saveError: "Não foi possível salvar o cargo.",
  inactivateError: "Não foi possível inativar o cargo.",
  reactivateError: "Não foi possível reativar o cargo.",
};

interface RoleManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Gestao de cargos (Equipe) — wrapper sobre o EntityManagerDialog. */
export function RoleManagerDialog({ open, onOpenChange }: RoleManagerDialogProps) {
  return (
    <EntityManagerDialog<Role>
      open={open}
      onOpenChange={onOpenChange}
      organizationId={ORG_ID}
      labels={labels}
      useList={useRoles}
      useCreate={useCreateRole}
      useUpdate={useUpdateRole}
      useInactivate={useInactivateRole}
    />
  );
}
