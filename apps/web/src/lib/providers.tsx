"use client";

import { useState, type ReactNode } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { queryKeys } from "./queryKeys";

// Janela para o tratamento local (catch do mutateAsync ou onError do mutate)
// mostrar o proprio toast antes do fallback global.
const LOCAL_ERROR_GRACE_MS = 150;

// Ids dos toasts de erro ja emitidos (o historico do sonner guarda os criados).
function errorToastIds(): Set<string | number> {
  return new Set(
    toast
      .getHistory()
      .filter((t) => "type" in t && t.type === "error")
      .map((t) => t.id),
  );
}

/**
 * Fallback global de erro de mutacao: nenhuma falha fica silenciosa. Pula se a
 * mutacao tem `onError` proprio, se pediu `meta.silentError`, ou se o erro e de
 * validacao por campo (o form mostra inline). Para `mutateAsync` com try/catch
 * (ou `mutate(v, { onError })`, invisivel aqui), espera um instante e so mostra
 * o toast se o tratamento local nao mostrou nenhum toast de erro.
 */
function handleGlobalMutationError(
  error: unknown,
  mutation: { options: { onError?: unknown }; meta?: Record<string, unknown> },
): void {
  if (mutation.options.onError) return;
  if (mutation.meta?.silentError) return;
  const fields = getFieldErrors(error);
  if (fields && fields.length > 0) return;

  const before = errorToastIds();
  setTimeout(() => {
    const shownLocally = [...errorToastIds()].some((id) => !before.has(id));
    if (shownLocally) return;
    toast.error(getErrorMessage(error, "Não foi possível concluir a ação."));
  }, LOCAL_ERROR_GRACE_MS);
}

/**
 * Fabrica do QueryClient do app. `retry: false` para que o erro simulado
 * (ApiError NETWORK) da camada mock apareca de imediato no estado de erro. O
 * `mutationCache` invalida a auditoria apos QUALQUER mutacao bem-sucedida (toda
 * escrita pode gerar evento), marca o resto como stale e aplica o fallback
 * global de erro.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: queryKeys.audit.all });
        // Nomes embutidos em outras views (cliente/profissional em agendamento,
        // turma, cobranca): marca tudo como stale SEM refetch imediato; cada
        // tela rebusca ao montar de novo.
        void client.invalidateQueries({ refetchType: "none" });
      },
      onError: (error, _variables, _context, mutation) => {
        handleGlobalMutationError(error, mutation);
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
  return client;
}

/**
 * Providers globais da aplicacao, montados uma unica vez no root layout.
 *
 * - QueryClient: instanciado por arvore de cliente (useState), nunca no escopo
 *   de modulo, para nao compartilhar cache entre requisicoes. As telas logadas
 *   usam um QueryClient proprio por sessao (ver `SessionProvider`); este atende
 *   o que fica fora do app shell (login).
 * - ThemeProvider (next-themes): modo claro e o padrao do MVP; o escuro fica
 *   preparado pelas variaveis `.dark` do globals.css.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="gestarahub:theme"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
