/**
 * Botoes de simular pagamento ("Sandbox") so com o Asaas de testes. O padrao
 * do `ASAAS_API_URL` e o sandbox (lib/asaas); em producao ele aponta para a API
 * real e os botoes somem, na tela e no servidor.
 */
export function isAsaasSandboxUrl(apiUrl: string | undefined): boolean {
  return !apiUrl || apiUrl.includes("sandbox");
}

/** No servidor: le o `ASAAS_API_URL`. */
export function serverPaymentsTestMode(): boolean {
  return isAsaasSandboxUrl(process.env.ASAAS_API_URL);
}

/** No navegador: o mesmo valor, gravado no build pelo next.config. */
export function browserPaymentsTestMode(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_TEST_MODE === "1";
}
