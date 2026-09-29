"use client";

import type { FinancialCategory, FinancialEntryType } from "@gestarahub/contracts";
import {
  EntityManagerDialog,
  type EntityManagerLabels,
} from "@/components/shared/entity-manager-dialog";
import { makeFinancialCategoryManagerHooks } from "../hooks/use-finance";

// Hooks estaveis por tipo (criados uma vez, fora do render).
const HOOKS: Record<FinancialEntryType, ReturnType<typeof makeFinancialCategoryManagerHooks>> = {
  income: makeFinancialCategoryManagerHooks("income"),
  expense: makeFinancialCategoryManagerHooks("expense"),
};

const SYSTEM_NOTE: Record<FinancialEntryType, string> = {
  income: "Mensalidades e Aulas avulsas são automáticas (vêm das cobranças dos alunos) e não aparecem aqui.",
  expense: "Professores é automática (vem do pagamento dos professores) e não aparece aqui.",
};

function labelsFor(type: FinancialEntryType): EntityManagerLabels {
  const noun = type === "income" ? "entrada" : "saída";
  return {
    title: type === "income" ? "Categorias de entrada" : "Categorias de saída",
    description: `Organize os lançamentos de ${noun} por categoria. ${SYSTEM_NOTE[type]}`,
    nameLabel: "Nome da categoria",
    namePlaceholder: "Informe o nome da categoria",
    nameRequired: "Informe o nome da categoria.",
    createButton: "Criar categoria",
    empty: "Nenhuma categoria cadastrada ainda.",
    actionsTitle: "Ações da categoria",
    editAriaLabel: "Editar nome da categoria",
    loadError: "Não foi possível carregar as categorias.",
    createdToast: "Categoria criada.",
    updatedToast: "Categoria atualizada.",
    inactivatedToast: "Categoria inativada.",
    reactivatedToast: "Categoria reativada.",
    saveError: "Não foi possível salvar a categoria.",
    inactivateError: "Não foi possível inativar a categoria.",
    reactivateError: "Não foi possível reativar a categoria.",
  };
}

/**
 * Categorias financeiras de um tipo, sobre o EntityManagerDialog. As de sistema
 * ficam fora da lista (travadas; o service tambem recusa alterar).
 */
export function FinancialCategoryManagerDialog({
  type,
  open,
  onOpenChange,
}: {
  type: FinancialEntryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current = type;
  const hooks = HOOKS[current];
  return (
    <EntityManagerDialog<FinancialCategory>
      key={current}
      open={open}
      onOpenChange={onOpenChange}
      labels={labelsFor(current)}
      storageKey={`financial-categories-${current}`}
      useList={hooks.useList}
      useCreate={hooks.useCreate}
      useUpdate={hooks.useUpdate}
      useInactivate={hooks.useInactivate}
    />
  );
}
