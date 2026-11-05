# GestaraHub Docs

Este diretório guarda a especificação viva da arquitetura, produto e engenharia do GestaraHub.

> 🚀 **DIRETRIZ ATUAL DO MVP:**
> O primeiro ciclo de entrega do GestaraHub está focado no **Modelo 3 (Turmas & Aulas)**, com especialização no segmento de **Academias de Lutas / Artes Marciais (Jiu-Jitsu)**, validado diretamente no tatame através de um *design partner* real.
>
> A arquitetura segue rigorosamente:
> - **Código-fonte e Contratos 100% em Inglês neutro** (`level`, `guardian`, `roster`, `attendance`, `charge`).
> - **Interface do Usuário 100% em Português (`pt-BR`)**.
> - **Isolamento de Modelos Operacionais:** Modelos específicos não poluem a fundação universal nem misturam regras de negócio.

📌 **[Pendências registradas](pendencias.md):** tudo o que ficou combinado para depois (decidido e não implementado, esperando decisão, antes de produção).

## Mapa por assunto (modelo de turmas)

Procure o assunto aqui antes de escrever: se ele já tem doc, acrescente uma seção (regras em [`.claude/skills/docs`](../.claude/skills/docs/SKILL.md)). As tabelas por assunto abaixo valem para o modelo de turmas.

| Assunto | Regras (o quê e por quê) | Funcionamento (como é feito) | Onde está no código |
| --- | --- | --- | --- |
| Acesso e segurança | [product/06](product/06-perfis-permissoes.md) | [technical/17](technical/17-verificacao-em-duas-etapas.md) (duas etapas), [technical/11](technical/11-identidade-global-e-multi-membership.md) | `apps/web/src/lib/security`, `app/(auth)`, `lib/permissions.ts` |
| Configuração inicial | [frontend/08](frontend/08-decisoes-landing-page-e-onboarding.md) §4 | [frontend/08](frontend/08-decisoes-landing-page-e-onboarding.md) | `features/onboarding`, `services/settings` |
| Turmas e chamada | [product/11](product/11-modelo-3-turmas.md), [product/14](product/14-mvp-academia-lutas.md) | [technical/01](technical/01-extensao-modelos-operacionais.md) | `features/turmas`, `services/classes` |
| Alunos e acesso de alunos | [product/23](product/23-area-do-aluno-e-professor.md), [product/24](product/24-diretrizes-exclusao-e-lgpd.md) | [technical/13](technical/13-acesso-de-alunos-e-responsaveis.md) | `features/clients`, `services/clients` |
| Mensalidades e cobranças | [product/15](product/15-regras-de-cobranca.md), [product/20](product/20-plano-novas-formas-de-cobranca.md) | [technical/02](technical/02-motor-de-cobranca.md) | `packages/core/src/billing.ts`, `services/billing` |
| Pagamento online | [product/19](product/19-levantamento-pagamentos.md) | [technical/25](technical/25-pagamento-online.md), [guides/14](guides/14-asaas-mcp.md) | `features/online-payments`, `services/onlinePayments`, `services/payments`, `lib/asaas` |
| Plano GestaraHub | [product/13](product/13-modelo-de-negocio.md) (§6 troca de plano) | [technical/24](technical/24-plano-gestarahub.md) | `features/subscription`, `services/subscription`, `services/server/subscription*.ts` |
| Financeiro | [product/13](product/13-modelo-de-negocio.md) | [technical/05](technical/05-modulo-financeiro.md) | `features/finance`, `services/finance` |
| Relatórios e documentos | [product/21](product/21-ideias-certificados-e-notas.md) | [technical/18](technical/18-documentos-pdf.md) | `features/reports`, `lib/documents`, `app/api/documents` |
| Documentos da ficha (atestado, termo, CREF) | [product/28](product/28-documentos-da-ficha.md) | [product/28](product/28-documentos-da-ficha.md) §6 e §7 | `features/person-documents`, `services/personDocuments`, `packages/core/src/person-documents.ts` |
| Notas, testes e medidas | [product/21](product/21-ideias-certificados-e-notas.md) §2 | [product/21](product/21-ideias-certificados-e-notas.md) §2.2 a 2.4 | `packages/core/src/grades.ts`, `packages/core/src/measurements.ts`, `features/grades`, `features/measurements`, `services/grades`, `services/measurements` |
| Comunicação e lembretes | [product/25](product/25-lembretes-e-seguranca.md), [product/13](product/13-modelo-de-negocio.md) §5 | [technical/07](technical/07-integracao-whatsapp.md) | `features/communication`, `services/communication`, `lib/whatsapp` |
| Auditoria e registros | [technical/21](technical/21-registro-de-erros.md) | [technical/23](technical/23-historico-em-segundo-plano.md) | `features/audit`, `services/audit`, `lib/log` |
| Painel administrativo do GestaraHub | [technical/26](technical/26-painel-admin-gestarahub.md) | [technical/26](technical/26-painel-admin-gestarahub.md), [guides/21](guides/21-painel-admin-local.md) | `apps/admin`, `supabase/migrations/…platform_schema.sql` |
| Fuso | [technical/22](technical/22-fuso-do-espaco.md) | [technical/22](technical/22-fuso-do-espaco.md) | `packages/core/src/date.ts` |
| Desempenho | [technical/19](technical/19-desempenho-e-escala.md) | [technical/19](technical/19-desempenho-e-escala.md) | `services/world` |
| Testes | [technical/04](technical/04-estrategia-de-testes.md) | [guides/20](guides/20-tempo-dos-testes.md), [qa/](qa/2026-10-23-teste-geral.md) | `apps/web/e2e`, `**/__tests__` |
| Ambiente local | [guides/16](guides/16-ambiente-local.md) | [guides/16](guides/16-ambiente-local.md) | `apps/web/scripts`, `apps/supabase` |
| **Fora do foco** (agendamento e entrega) | os docs em "Módulos em Standby", como estão | | `features/appointments`, `features/services` |

