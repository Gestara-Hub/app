"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

/**
 * Providers globais da aplicacao, montados uma unica vez no root layout.
 *
 * - QueryClient: instanciado por arvore de cliente (useState), nunca no escopo
 *   de modulo, para nao compartilhar cache entre requisicoes. `retry: false`
 *   para que o erro simulado (ApiError NETWORK) da camada mock apareca de
 *   imediato no estado de erro, sem novas tentativas.
 * - ThemeProvider (next-themes): modo claro e o padrao do MVP; o escuro fica
 *   preparado pelas variaveis `.dark` do globals.css.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
