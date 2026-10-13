/** Unidades federativas do Brasil (select de UF dos enderecos). */
export const BRAZIL_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AM", name: "Amazonas" },
  { uf: "AP", name: "Amapá" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "PR", name: "Paraná" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SE", name: "Sergipe" },
  { uf: "SP", name: "São Paulo" },
  { uf: "TO", name: "Tocantins" },
] as const;

const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Valor salvo -> UF do select: aceita a sigla em qualquer caixa ("sp") ou o
 * nome ("São Paulo"). Texto que nao e estado vira "" (cadastros antigos, de
 * quando a UF era digitada).
 */
export function normalizeStateUf(value: string | null | undefined): string {
  const text = plain(value ?? "");
  if (!text) return "";
  const match = BRAZIL_STATES.find((s) => s.uf.toLowerCase() === text || plain(s.name) === text);
  return match?.uf ?? "";
}
