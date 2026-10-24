/**
 * Cookies e redirecionamento do Next em memoria, para rodar as actions de
 * verdade contra o Supabase local (sem navegador). Quem importa chama
 * os `vi.mock` no topo do arquivo de teste usando `headersMock` e `navigationMock`.
 */
// Em globalThis: `vi.resetModules()` recarrega este arquivo, e o teste e as actions precisam do mesmo pote.
const shared = globalThis as unknown as { __testJar?: Map<string, string>; __testHeaders?: Headers };
export const jar = (shared.__testJar ??= new Map<string, string>());
export const requestHeaders = (shared.__testHeaders ??= new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest" }));

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}

/** Use no topo do arquivo de teste: vi.mock("next/headers", () => headersMock()) e iguais. */
export function headersMock() {
  return {
    cookies: async () => ({
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
      set: (name: string | { name: string; value: string }, value?: string, options?: { maxAge?: number }) => {
        const key = typeof name === "string" ? name : name.name;
        const val = typeof name === "string" ? (value ?? "") : name.value;
        if (options?.maxAge === 0 || val === "") jar.delete(key);
        else jar.set(key, val);
      },
      delete: (name: string) => jar.delete(name),
    }),
    headers: async () => requestHeaders,
  };
}

export function navigationMock() {
  return {
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  };
}

export async function redirectedTo(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    // Pelo texto: o teste e as actions podem ter copias diferentes da classe.
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) return error.message.slice("REDIRECT:".length);
    throw error;
  }
  return undefined;
}
