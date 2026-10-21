"use client";

import type { ProfessionalView } from "@gestarahub/contracts";
import { ProfessionalFormDrawer } from "./professional-form-drawer";

export interface ProfessionalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional?: ProfessionalView;
}

/**
 * @deprecated Use ProfessionalFormDrawer diretamente.
 */
export function ProfessionalFormDialog(props: ProfessionalFormDialogProps) {
  return <ProfessionalFormDrawer {...props} />;
}

