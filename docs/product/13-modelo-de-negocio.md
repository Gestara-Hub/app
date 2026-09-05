# Modelo de negocio: free vs pago

## Decisao

O CRUD operacional basico do GestaraHub e **gratuito**: cadastro e gestao de Clientes, Equipe (Profissionais/Cargos), Servicos/Categorias (ou Modalidades/Turmas no Modelo 3), Agenda/Agendamentos e Usuarios (RBAC basico). Isso vale para todos os modelos operacionais (Modelo 1 atendimento, Modelo 2 encomenda, Modelo 3 turmas).

A monetizacao acontece em cima de **funcionalidades de gerenciamento avancado**: Dashboard (metricas/analytics), Relatorios e Financeiro/Recebimentos (cobranca, mensalidades, conciliacao). Essas funcionalidades ficam atras de um **plano pago** (mensal/anual), cobrado do tenant (o negocio que usa o GestaraHub) — nao confundir com o financeiro que o tenant cobra do proprio cliente final (ex.: Mensalidades do Modelo 3, ja existente e sempre visivel para quem tem o modulo).

## Contexto

Ate aqui a spec do produto (`docs/product/*`) e as decisoes tecnicas (`docs/technical/*`) nao tinham nenhuma nocao de modelo de negocio — RBAC (`06-perfis-permissoes.md`) descreve *quem* pode fazer *o que dentro do que o tenant tem contratado*, mas nao existe hoje o eixo "o que o tenant tem contratado". O dashboard operacional e o modulo financeiro do Modelo 3 (Mensalidades/Planos, `docs/product/11-modelo-3-turmas.md`) ja existem no codigo sem essa fronteira — precisam ser reclassificados quando o gate de plano for implementado (ver Escopo).

## Escopo

**Free (todos os modelos):**

- Clientes — CRUD + inativacao.
- Equipe — Profissionais, Cargos (Role), disponibilidade/horario de trabalho.
- Catalogo — Servicos/Categorias (M1/M2) ou Modalidades (M3).
- Agenda/Agendamentos — criacao, remarcacao, bloqueio, recorrencia simples (M1); Turmas/matriculas/frequencia (M3); Pedidos (M2, quando entrar).
- Usuarios — RBAC basico (perfis Proprietario/Gerente/Atendente/Profissional).
- Auditoria (ja existe, `docs/product` audit log) — fica free por ser rastreabilidade basica de uso, nao analytics.

**Pago (plano mensal/anual):**

- Dashboard com metricas/analytics alem do operacional do dia (ex.: comparativos, tendencias, ocupacao por periodo).
- Relatorios (exportacao, cortes por profissional/servico/periodo).
- Financeiro/Recebimentos do proprio tenant — cobranca do que o negocio recebe (nao confundir com o financeiro que o tenant cobra do cliente final dele, que e parte operacional do Modelo 3 e continua free).

**Fora deste corte (decidir depois):**

- Preco exato dos planos e ciclos (mensal/anual).
- Trial, downgrade e o que acontece com dados de um recurso pago quando o tenant sai do plano (ex.: relatorios historicos ficam bloqueados ou apagados?).
- Limites quantitativos no free (numero de profissionais/clientes/agendamentos) — hoje a decisao e so por *funcionalidade*, nao por volume.
- Cobranca do proprio GestaraHub (gateway de pagamento do SaaS) — mock ou real.

## Como isso deve encaixar na arquitetura

RBAC (`can`/`useCan`, ver [Access & RBAC](../technical/00-decisoes-tecnicas.md) e `06-perfis-permissoes.md`) responde "esse **perfil de usuario** pode fazer X". Isso e ortogonal a um novo eixo "esse **tenant** tem o plano que inclui X" — os dois compoem (uma tela pode exigir permissao de perfil E feature do plano).

Nao implementar ainda; quando entrar, o padrao esperado e um `Organization.plan` (ou similar, ex.: `"free" | "pro"`) + uma capability-key adicional por feature paga (ex.: `reports:view`, `dashboard:advanced`, `finance:view`), checada do mesmo jeito que as permissoes de perfil hoje (guard de rota + esconder link de nav + gate de tela), para nao exigir uma segunda arquitetura de permissoes.

## Alternativas consideradas

- **Limitar por volume (numero de agendamentos/clientes) em vez de por feature**: rejeitado por ora — a decisao do usuario e clara em cortar por *complexidade de gerenciamento*, nao por uso.
- **Financeiro do tenant final (Mensalidades M3) tambem pago**: rejeitado — isso e parte do CRUD operacional basico do modelo (sem cobranca dos alunos, a turma nao funciona), diferente de relatorios/analytics *sobre* esses dados.
