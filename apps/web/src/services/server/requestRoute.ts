import { headers } from "next/headers";

/**
 * Tela de onde a ação foi disparada (caminho do `Referer`, sem query), para o
 * registro de erros. Fora de uma requisição (rotina, teste), devolve nada.
 */
export async function requestRoute(): Promise<string | undefined> {
  try {
    const referer = (await headers()).get("referer");
    return referer ? new URL(referer).pathname : undefined;
  } catch {
    return undefined;
  }
}
