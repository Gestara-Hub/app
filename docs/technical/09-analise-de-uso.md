# 09 — Análise de uso (PostHog)

Data: 2026-10-18.

> **Status:** 17/10/2026. Integração pronta no código (`apps/web/src/lib/analytics.ts`), com aviso de cookies. Só liga com a chave no ambiente **e** depois que a pessoa aceita. O dono está criando a conta no PostHog e a variável `NEXT_PUBLIC_POSTHOG_KEY`.

## Decisão

Usar o **PostHog** para entender como as pessoas usam a landing e o sistema: páginas visitadas, cliques (autocapture), mapa de calor, gravação de sessão e funis (ex.: landing → cadastro → configuração inicial → primeira turma).

Por que o PostHog:
- Junta numa ferramenta só o que o pedido cobre: onde clicam (mapa de calor), o que fazem (gravação) e onde desistem (funis).
- Plano grátis cobre a fase atual: 1 milhão de eventos e 5 mil gravações por mês.
- Máscara de texto e de campos na gravação, essencial com dados de alunos.

Alternativas avaliadas: **Microsoft Clarity** (grátis e sem limite de gravações, mas sem funis e eventos de produto); **Hotjar** (pago a partir de pouco volume); **Vercel Analytics** (só páginas, sem cliques nem gravação).

## Como está ligado

| Parte | Onde |
|---|---|
| Início (só com `NEXT_PUBLIC_POSTHOG_KEY` e aceite) | `lib/providers.tsx` chama `initAnalytics()`, que confere a escolha de cookies |
| Páginas (rotas do App Router) | `capture_pageview: "history_change"` |
| Identificação | `features/auth/session-provider.tsx`: `identifyUser` com **id, perfil e organização** (sem nome nem e-mail) |
| Sair | `components/layout/app-topbar.tsx`: "Sair" chama `resetAnalytics()` |
| Troca de usuário no mesmo navegador | `identifyUser` reinicia a identidade antes de identificar o novo |
| Eventos da landing (22/10/2026) | `trackEvent` em `lib/analytics.ts` (só envia com chave e aceite): `landing_signup_cta_clicked` (`placement`: `header`, `header_mobile`, `hero`, `segments`), `landing_showcase_tab_viewed` (`tab`), `landing_section_viewed` (`section: online_payments`, uma vez por visita) e `landing_signup_submitted` (`result`: o status do pedido do link, sem nome nem e-mail) |

## Privacidade

- O que se digita **nunca** é gravado (`maskAllInputs`).
- **Área logada**: todo texto fica oculto nas gravações (`data-analytics-mask` no `SidebarInset` de `app/(app)/layout.tsx`). O menu lateral fica visível (mostra onde clicam, sem dados de ninguém).
- Landing, login e configuração inicial aparecem sem máscara (não têm dados de alunos).
- A Política de privacidade (`/privacy`) cita a análise de uso e os cookies dela.
## Aviso de cookies (consentimento, LGPD)

- `components/shared/analytics-consent-banner.tsx`, no layout raiz (`app/layout.tsx`): aparece em todas as páginas até a pessoa escolher, e **só quando há chave** (sem chave, nem o aviso nem o PostHog: dev, testes e e2e seguem iguais).
- **Barra fixa na base da tela, largura toda** (padrão de mercado; 17/10/2026, o card pequeno no canto não chamava atenção). Desktop: ícone de cookie e texto à esquerda, botões à direita; celular: texto em cima e os dois botões lado a lado embaixo. Respeita a área segura do iPhone. Fica abaixo dos modais (z-40).
- Texto: **"Usamos cookies para melhorar sua experiência"** / *"Eles mostram como o site é usado. Nada do que você digita é gravado."* + link para a Política de privacidade. Botões **Recusar** e **Aceitar** do mesmo tamanho.
- Escolha guardada no navegador (`gestarahub:analytics-consent`: `granted` / `denied`; sem valor = aviso), em `lib/analytics-consent.ts`.
- **Aceitar** liga o PostHog na hora e identifica quem já está logado. **Recusar** depois de aceitar para a captura (`opt_out_capturing`). Aceitar de novo retoma (inclusive se o PostHog guardou uma recusa antiga).
- **Rever a escolha:** botão *"Rever minha escolha de cookies"* na Política de privacidade (seção Cookies) apaga a resposta e o aviso volta.
- Regras cobertas em `lib/__tests__/analytics.test.ts`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Chave do projeto no PostHog. Vazia = nada é enviado (dev, testes, e2e). |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (padrão) ou `https://eu.i.posthog.com`. |

## Quando o backend chegar

Eventos de negócio importantes (conta criada, primeira turma, primeira cobrança paga) podem ser enviados pelo servidor, com o mesmo id do usuário, para os funis não dependerem do navegador.
