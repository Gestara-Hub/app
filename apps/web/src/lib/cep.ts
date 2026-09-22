export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export interface CepAddressResult {
  postalCode: string;
  street: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Busca endereço pelo CEP via ViaCEP de forma resiliente.
 * Não lança exceção em erro de rede/timeout; retorna null para permitir preenchimento manual.
 */
export async function fetchAddressByCep(
  cep: string,
): Promise<CepAddressResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) return null;

    return {
      postalCode: digits,
      street: data.logradouro || "",
      complement: data.complemento || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
