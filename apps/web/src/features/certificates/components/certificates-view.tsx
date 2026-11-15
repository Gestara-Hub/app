"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useBeforeUnloadGuard, useLeaveLinkGuard } from "@/lib/unsaved-changes";
import { CertificateTemplateCard } from "./certificate-template-card";

/**
 * Tela de Certificados (Gestão -> Estrutura do Negócio): configura o modelo dos
 * certificados de conclusão de curso e de graduação, com guarda de alterações
 * não salvas ao sair da página.
 */
export function CertificatesView() {
  const [dirty, setDirty] = useState(false);
  useBeforeUnloadGuard(dirty);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const askLeave = useCallback(
    () =>
      confirm({
        title: "Sair sem salvar?",
        description: "As alterações não salvas desta tela serão perdidas.",
        confirmLabel: "Sair sem salvar",
        cancelLabel: "Continuar editando",
        highlightAction: "cancel",
      }),
    [confirm],
  );
  useLeaveLinkGuard(dirty, askLeave);

  return (
    <>
      <PageHeader
        title="Certificados"
        description="Modelo dos certificados de conclusão dos cursos e de graduação."
      />
      <CertificateTemplateCard onDirtyChange={setDirty} />
      {confirmDialog}
    </>
  );
}
