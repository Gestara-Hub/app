"use client";

import {
  EntityManagerDialog,
  type EntityManagerLabels,
} from "@/components/shared/entity-manager-dialog";
import { ORG_ID } from "@/config/tenant";
import type { Category } from "@/types";
import {
  useCategories,
  useCreateCategory,
  useInactivateCategory,
  useUpdateCategory,
} from "../hooks/use-categories";

const labels: EntityManagerLabels = {
  title: "Categorias",
  description: "Cadastre e gerencie as categorias de serviço.",
  nameLabel: "Nome da categoria",
  namePlaceholder: "Ex.: Cabelo",
  nameRequired: "Informe o nome da categoria.",
  createButton: "Criar categoria",
  empty: "Nenhuma categoria cadastrada ainda.",
  actionsTitle: "Ações da categoria",
  editAriaLabel: "Editar nome da categoria",
  loadError: "Não foi possível carregar as categorias.",
  createdToast: "Categoria criada com sucesso.",
  updatedToast: "Categoria atualizada com sucesso.",
  inactivatedToast: "Categoria inativada.",
  reactivatedToast: "Categoria reativada.",
  saveError: "Não foi possível salvar a categoria.",
  inactivateError: "Não foi possível inativar a categoria.",
  reactivateError: "Não foi possível reativar a categoria.",
};

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Gestao de categorias (Servicos) — wrapper sobre o EntityManagerDialog. */
export function CategoryManagerDialog({
  open,
  onOpenChange,
}: CategoryManagerDialogProps) {
  return (
    <EntityManagerDialog<Category>
      open={open}
      onOpenChange={onOpenChange}
      organizationId={ORG_ID}
      labels={labels}
      useList={useCategories}
      useCreate={useCreateCategory}
      useUpdate={useUpdateCategory}
      useInactivate={useInactivateCategory}
    />
  );
}
