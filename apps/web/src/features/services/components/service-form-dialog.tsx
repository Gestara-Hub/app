"use client";

import type { Service } from "@gestarahub/contracts";
import { ServiceFormDrawer } from "./service-form-drawer";

export interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service;
}

/**
 * @deprecated Use ServiceFormDrawer diretamente.
 */
export function ServiceFormDialog(props: ServiceFormDialogProps) {
  return <ServiceFormDrawer {...props} />;
}

