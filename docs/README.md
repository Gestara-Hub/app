# GestaraHub Docs

Este diretório guarda a especificação viva da arquitetura, produto e engenharia do GestaraHub.

> 🚀 **DIRETRIZ ATUAL DO MVP:**
> O primeiro ciclo de entrega do GestaraHub está focado no **Modelo 3 (Turmas & Aulas)**, com especialização no segmento de **Academias de Lutas / Artes Marciais (Jiu-Jitsu)**, validado diretamente no tatame através de um *design partner* real.
>
> A arquitetura segue rigorosamente:
> - **Código-fonte e Contratos 100% em Inglês neutro** (`level`, `guardian`, `roster`, `attendance`, `charge`).
> - **Interface do Usuário 100% em Português (`pt-BR`)**.
> - **Isolamento de Modelos Operacionais:** Modelos específicos não poluem a fundação universal nem misturam regras de negócio.

---

## 1. Foco Ativo do MVP (Modelo 3 — Turmas & Academia)

1. [product/14-mvp-academia-lutas.md](product/14-mvp-academia-lutas.md) — **Foco ativo:** Especificação do MVP para academias de lutas, matriz de equivalência e extensibilidade.
2. [product/11-modelo-3-turmas.md](product/11-modelo-3-turmas.md) — Especificação técnica dev-ready do Modelo 3 (turmas, matrículas, sessões, presença, planos e cobranças).
3. [product/02-modelos-operacionais.md](product/02-modelos-operacionais.md) — Conceito estrutural de modelos operacionais (`scheduling` vs `classes` vs `delivery`).
4. [product/01-glossario.md](product/01-glossario.md) — Glossário dos termos do sistema.
5. [product/06-perfis-permissoes.md](product/06-perfis-permissoes.md) — Perfis de acesso e RBAC.

---

## 2. Fundação Compartilhada (Técnica & Frontend)

### Técnico & Arquitetura
- [technical/00-decisoes-tecnicas.md](technical/00-decisoes-tecnicas.md) — Registro de decisões técnicas transversais (ADRs).
- [technical/01-extensao-modelos-operacionais.md](technical/01-extensao-modelos-operacionais.md) — Separação modular de modelos operacionais sem genericização prematura.

### Frontend
- [frontend/00-estrategia-frontend.md](frontend/00-estrategia-frontend.md) — Abordagem frontend-first com mocks realistas.
- [frontend/01-arquitetura.md](frontend/01-arquitetura.md) — Arquitetura Next.js, TanStack Query e convenções de pastas.
- [frontend/02-camada-de-dados-mock.md](frontend/02-camada-de-dados-mock.md) — Camada de simulação de API (`simulateRead` / `simulateWrite`).
- [frontend/03-rotas-e-navegacao.md](frontend/03-rotas-e-navegacao.md) — Roteamento, menus adaptáveis por modelo operacional e RBAC.
- [frontend/04-design-system.md](frontend/04-design-system.md) — Componentes compartilhados, shadcn/ui e Tailwind CSS.

---

## 3. Módulos em Standby / Congelados (Pós-MVP)

Estes documentos contêm a especificação de outros modelos operacionais desenvolvidos e preservados como referência arquitetural, mas cujo ciclo ativo de desenvolvimento está pausado:

- [product/04-mvp-barbearia.md](product/04-mvp-barbearia.md) — *(⏸️ Standby)* Especificação inicial do Modelo 1 (atendimento individual 1:1).
- [product/08-barbearia-corte-nobre.md](product/08-barbearia-corte-nobre.md) — *(⏸️ Standby)* Cenário fictício "Corte Nobre".
- [product/05-regras-negocio.md](product/05-regras-negocio.md) — *(⏸️ Standby)* Regras de agendamento 1:1 da barbearia.
- [product/09-fluxos-principais.md](product/09-fluxos-principais.md) — Fluxos de barbearia.
- [product/10-estados-e-mensagens.md](product/10-estados-e-mensagens.md) — Estados de agendamentos 1:1.
- [product/12-modelo-2-entrega.md](product/12-modelo-2-entrega.md) — *(Futuro)* Modelo 2 (encomendas e entregas).

---

## Princípio de Documentação

Cada documento prioriza decisões claras, contexto, escopo, fora de escopo, regras e estabilidade. A documentação é mantida para consumo ágil por engenheiros e agentes de inteligência artificial.