---

## 1. Foco Ativo do MVP (Modelo 3 — Turmas & Academia)

1. [product/14-mvp-academia-lutas.md](product/14-mvp-academia-lutas.md) — **Foco ativo:** Especificação do MVP para academias de lutas, matriz de equivalência e extensibilidade.
2. [product/11-modelo-3-turmas.md](product/11-modelo-3-turmas.md) — Especificação técnica dev-ready do Modelo 3 (turmas, matrículas, sessões, presença, planos e cobranças).
3. [product/02-modelos-operacionais.md](product/02-modelos-operacionais.md) — Conceito estrutural de modelos operacionais (`scheduling` vs `classes` vs `delivery`).
4. [product/01-glossario.md](product/01-glossario.md) — Glossário dos termos do sistema.
5. [product/06-perfis-permissoes.md](product/06-perfis-permissoes.md) — Perfis de acesso e RBAC.
6. [product/15-regras-de-cobranca.md](product/15-regras-de-cobranca.md) — Regras de cobrança das mensalidades (antecipado/pós-pago, proporcional/mês cheio, vencimento). Substitui as regras de mensalidade do doc 11.
7. [product/26-pitch-gestarahub.md](product/26-pitch-gestarahub.md) — Pitch de negócio (problema, solução, exemplos, modelo de receita e visão de marketplace de parceiros). Base para a apresentação.
8. [product/18-pesquisa-dores-e-caminhos.md](product/18-pesquisa-dores-e-caminhos.md) — Pesquisa (com fontes) das dores de academias, salões e docerias e dos caminhos de expansão além do marketplace (pagamentos, WhatsApp, canal próprio de captação, crédito, app do aluno).
9. [product/19-levantamento-pagamentos.md](product/19-levantamento-pagamentos.md) — Levantamento dos três fluxos de dinheiro (assinatura do GestaraHub, mensagens do WhatsApp, mensalidade online com split) e dos provedores a validar.
10. [product/20-plano-novas-formas-de-cobranca.md](product/20-plano-novas-formas-de-cobranca.md) — Proposta: cobrança avulsa, curso fechado e pacote de aulas (fases A a D e decisões pendentes).
11. [product/21-ideias-certificados-e-notas.md](product/21-ideias-certificados-e-notas.md) — Ideias para refinar: gerador de certificados (Pro) e notas dos alunos (fase 1 entregue: avaliações na turma, lançamento e boletim; critério da trilha na fase 2).
12. [product/23-area-do-aluno-e-professor.md](product/23-area-do-aluno-e-professor.md) — **Área do Aluno e do Professor:** Mapeamento completo de funcionalidades e matriz de distribuição por plano (Grátis, Profissional e Expansão).
13. [product/24-diretrizes-exclusao-e-lgpd.md](product/24-diretrizes-exclusao-e-lgpd.md) — **Diretrizes de Exclusão e LGPD:** Enquadramento legal (BACEN, CTN, CLT, Marco Civil), travas de subconta, esteira de 3 fases, anonimização por papel (Dono, Aluno, Professor, Staff) e rotas públicas só com dados mascarados (§6).
14. [product/25-lembretes-e-seguranca.md](product/25-lembretes-e-seguranca.md) — **Lembretes inteligentes e aviso de segurança:** um motor de lembretes a partir dos modelos de mensagem (cobrança, pacote, faltas, aniversário, relacionamento, avisos), prioridade, sem repetir, adiar, envio em sequência, sino no topo; janela da verificação em duas etapas em quatro momentos.
15. [product/27-juridico-termos-e-identificacao.md](product/27-juridico-termos-e-identificacao.md) — **Jurídico (02/11/2026):** o que o site mostra de Termos, Privacidade, contrato de ativação e consentimento; identificação obrigatória da empresa (CNPJ, endereço, encarregado) e onde entra; lacunas dos textos; o que a Meta (opt-in, exclusão de dados) e o Asaas (conta PJ, homologação, confirmação anual) exigem.
16. [product/28-documentos-da-ficha.md](product/28-documentos-da-ficha.md) — **Documentos da ficha (04/11/2026):** atestado, termo, autorização de imagem e CREF na ficha do aluno e do instrutor; quem vê e mexe, validade com aviso no sino e no topo da ficha, dado de saúde (LGPD) e download pela rota que confere a turma.

