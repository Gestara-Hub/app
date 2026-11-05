# 10 — Monólito Frontend no Next.js com PWA (Gestor, Professor e Aluno)

Data: 2026-10-19.

> **Status:** Decidido em 19/10/2026. Substitui a ideia anterior de aplicativos móveis separados em React Native/Expo registrados em [06-passagem-backend.md](../archive/technical-06-passagem-backend.md) e [08-backend-supabase.md](08-backend-supabase.md).

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

## Como ficou a instalação (04/11/2026)

- **Manifest:** `apps/web/src/app/manifest.ts` (servido em `/manifest.webmanifest`). Abre em `/dashboard`, tela cheia (`standalone`), fundo e barra no chumbo da marca.
- **Ícones** em `apps/web/public/icons`, gerados de `src/assets/icon.svg`:
  - `icon-192/512`: quadrado com cantos arredondados e G em 80%, para o computador e o Android sem corte.
  - `icon-maskable-192/512`: quadrado cheio com o G em 72%, para caber no corte em círculo do Android (área segura de 80%: o ponto mais distante do G fica a 38,7% do lado, contra 40% de limite).
  - `apple-touch-icon.png` (180, sem transparência): o iPhone só aceita PNG e arredonda sozinho, G em 80%.
- **Metadados** em `app/layout.tsx`: ícone do iPhone, `appleWebApp` (abre sem a barra do Safari) e a cor da barra do sistema por tema.
- **Ainda não feito:** service worker de cache e tela offline. O Chrome instala sem ele. Os outros recursos estão em "Recursos do PWA para depois".
- Ao trocar o ícone, gerar os PNGs de novo a partir do SVG e conferir nos três cortes (quadrado do iPhone, círculo e gota do Android).

### Sugestão de instalação (04/11/2026)

Quem usa pelo navegador, no celular ou no computador, vê o cartão "Instale o GestaraHub" no rodapé da tela (`components/layout/install-app-prompt.tsx`; regras em `lib/install-prompt.ts`, com teste).

- **Chrome, Edge e Samsung:** o botão "Instalar" abre a janela de instalação do próprio navegador. A faixa automática do Chrome fica desligada.
- **iPhone e iPad:** não existe botão de instalar. "Como instalar" mostra os dois passos: Compartilhar e "Adicionar à Tela de Início".
- **Safari do Mac:** mostra o caminho pelo menu Arquivo, "Adicionar ao Dock".
- **Firefox no computador ou app já instalado:** não aparece.
- **Quando:** uns segundos depois de abrir, com a tela livre, no máximo uma interrupção por acesso (a mesma regra da dica do menu da conta). Nunca na configuração inicial nem na demonstração.
- **"Agora não":** volta em 14 dias, e na terceira recusa para de sugerir. Fica guardado por aparelho, porque instalar é de cada celular ou computador.
- **Uso medido:** eventos `install_prompt_shown`, `install_prompt_dismissed`, `install_prompt_answered` e `app_installed`.

## Recursos do PWA para depois (anotado em 04/11/2026)

| Recurso | Uso no GestaraHub | iPhone | Android |
| --- | --- | --- | --- |
| Notificação push | Aula amanhã, cobrança vencendo, faixa nova para o aluno; aula cancelada para o professor | Só com o app instalado (iOS 16.4+) | Sim |
| Número no ícone | Cobranças em atraso ou lembretes pendentes | Instalado | Maioria dos aparelhos |
| Atalhos no ícone (manifest `shortcuts`) | Segurar o ícone e ir para "Fazer chamada", "Novo aluno", "Cobranças" | Não | Sim |
| Sem internet | Abrir o app e fazer a chamada sem sinal, enviando ao voltar a conexão | Parcial (sem sincronizar em segundo plano) | Sim |
| Compartilhar (Web Share) | Recibo e PDF de relatório direto para o WhatsApp do aluno | Sim | Sim |
| Câmera | QR code de presença na entrada; foto do comprovante | Sim | Sim |
| Tela sempre acesa (Wake Lock) | Durante a chamada ou o cronômetro da aula | Sim | Sim |
| Vibrar | Confirmar a presença marcada | Não | Sim |
| Receber compartilhamento (`share_target`) | Aparecer no "Compartilhar com" do celular para anexar comprovante | Não | Sim |

Ordem sugerida: atalhos no ícone (barato), push para aluno e professor (junto com a área do aluno; pode trocar parte dos lembretes pagos do WhatsApp), compartilhar recibo e relatório, chamada sem internet (o mais trabalhoso: guardar e reenviar sem duplicar). O check-in por QR code muda a regra de presença (hoje quem marca é o professor) e pede decisão de produto antes.

Cuidados do iPhone: sem botão de instalar, push só instalado, e o sistema pode apagar dados de app pouco usado (a chamada sem internet precisa enviar assim que der).

## Alternativas Rejeitadas

- **React Native / Expo separado:** Descartado por demandar manutenção de pipelines nativas, contas pagas de desenvolvedor (Apple e Google) e sincronização redundante de contratos de API.
- **Repositórios ou apps web separados (Micro-frontends):** Descartado para evitar fragmentação de autenticação, duplicação de design system e complexidade de deploys.
