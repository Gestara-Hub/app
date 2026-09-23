# Extensao para novos modelos operacionais

> Operacionaliza a "Regra de evolucao" de [`docs/product/02-modelos-operacionais.md`](../product/02-modelos-operacionais.md) para os Modelos 2 e 3.
>
> **Status:** o Modelo 3 (turmas) ja foi implementado seguindo esta decisao (ver "Estado atual"). O Modelo 2 (entrega) continua so tipado (`OperationalModel = "delivery"`), sem telas.

## Decisao

Ao implementar o Modelo 2 (Entrega/encomenda) e o Modelo 3 (Turmas/aulas), eles entram como **modulos separados** — novos feature slices em `apps/web/src/features/*` com entidades e contratos proprios em `@gestarahub/contracts` — reusando a fundacao compartilhada. **Nao** se genericiza o nucleo do Modelo 1 (Service, Appointment, Agenda) para "caber" os outros modelos. "Compromisso operacional" permanece um **conceito** nos docs (guarda-chuva), nunca uma entidade ou classe-base no codigo.

## Contexto

Quando esta decisao foi tomada, so o Modelo 1 (atendimento individual) era concreto — n=1. Os Modelos 2 e 3 comecariam antes do backend (fase 3); a decisao define como a base cresce sem se corromper.

Os tres modelos divergem no **nucleo** ("o que acontece") e so compartilham as **pessoas** e a fundacao ("quem/onde"):

- **Compartilhado** (ja generico o bastante — reutilizar como esta): Organizacao/Unidade, Cliente, Profissional/Equipe, Cargo (Role), Categoria, Usuarios/RBAC, sessao/auth, o shell (nav/layout), a camada de dados mock (services/queryKeys) e o motor de recorrencia/calendario em `@gestarahub/core`.
- **Divergente** (especifico do modelo — manter concreto): Servico + Agendamento + Agenda.

| Eixo | Modelo 1 | Modelo 2 (entrega) | Modelo 3 (turma) |
| --- | --- | --- | --- |
| Nucleo | Agendamento em slot na grade do profissional | Pedido com data de entrega + pipeline de status | Sessao compartilhada + turma |
| Capacidade | horario do profissional | capacidade diaria de producao (nao e grade) | vagas da turma + matricula |
| "Servico" | Servico (duracao + preco) | Produto/Item (estoque, sem duracao) | Tipo de aula (calendario coletivo) |
| "Cliente" | 1 cliente | 1 cliente (comprador) | N alunos (roster) |
| Agenda | grade por profissional | quadro/fila por data e status | calendario coletivo |

Por que **nao** genericizar agora:

- Abstrair a partir de n=1 quase sempre produz a abstracao errada; os Modelos 2/3 ainda nao existem, entao qualquer campo generico e chute.
- Um nucleo generico vira um saco de campos opcionais (`clientIds? capacidade? dataEntrega? presenca?`), quase todos nulos em qualquer modelo — formulario confuso e validacao fraca.
- Custo assimetrico: a abstracao e barata de adicionar depois (quando houver 2-3 casos reais) e cara de remover.

## Escopo

Guia por cadastro para quando o Modelo 2/3 for construido:

- **Cliente, Profissional/Equipe:** reutilizar como estao. M3 os usa como aluno/instrutor; M2 como comprador/responsavel. Trocar o rotulo "Clientes" -> "Alunos" e camada de UI (rotulos por segmento, futuro), **nao** mudanca de dado.
- **Servico:** mantem concreto ao M1 (duracao + preco). M2 -> nova entidade Produto/Item; M3 -> nova entidade Tipo de aula/Turma. Compartilham Categoria/preco so se for identico de verdade.
- **Agendamento/Agenda:** especifico do M1; **nunca** genericizar. M2 = quadro de pedidos por data e status (Kanban) + capacidade diaria; M3 = Turma + Matricula + Sessao + Presenca + calendario coletivo (reusa o motor de recorrencia).

Dois eixos de "multi" que **nao** se confundem:

- **Segmento/vertical** (barbearia, salao, clinica): mesmo Modelo 1, muda so rotulo/categoria. Aqui um generico leve (categorias, rotulos por segmento) e aceitavel.
- **Modelo operacional** (1/2/3): estrutural. Aqui a extensao e por **modulo separado**, nao por campo generico.

Onde a implementacao real vive: entidades em `packages/contracts/src`, slices em `apps/web/src/features/*`, motor reutilizavel em `packages/core`.

## Estado atual (Modelo 3 implementado)

- **Tenant:** Academia X (`org-academia-x`, `model: "classes"`), lado a lado com a Corte Nobre (`scheduling`) no mundo multi-tenant (ver [`03-multi-tenant-e-escopo.md`](03-multi-tenant-e-escopo.md)).
- **Contratos:** `packages/contracts/src/class.ts` (`ClassGroup`, `Enrollment`, `ClassSession`, `Attendance`, `WaitlistEntry`, `ClassReservation`) e `billing.ts` (`Plan`, `Charge`).
- **Logica pura:** `packages/core/src/billing.ts` (motor de cobranca, ver [`02-motor-de-cobranca.md`](02-motor-de-cobranca.md)), alem do `scheduling.ts` compartilhado.
- **Services:** `apps/web/src/services/turmasService.ts` e `billingService.ts`.
- **Feature e rotas:** `apps/web/src/features/turmas`, rotas `/classes`, `/classes/[id]`, `/classes/sessions/[sessionId]`, `/classes/calendar`, `/classes/modalities`, `/classes/plans`, `/classes/billing`. Cliente, Equipe, Categoria (como "Modalidade"), Usuarios e Auditoria foram reutilizados, so com rotulos por modelo (`services/nouns.ts`, `lib/labels.ts`).
- O nucleo do Modelo 1 (`Service`, `Appointment`, agenda) nao foi alterado para acomodar turmas.

**Divida de nomenclatura conhecida:** a regra de codigo 100% em ingles (`CLAUDE.md`/`AGENTS.md`) ainda e violada em partes do Modelo 3: pasta `features/turmas`, `turmasService`, componentes/schemas `Turma*` (`TurmaFormValues`, `getTurmaFormSchema`, `TurmasView`), metodo legado `turmasService.cancelReserva` e aliases de contrato em portugues (`Plano`, `Cobranca*`, `Reserva*` em `billing.ts`/`class.ts`), alem dos campos legados `cobrancas`/`reservas` no store. Nao copiar esses nomes em codigo novo; renomear (`features/classes`, `classesService`...) e remover os aliases e tarefa pendente.

## Alternativas

- **Genericizar o nucleo agora** (uma entidade "Compromisso" com campos opcionais para os 3 modelos, ou um Servico que tambem representa produto/aula): rejeitada — abstracao prematura a partir de n=1; acopla tudo a um nucleo provavelmente errado; degrada a clareza do MVP.
- **Nao registrar nada e decidir na hora:** rejeitada — os Modelos 2/3 comecam ja; sem esta linha de falha explicita ha risco real de alguem alargar o `Appointment` em vez de criar modulos.