---

## 2. Fundação Compartilhada (Técnica & Frontend)

### Técnico & Arquitetura
- [technical/00-decisoes-tecnicas.md](technical/00-decisoes-tecnicas.md) — Registro de decisões técnicas transversais (ADRs).
- [technical/01-extensao-modelos-operacionais.md](technical/01-extensao-modelos-operacionais.md) — Separação modular de modelos operacionais sem genericização prematura (Modelo 3 já implementado assim).
- [technical/02-motor-de-cobranca.md](technical/02-motor-de-cobranca.md) — Motor de cobrança único em `packages/core/src/billing.ts`.
- [technical/03-multi-tenant-e-escopo.md](technical/03-multi-tenant-e-escopo.md) — Mundo multi-tenant no mock, um modelo por tenant, escopo carimbado pelo servidor e sessão.
- [technical/04-estrategia-de-testes.md](technical/04-estrategia-de-testes.md) — `node --test` (motor), Vitest (services) e Playwright (e2e).
- [technical/05-modulo-financeiro.md](technical/05-modulo-financeiro.md) — Módulo Financeiro da academia: entradas e saídas e pagamento de professores. O plano GestaraHub está no doc 24 e o pagamento online no doc 25.
- [technical/07-integracao-whatsapp.md](technical/07-integracao-whatsapp.md) — Checklist da integração real com a API oficial do WhatsApp (conexão de cada espaço, modelos aprovados, avisos da Meta, consentimento, limites).
- [technical/08-backend-supabase.md](technical/08-backend-supabase.md) — **Decisão do backend:** Supabase (banco, login, Edge Functions com Hono, Cron, Storage), custo por fase e o que validar na primeira fatia.
- [technical/09-analise-de-uso.md](technical/09-analise-de-uso.md) — **Análise de uso:** PostHog (páginas, cliques, mapa de calor, gravação com textos ocultos na área logada), variáveis de ambiente e o que falta decidir (aviso de cookies).
- [technical/10-monolito-frontend-pwa.md](technical/10-monolito-frontend-pwa.md) — **Monólito Frontend com PWA:** visão unificada de gestor, professor e aluno em `apps/web` com distribuição PWA no celular (substitui React Native).
- [technical/11-identidade-global-e-multi-membership.md](technical/11-identidade-global-e-multi-membership.md) — **Identidade Global e Multi-Membership:** conta única global com múltiplos vínculos por espaço.
- [technical/12-modularizacao-da-camada-de-servicos.md](technical/12-modularizacao-da-camada-de-servicos.md) — **Modularização de Services:** fatiamento de arquivos gigantes (+1.000 linhas) em subdomínios com fachada retrocompatível.
- [technical/13-acesso-de-alunos-e-responsaveis.md](technical/13-acesso-de-alunos-e-responsaveis.md) — **Acesso de alunos e responsáveis:** vínculo `student_access` (`self` ou `guardian`) separado da ficha, um login com seletor de espaço e de perfil, regras por idade, revogação auditada.
- [technical/17-verificacao-em-duas-etapas.md](technical/17-verificacao-em-duas-etapas.md) — **Verificação em duas etapas:** aplicativo autenticador (MFA do Supabase) ou código por e-mail para quem entra com senha, "lembrar este dispositivo" por 30 dias, tela `/two-factor` no login e a barreira única (`secondFactorState`). Também a troca do e-mail de acesso pela própria pessoa (link no e-mail novo, aviso no antigo).
- [technical/18-documentos-pdf.md](technical/18-documentos-pdf.md) — **Documentos em PDF:** um layout só (`DocumentModel`) para relatórios, recibos, declaração, demonstrativo, certificado, termo, boletim e extrato; prévia na tela, PDF e CSV no servidor, logo do espaço com reserva do GestaraHub.
- [technical/19-desempenho-e-escala.md](technical/19-desempenho-e-escala.md) — **Desempenho e escala:** medição com um espaço de 1 ano (1,4 s a 4 s por ação, crescendo com o histórico), gargalos (espaço inteiro por ação, versão única por espaço, corte em 1.000 linhas, chamadas demais do navegador, rotina diária) e proposta em 4 fases.
- [technical/21-registro-de-erros.md](technical/21-registro-de-erros.md) — **Registro de erros:** tabela `error_logs` no nosso banco (agrupada, mascarada, 120 dias), `logError`/`reportError` de `@/lib/log`, código do erro na mensagem ao usuário, erros do navegador e resumo diário por e-mail.
- [technical/22-fuso-do-espaco.md](technical/22-fuso-do-espaco.md) — **Fuso do espaço:** os quatro fusos do Brasil, fuso escolhido ou pelo estado da unidade, "hoje" no fuso do espaço no servidor e no navegador, datas do Asaas no horário de Brasília.
- [technical/23-historico-em-segundo-plano.md](technical/23-historico-em-segundo-plano.md) — **Histórico do que roda sem pessoa:** Auditoria com o sistema como autor (rotina diária, parceiro de pagamentos), histórico do plano ligado à Auditoria, registro das execuções e dos avisos do Asaas (aviso repetido reconhecido), índices por consulta.
- [technical/24-plano-gestarahub.md](technical/24-plano-gestarahub.md) — **Plano GestaraHub (assinatura):** contrato, matriz de recursos por plano, composição com permissões, demonstração e conta real, quem grava o plano. As regras de troca de plano estão em `product/13` §6.
- [guides/21-painel-admin-local.md](guides/21-painel-admin-local.md) — **Painel admin no ambiente local:** como subir (`pnpm admin:setup`, `admin:create-admin`, `dev:admin`), roteiros de teste manual (fase 0 e fases 1 a 8) e os testes automáticos.
- [technical/26-painel-admin-gestarahub.md](technical/26-painel-admin-gestarahub.md) — **Painel admin do GestaraHub (fases 0 a 8 feitas):** app `apps/admin` com login próprio; espaços, suporte via assistente, planos e cortesias, saúde, receita, comunicados, equipe, LGPD, visão de suporte e auditoria; seção 17 diz o que existe e o que falta.
- [technical/25-pagamento-online.md](technical/25-pagamento-online.md) — **Pagamento online dos alunos:** Pix, link e Pix Automático (porta de pagamento, contrato, fluxos e regras).

