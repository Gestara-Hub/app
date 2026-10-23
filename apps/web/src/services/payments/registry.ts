import type { PaymentGateway } from "./types";
import { mockPaymentGateway } from "./adapters/mockAdapter";
import { asaasPaymentGateway } from "./adapters/asaasAdapter";
import { logWarn } from "@/lib/log";

/**
 * Registro de Gateways de Pagamento (Hexagonal Architecture / Adapters Registry).
 * Para adicionar um novo gateway (ex: PagBank, Mercado Pago, Iugu):
 * 1. Crie o adaptador em `adapters/<nome>Adapter.ts` implementando o contrato `PaymentGateway`.
 * 2. Registre o adaptador neste mapa.
 */
const GATEWAY_REGISTRY: Record<string, PaymentGateway> = {
  asaas: asaasPaymentGateway,
  mock: mockPaymentGateway,
};

/**
 * Obtém a instância do gateway de pagamento ativo.
 * - Se `provider` for informado (ex: salvo na organização), busca o adapter correspondente.
 * - Caso contrário, usa "asaas" se houver ASAAS_API_KEY no ambiente ou fallback para "mock".
 */
export function getPaymentGateway(provider?: string): PaymentGateway {
  const defaultProvider = process.env.ASAAS_API_KEY ? "asaas" : "mock";
  const selectedKey = (provider || defaultProvider).toLowerCase();

  const gateway = GATEWAY_REGISTRY[selectedKey];
  if (!gateway) {
    logWarn(
      `[PaymentGatewayRegistry] Gateway "${provider}" não encontrado. Utilizando fallback "mock".`,
    );
    return mockPaymentGateway;
  }

  return gateway;
}
