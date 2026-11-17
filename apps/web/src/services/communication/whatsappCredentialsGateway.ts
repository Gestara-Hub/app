import type { WhatsAppOnboarding } from "@gestarahub/contracts";
import type { WhatsAppConfig } from "@/lib/whatsapp";

/**
 * Ponte para as credenciais do WhatsApp de cada espaco (doc technical/07
 * §1.1). Quem fala com o Vault e com a Meta e o servidor
 * (`whatsappCredentials.ts`, registrado por `runWorld`); no navegador e nos
 * testes a ponte fica vazia e o envio segue o caminho antigo.
 */

export interface ConnectWhatsAppInput {
  organizationId: string;
  code: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
  onboarding: WhatsAppOnboarding;
}

/** O numero confirmado pela Meta depois de conectar. */
export interface ConnectedWhatsAppNumber {
  displayPhoneNumber?: string;
  verifiedName?: string;
}

export interface WhatsAppCredentialsGateway {
  /** Troca o codigo pelo token, guarda as credenciais, registra o numero e inscreve os avisos. */
  connect(input: ConnectWhatsAppInput): Promise<ConnectedWhatsAppNumber>;
  /** Cancela os avisos na conta do espaco e apaga as credenciais. */
  disconnect(organizationId: string): Promise<void>;
  /** Configuracao da Meta do espaco (token, id do numero e da conta), ou null sem credencial. */
  configFor(organizationId: string): Promise<Partial<WhatsAppConfig> | null>;
}

let gateway: WhatsAppCredentialsGateway | null = null;

export function setWhatsAppCredentialsGateway(next: WhatsAppCredentialsGateway | null): void {
  gateway = next;
}

export function getWhatsAppCredentialsGateway(): WhatsAppCredentialsGateway | null {
  return gateway;
}

/**
 * Sem credencial do espaco, vale o numero do ambiente (`WHATSAPP_*`)? So fora
 * de producao (numero de testes da Meta) e no servidor do e2e. Em producao,
 * nunca: as mensagens sairiam pelo numero da plataforma.
 */
export function platformNumberFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.E2E_NOW);
}

/** O cadastro guiado da Meta esta configurado (app e configuracao do cadastro). */
export function metaSignupConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_APP_ID?.trim() && process.env.NEXT_PUBLIC_META_CONFIG_ID?.trim());
}
