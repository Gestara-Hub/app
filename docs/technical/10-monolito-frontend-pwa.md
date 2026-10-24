# 10 — Monólito Frontend no Next.js com PWA (Gestor, Professor e Aluno)

Data: 2026-10-19.

> **Status:** Decidido em 19/10/2026. Substitui a ideia anterior de aplicativos móveis separados em React Native/Expo registrados em [06-passagem-backend.md](06-passagem-backend.md) e [08-backend-supabase.md](08-backend-supabase.md).

## Decisão

1. **Monólito Frontend em `apps/web`:** Toda a experiência do GestaraHub fica centralizada em uma única aplicação Next.js (App Router), responsável pelas três visões do sistema:
   - **Painel do Gestor/Administrador:** operação completa desktop e mobile.
   - **Área do Professor:** chamada, presenças, avaliações/graduações e acompanhamento de turmas.
   - **Área do Aluno:** frequência, evolução/graduação, grade de horários, reservas e financeiro/mensalidades.
2. **Distribuição Mobile via PWA (Progressive Web App):**
   - Não haverá aplicativos nativos em React Native ou Expo no MVP.
   - Os portais do aluno e do professor são construídos com design mobile-first e distribuídos como **PWA instalável** na tela de início (iOS Safari / Android Chrome).
3. **Backend-for-Frontend (BFF) com Server Actions:**
   - O Next.js (`apps/web`) hospeda no servidor as Server Actions (`"use server"`), orquestrando sessões, validação de tokens e integrações seguras (ex.: MailerSend), rodando como Serverless Functions na Vercel.
   - O banco de dados Postgres, Row Level Security (RLS), Supabase Auth e Storage vivem em **`apps/supabase`**.

## Contexto

- **Velocidade de iteração e agilidade:** Manter bases de código separadas (Web Next.js + App React Native) triplicaria o esforço de engenharia e atrasaria a validação do produto com os primeiros clientes.
- **Sem taxas nem aprovação de lojas:** Com PWA, novas funcionalidades e correções de bugs entram em produção no mesmo instante (via deploy na Vercel), sem passar pela burocracia, atrasos e taxas de 15% a 30% da Apple App Store e Google Play Store.
- **Stack 100% unificada:** Componentes de UI (Tailwind CSS, shadcn/ui, Radix), contratos (`packages/contracts`) e regras puras (`packages/core`) são compartilhados nativamente dentro de um único projeto.

## Escopo

- Configuração de `manifest.json`, service worker de cache e metadados de instalação PWA em `apps/web`.
- Roteamento e layouts dedicados dentro de `apps/web/src/app` para o perfil de aluno e professor.
- Controle de acesso e guardas de rota baseados em permissões (`requirePermission`, `can`) já estabelecidos no projeto.

## Alternativas Rejeitadas

- **React Native / Expo separado:** Descartado por demandar manutenção de pipelines nativas, contas pagas de desenvolvedor (Apple e Google) e sincronização redundante de contratos de API.
- **Repositórios ou apps web separados (Micro-frontends):** Descartado para evitar fragmentação de autenticação, duplicação de design system e complexidade de deploys.