### Guias (como fazer)
- [guides/14-asaas-mcp.md](guides/14-asaas-mcp.md) — **Documentação do Asaas por MCP:** como ligar o servidor `docs.asaas.com/mcp` em cada assistente (Claude Code, Cursor, VS Code, Antigravity, Codex, Claude Desktop) e a regra de só consulta.
- [guides/16-ambiente-local.md](guides/16-ambiente-local.md) — **Ambiente local:** `pnpm setup:local` sobe o Supabase, aplica as migrações, preenche as variáveis e prepara o cron; `pnpm setup:local:reset` começa do zero.
- [guides/20-tempo-dos-testes.md](guides/20-tempo-dos-testes.md) — **Tempo dos testes:** medições (Vitest 20 s, e2e 30 a 45 min um por vez) e plano: Vitest sem isolar (6 s), e2e smoke e por área, e2e completo no GitHub Actions dividido em 4 máquinas (10 a 15 min).

### Testes do sistema e planos de execução
- [qa/2026-10-23-teste-geral.md](qa/2026-10-23-teste-geral.md) — **Teste geral de 23/10/2026:** 80 achados por área e gravidade, as correções feitas (com commit e teste) e as perguntas de produto pendentes. As capturas ficam só na máquina local.
- [qa/2026-10-24-teste-final.md](qa/2026-10-24-teste-final.md) — **Teste final de 24/10/2026:** passada de tela de 104 telas (4 perfis, desktop claro e celular escuro), e2e completo e smoke; 4 achados novos.
- [qa/2026-10-24-teste-geral-2.md](qa/2026-10-24-teste-geral-2.md) — **Teste geral 2 (web e painel admin, 24/10/2026):** navegador real contra o Asaas sandbox (conta, Pix, link, cancelar, avisos, assinatura), 2FA com códigos de recuperação, comunicados, equipe, LGPD, suporte; e2e completo (401 passaram); 12 achados corrigidos e os que ficam para decisão.
- [qa/2026-11-02-roteiro-academia-artes-marciais.md](qa/2026-11-02-roteiro-academia-artes-marciais.md) — **Roteiro de teste manual, academia de artes marciais (02/11/2026):** 16 etapas (espaço novo, modalidades, equipe, planos, 5 turmas, 18 alunos, chamada, cobranças, Asaas, evolução, comunicação, financeiro, perfis, encerramentos), com o que conferir no banco a cada etapa e a tabela de achados. Versão em slides no `.html` ao lado (gerado por `pnpm --filter @gestarahub/web qa:roteiro`, script `apps/web/scripts/build-qa-roteiro.mjs`).
- [handoff/2026-10-24-execucao-noturna.md](handoff/2026-10-24-execucao-noturna.md) — **Execução noturna de 24/10/2026:** plano dos achados em aberto, organização das docs e rodada final de testes; o andamento está em [handoff/2026-10-24-diario-noturno.md](handoff/2026-10-24-diario-noturno.md).
- [handoff/2026-10-31-diario-noturno.md](handoff/2026-10-31-diario-noturno.md) — **Execução noturna de 30 para 31/10/2026:** revisão de dinheiro, auditoria de segurança e revisão do celular, com o e2e completo duas vezes; as 5 decisões já validadas.
- [handoff/2026-10-31-revisao-geral.md](handoff/2026-10-31-revisao-geral.md) — **Revisão geral do web (31/10/2026):** segurança (S1 a S13), valores e cálculos (V1 a V14), usabilidade e refatoração, cada um com commit; decisões para validar e o que ficou para depois.
- [handoff/2026-11-02-contexto-para-antigravity.md](handoff/2026-11-02-contexto-para-antigravity.md) — **Passagem de 02/11/2026:** o que foi feito em 01 e 02/11 (recebimentos online, taxas como saída, WhatsApp em segundo plano, jurídico v1.1, roteiro de teste), o diagnóstico da Meta, o que está em aberto e como continuar o teste manual conferindo o banco.

