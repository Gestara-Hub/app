import { requirePermission } from "@/features/auth/require-permission";
import { OnlinePaymentsView } from "@/features/online-payments";

// Abrir a subconta no Asaas pode passar de 20 s (25/11/2026): a acao da tela
// espera ate 2 minutos pela resposta com a chave, com folga para gravar.
export const maxDuration = 150;

export default async function OnlinePaymentsPage() {
  await requirePermission("finance:view", "/online-payments");
  return <OnlinePaymentsView />;
}
