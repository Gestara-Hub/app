"use client";

import type { UserView } from "@gestarahub/contracts";
import { UserFormDrawer } from "./user-form-drawer";

export interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserView;
}

/**
 * @deprecated Use UserFormDrawer diretamente.
 */
export function UserFormDialog(props: UserFormDialogProps) {
  return <UserFormDrawer {...props} />;
}