### Frontend
- [frontend/00-estrategia-frontend.md](frontend/00-estrategia-frontend.md) — Abordagem frontend-first com mocks realistas.
- [frontend/01-arquitetura.md](frontend/01-arquitetura.md) — Arquitetura Next.js, TanStack Query e convenções de pastas.
- [frontend/02-camada-de-dados-mock.md](frontend/02-camada-de-dados-mock.md) — Camada de simulação de API (`simulateRead` / `simulateWrite`).
- [frontend/03-rotas-e-navegacao.md](frontend/03-rotas-e-navegacao.md) — Roteamento, menus adaptáveis por modelo operacional e RBAC.
- [frontend/04-design-system.md](frontend/04-design-system.md) — Componentes compartilhados, shadcn/ui, Tailwind CSS e personalizador de tema.
- [frontend/06-decisoes-de-interface.md](frontend/06-decisoes-de-interface.md) — Decisões de interface já implementadas (confirmações, sidebar escura, agenda feita à mão, mobile). Prevalece sobre 00–05.
- [frontend/07-padroes-telas-e-ux.md](frontend/07-padroes-telas-e-ux.md) — **Padrões técnicos de telas, formulários, modais (`Adicionar` / `Salvar` / `Cancelar`), KPIs, listagens e usabilidade mobile (iOS Safari & Chrome).**
- [frontend/08-decisoes-landing-page-e-onboarding.md](frontend/08-decisoes-landing-page-e-onboarding.md) — **Decisões de produto, layout, micro-cópia e UX da nova Landing Page e do Wizard de Setup inicial (`/setup`).**
- [frontend/05-agenda-react-big-calendar.md](frontend/05-agenda-react-big-calendar.md) — *(Histórico)* Plano original da agenda com react-big-calendar, revertido; a agenda é feita à mão.

