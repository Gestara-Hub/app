import type { AsaasInvoiceService, AsaasInvoiceTaxes } from "./types";

/**
 * Parametros fiscais da NFS-e do Plano GestaraHub (doc technical/24 §7.1),
 * definidos com a contabilidade em 22/11/2026: Portal Nacional, item 01.03 da
 * LC 116, Simples Nacional (so o ISS, 2,01%, sem retencao; PIS, COFINS, CSLL,
 * IR e INSS zerados). Sem as variaveis, a emissao fica desligada e nada muda
 * para quem assina.
 */
export interface AsaasNfseConfig {
  service: AsaasInvoiceService;
  taxes: AsaasInvoiceTaxes;
}

const rate = (name: string): number => {
  const raw = process.env[name]?.trim().replace(",", ".");
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

const text = (name: string): string | undefined => process.env[name]?.trim() || undefined;

export function getAsaasNfseConfig(): AsaasNfseConfig | null {
  const serviceId = text("ASAAS_NFSE_SERVICE_ID");
  const serviceCode = text("ASAAS_NFSE_SERVICE_CODE");
  const serviceName = text("ASAAS_NFSE_SERVICE_NAME");
  // O ISS e obrigatorio na nota; sem ele (ou sem servico), a emissao fica desligada.
  if (!text("ASAAS_NFSE_ISS") || !(serviceId || serviceCode || serviceName)) return null;

  const federalServiceTaxCode = text("ASAAS_NFSE_FEDERAL_CODE");
  const nbsCode = text("ASAAS_NFSE_NBS");
  return {
    // O Asaas recusa o id junto com o par codigo + nome: um ou outro.
    service: serviceId
      ? { municipalServiceId: serviceId, municipalServiceName: serviceName ?? "" }
      : { municipalServiceCode: serviceCode, municipalServiceName: serviceName ?? serviceCode ?? "" },
    taxes: {
      retainIss: text("ASAAS_NFSE_RETAIN_ISS") === "true",
      iss: rate("ASAAS_NFSE_ISS"),
      pis: rate("ASAAS_NFSE_PIS"),
      cofins: rate("ASAAS_NFSE_COFINS"),
      csll: rate("ASAAS_NFSE_CSLL"),
      inss: rate("ASAAS_NFSE_INSS"),
      ir: rate("ASAAS_NFSE_IR"),
      ...(federalServiceTaxCode ? { federalServiceTaxCode } : {}),
      ...(nbsCode ? { nbsCode } : {}),
    },
  };
}
