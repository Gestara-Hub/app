"use client";

import { useState, type ReactNode, useEffect } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { initAnalytics } from "@/lib/analytics";
import { reapplySavedTheme } from "@/lib/theme-accent";
import { toast } from "@/lib/toast";
import { highlightIdOf, highlightRecord, type HighlightMeta } from "@/lib/record-highlight";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { queryKeys } from "./queryKeys";
import { useRefetchOnStoreChange } from "./use-refetch-on-store-change";

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
/** Fora do Painel, os lembretes se releem no maximo uma vez neste intervalo apos gravacoes. */
const REMINDERS_REFRESH_MS = 60_000;

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (data, variables, _context, mutation) => {
        // Item salvo pisca na lista (lib/record-highlight): so as mutacoes marcadas.
        highlightRecord(highlightIdOf(mutation.meta?.highlight as HighlightMeta | undefined, data, variables));
        void client.invalidateQueries({ queryKey: queryKeys.audit.all });
        // Lembretes (doc product/25): pagar, vender pacote, marcar presenca,
        // mandar mensagem... quase toda escrita muda a lista. O sino fica montado
        // em toda tela, entao reler a cada gravacao enfileirava uma leitura pesada
        // (cobrancas, alunos, 120 dias de presenca) atras de cada clique na
        // chamada (11/11/2026). Agora: no Painel rele na hora (a lista esta na
        // tela); fora dele, no maximo uma vez por minuto, e o sino rele ao abrir.
        // A lista e o resumo do sino (12/11/2026) contam juntos: vale a leitura mais recente.
        const lastRead = Math.max(
          0,
          ...client
            .getQueryCache()
            .findAll({ queryKey: queryKeys.communication.reminders })
            .map((query) => query.state.dataUpdatedAt),
        );
        const onDashboard = typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");
        const fresh = lastRead > 0 && Date.now() - lastRead < REMINDERS_REFRESH_MS;
        void client.invalidateQueries({
          queryKey: queryKeys.communication.reminders,
          refetchType: onDashboard || !fresh ? "active" : "none",
        });
        // Marcos do "Descubra o dia a dia" e passos da configuracao inicial viram
        // "Feito" na hora (refaz so se montado). Com tudo feito, nao rele mais:
        // cada releitura carrega o espaco inteiro no servidor (doc 19, fase 1).
        const discovery = client.getQueryData<Record<string, unknown>>(queryKeys.onboarding.discovery);
        const discoveryDone =
          discovery !== undefined &&
          Object.entries(discovery).every(([key, value]) => key === "enrollClassGroupId" || value === true);
        if (!discoveryDone) void client.invalidateQueries({ queryKey: queryKeys.onboarding.discovery });
        if (client.getQueryData(queryKeys.onboarding.setupDone) !== true) {
          void client.invalidateQueries({ queryKey: queryKeys.onboarding.snapshot });
        }
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
 * - ThemeProvider (next-themes): modo escuro e o padrao do sistema; o claro
 *   continua disponivel no seletor de tema.
 */
/**
 * O script do tema roda so no HTML do servidor, antes da pintura. No navegador
 * ele nunca executa; como dado (`application/json`), o React nao avisa de
 * `<script>` dentro de componente se tiver de recriar a arvore (achado 75).
 * O next-themes ja marca o script com `suppressHydrationWarning`.
 */
const THEME_SCRIPT_PROPS = typeof window === "undefined" ? undefined : { type: "application/json" };

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useRefetchOnStoreChange(queryClient);
  // Analise de uso (PostHog); sem a chave no ambiente, nao liga.
  useEffect(() => initAnalytics(), []);
  // Tema salvo de volta no <html> depois de montar (hidratacao refeita o perde).
  useEffect(() => reapplySavedTheme(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        storageKey="gestarahub:theme"
        enableSystem
        disableTransitionOnChange
        scriptProps={THEME_SCRIPT_PROPS}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