---

## 3. Módulos em Standby / Congelados (Pós-MVP)

Estes documentos contêm a especificação de outros modelos operacionais desenvolvidos e preservados como referência arquitetural, mas cujo ciclo ativo de desenvolvimento está pausado:

- [product/04-mvp-barbearia.md](product/04-mvp-barbearia.md) — *(⏸️ Standby)* Especificação inicial do Modelo 1 (atendimento individual 1:1).
- [product/08-barbearia-corte-nobre.md](product/08-barbearia-corte-nobre.md) — *(⏸️ Standby)* Cenário fictício "Corte Nobre".
- [product/05-regras-negocio.md](product/05-regras-negocio.md) — *(⏸️ Standby)* Regras de agendamento 1:1 da barbearia.
- [product/09-fluxos-principais.md](product/09-fluxos-principais.md) — Fluxos de barbearia.
- [product/10-estados-e-mensagens.md](product/10-estados-e-mensagens.md) — Estados de agendamentos 1:1.
- [product/16-backlog-barbearia.md](product/16-backlog-barbearia.md) — *(⏸️ Standby)* Bugs e melhorias de UI/UX da barbearia levantados em 23/09/2026, para a próxima rodada do Modelo 1.
- [product/12-modelo-2-entrega.md](product/12-modelo-2-entrega.md) — *(Futuro)* Modelo 2 (encomendas e entregas).

---

## Arquivo (histórico)

Planos cumpridos e documentos substituídos. Ficam para consulta; o que vale hoje está nos docs acima.

- [archive/product-22-antes-do-backend.md](archive/product-22-antes-do-backend.md) — O que falta no frontend antes do backend: decisões pendentes (notas, ficha do aluno, apps), ajustes pequenos e rascunho dos apps de aluno e professor.
- [archive/product-17-onboarding-segmentos-negocio.md](archive/product-17-onboarding-segmentos-negocio.md) — *(Histórico)* Plano original do wizard de 1º acesso e presets por segmento. A versão implementada está em `frontend/08`, seções 4.3 e 4.5.
- [archive/technical-06-passagem-backend.md](archive/technical-06-passagem-backend.md) — **Início da fase 3:** o que o mock faz e o servidor precisa assumir (tarefas agendadas, carimbos, arquivos, consultas), e ordem de construção das fatias.
- [archive/technical-15-retirada-do-mock-turmas.md](archive/technical-15-retirada-do-mock-turmas.md) — **Retirada do mock (turmas):** plano por fatias para a conta real ler e gravar só no Supabase; demonstração vira espaço real criado por seed.
- [archive/handoff-2026-10-23-plano-2fa-email-e-revisao-visual.md](archive/handoff-2026-10-23-plano-2fa-email-e-revisao-visual.md) — **Plano para outro agente:** verificação em duas etapas por e-mail e "lembrar este dispositivo" (parte A), depois o teste geral do sistema tela por tela, em desktop e celular, com subconta de recebimentos no sandbox, só registrando achados (parte B).

---

## Skills

As skills de agente do projeto vivem em [`../.claude/skills/`](../.claude/skills/): `docs`, `architect`, `contract`, `smoke-web`, `web-data`, `web-feature`, `web-form`. Resumo de cada uma em [skills/README.md](skills/README.md). Regras gerais de código para agentes: [`../AGENTS.md`](../AGENTS.md) e [`../CLAUDE.md`](../CLAUDE.md).

---

## Princípio de Documentação

Cada documento prioriza decisões claras, contexto, escopo, fora de escopo, regras e estabilidade. A documentação é mantida para consumo ágil por engenheiros e agentes de inteligência artificial.
