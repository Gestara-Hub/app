# Barbearia Corte Nobre (Cenario Canonico)

> ⏸️ **STATUS: CONGELADO / STANDBY (Pós-MVP)**
> Este cenário de dados mockados pertence ao Modelo 1 (agendamento 1:1 de barbearia), que está atualmente em standby. O foco ativo do MVP é o **Modelo 3 (Turmas / Academia de Lutas)**.
> Ver especificação do foco ativo em [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).

> ⚠️ **Este documento NAO e mais o seed.** O seed (`apps/web/src/mocks/seed.ts`) cria cada tenant **vazio**: so organizacao, unidade e o usuario proprietario. Para a Corte Nobre isso e a organizacao "Corte Nobre" (`model: "scheduling"`), a unidade "Corte Nobre - Matriz" com `businessHours` vazio e o usuario Marcelo Andrade (`owner`). Profissionais, servicos, categorias, cargos, clientes, agendamentos e os demais usuarios abaixo **nao existem** ate alguem cadastra-los pela UI. Ver [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md).

## Decisao / Objetivo

Este documento e o CENARIO DE REFERENCIA do Modelo 1: um roteiro de dados para **cadastro manual em demos e testes exploratorios**. Antes era a "fonte unica" dos dados mockados; desde que o seed passou a nascer vazio (onboarding real), ele deixou de ser carregado automaticamente.

Quando alguem precisar montar uma barbearia realista para demonstrar ou testar a agenda (organizacao, unidade, profissionais, servicos, clientes e agendamentos), pode usar os dados abaixo. Eles continuam coerentes entre si e com as regras atuais, mas divergencias entre este documento e o que esta no store nao sao bug.

O cenario representa uma barbearia pequena e realista, suficiente para validar o nucleo operacional do Modelo 1: Clientes, Equipe, Servicos e Agenda.

## Contexto

- Navegacao do tenant `scheduling` (`components/layout/nav.ts`): Dashboard, Clientes, Equipe, Servicos e Agenda; no rodape, Usuarios, Auditoria e Configuracoes. "Agendamentos" nao e mais um item proprio: a Agenda (`/schedule`) tem as abas Calendario e Lista, e `/appointments` redireciona para ela.
- "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de um agendamento e em telas de detalhe.
- Termos por modelo ja existem de forma simples (`services/nouns.ts`): no tenant de turmas, cliente vira "aluno" e categoria vira "modalidade". Um sistema completo de rotulos por segmento continua fora do MVP.
- Projeto do zero: nada da v1 e reaproveitado. Todos os dados deste cenario sao novos e ficticios.
- Todos os identificadores de codigo (status, origem, campos) estao em ingles; so os rotulos da UI ficam em portugues.

## Organizacao

| Campo | Valor |
| --- | --- |
| Nome | Corte Nobre |
| Segmento | Barbearia |
| Status | Ativo |

## Unidade

O MVP simula uma unica unidade (`store.unit` e singleton; multiunidade fica para a Fase 5). O seed ja cria a unidade com nome, endereco e telefone abaixo.

| Campo | Valor |
| --- | --- |
| Nome | Corte Nobre - Matriz |
| Endereco | Rua das Tesouras, 120 - Centro (ficticio) |
| Telefone | (11) 4002-8922 (ficticio) |
| Status | Ativa |

### Horario de funcionamento

No seed, `businessHours` nasce **vazio**; o proprietario preenche em Configuracoes (o checklist de onboarding pede "Definir horário de funcionamento"). Enquanto estiver vazio, a Agenda nao valida expediente da unidade. A grade sugerida para o cenario e:

| Dia | Funcionamento |
| --- | --- |
| Segunda | 09:00 - 20:00 |
| Terca | 09:00 - 20:00 |
| Quarta | 09:00 - 20:00 |
| Quinta | 09:00 - 20:00 |
| Sexta | 09:00 - 20:00 |
| Sabado | 08:00 - 18:00 |
| Domingo | Fechado |

## Profissionais (Equipe)

Sao 4 profissionais. Todos atuam na unidade Corte Nobre - Matriz. Os dias de trabalho de cada profissional devem respeitar o horario de funcionamento da unidade.

Como o cadastro funciona hoje (`Professional` em `packages/contracts/src/professional.ts`):

- O papel/especialidade e um `Role` (cargo) **opcional** (`roleId`), criado antes no CRUD de Cargos.
- `workingHours` pode ficar vazio (profissional sem escala aparece em todo dia aberto) e aceita intervalo de almoco (`breakStart`/`breakEnd`).
- `serviceIds` ("Servicos que faz") pode ficar vazio e e **informativo**: no agendamento avulso qualquer profissional ativo pode fazer qualquer servico ativo; os servicos que ele realiza so aparecem destacados ("realiza") e no topo da lista (`appointmentsService`, `appointment-form.tsx`). Excecao: a criacao de serie recorrente ainda recusa servico que o profissional nao realiza (`recurrenceService`, erro `PROFESSIONAL_DOES_NOT_OFFER_SERVICE`).

| Nome | Papel | Especialidade | Dias de trabalho | Servicos que faz |
| --- | --- | --- | --- | --- |
| Marcelo Andrade | Barbeiro e proprietario | Cortes classicos e navalha | Seg a Sab | Todos os 12 servicos |
| Rafael Lima | Barbeiro | Cortes modernos e degrade | Ter a Sab | Todos, exceto Relaxamento / Progressiva |
| Bruno Costa | Barbeiro | Barba, navalhada, pigmentacao e cuidados | Seg a Sex | Todos, exceto Corte Infantil |
| Diego Santos | Barbeiro junior | Cortes basicos, barba e acabamentos | Qua a Sab | Corte Masculino, Corte Degrade, Corte Infantil, Pezinho / Acabamento, Barba, Sobrancelha |

### Quem faz quais servicos (matriz)

Matriz para preencher `serviceIds` de cada profissional. Lembrete: ela destaca, mas nao impede, agendamentos avulsos.

| Servico | Marcelo | Rafael | Bruno | Diego |
| --- | --- | --- | --- | --- |
| Corte Masculino | Sim | Sim | Sim | Sim |
| Corte Degrade | Sim | Sim | Sim | Sim |
| Corte Infantil | Sim | Sim | Nao | Sim |
| Pezinho / Acabamento | Sim | Sim | Sim | Sim |
| Barba | Sim | Sim | Sim | Sim |
| Barba Navalhada | Sim | Sim | Sim | Nao |
| Pigmentacao de Barba | Sim | Sim | Sim | Nao |
| Sobrancelha | Sim | Sim | Sim | Sim |
| Hidratacao Capilar | Sim | Sim | Sim | Nao |
| Relaxamento / Progressiva | Sim | Nao | Sim | Nao |
| Combo Corte + Barba | Sim | Sim | Sim | Nao |
| Combo Completo (Corte + Barba + Sobrancelha) | Sim | Sim | Sim | Nao |

Observacoes:

- Marcelo e o profissional com agenda mais cheia (proprietario, atende todos os servicos, trabalha 6 dias).
- Diego e o profissional com agenda mais vazia (junior, menor cartela de servicos, comeca a trabalhar so na quarta).

## Usuarios (acesso)

O seed cria **apenas Marcelo Andrade** (`owner`). Os outros 4 usuarios abaixo sao sugestao para cadastrar em Usuarios (`/users`) e demonstrar cada perfil; o perfil de acesso (`UserProfile`: `owner`, `manager`, `attendant`, `professional`) e distinto do cargo (ver `06-perfis-permissoes.md`).

| Nome | E-mail | Perfil | Vinculo com profissional |
| --- | --- | --- | --- |
| Marcelo Andrade | marcelo@cortenobre.com | Proprietario | Sim (tambem atende) — unico usuario do seed |
| Patricia Nunes | patricia@cortenobre.com | Gerente | Nao |
| Sofia Ramos | sofia@cortenobre.com | Atendente | Nao |
| Rafael Lima | rafael@cortenobre.com | Profissional | Sim (Rafael) |
| Diego Santos | diego@cortenobre.com | Profissional | Sim (Diego) |

Observacoes:

- Bruno (profissional) nao possui usuario — nem todo funcionario faz login.
- O login e por selecao de usuario, sem credenciais: a tela lista os usuarios de todas as organizacoes e escolher um entra na organizacao dele. A topbar permite trocar de usuario (e, com isso, de organizacao).

## Servicos

Sao 12 servicos. O preco e exibido em reais; o preco em centavos (`priceCents`) e o valor de armazenamento para precisao. A categoria e uma entidade `Category` do tenant (`categoryId`, **opcional**; sem categoria aparece como "Sem categoria"), entao as 4 categorias abaixo precisam ser cadastradas antes.

| Nome | Categoria | Duracao | Preco (R$) | Preco (centavos) |
| --- | --- | --- | --- | --- |
| Corte Masculino | Cabelo | 30 min | R$ 45,00 | 4500 |
| Corte Degrade | Cabelo | 40 min | R$ 55,00 | 5500 |
| Corte Infantil | Cabelo | 30 min | R$ 40,00 | 4000 |
| Pezinho / Acabamento | Cabelo | 15 min | R$ 20,00 | 2000 |
| Barba | Barba | 30 min | R$ 35,00 | 3500 |
| Barba Navalhada | Barba | 40 min | R$ 45,00 | 4500 |
| Pigmentacao de Barba | Barba | 45 min | R$ 60,00 | 6000 |
| Sobrancelha | Cuidados | 15 min | R$ 20,00 | 2000 |
| Hidratacao Capilar | Cuidados | 30 min | R$ 40,00 | 4000 |
| Relaxamento / Progressiva | Cuidados | 90 min | R$ 120,00 | 12000 |
| Combo Corte + Barba | Combos | 60 min | R$ 75,00 | 7500 |
| Combo Completo (Corte + Barba + Sobrancelha) | Combos | 75 min | R$ 90,00 | 9000 |

## Clientes

Sao 20 clientes. A maioria e recorrente; alguns sao novos; 1 a 2 estao inativos. Alguns trazem o filho para o Corte Infantil.

| # | Nome | Perfil | Observacao |
| --- | --- | --- | --- |
| 1 | Joao Pereira | Recorrente | Cliente fiel; prefere Marcelo; corte classico mensal. |
| 2 | Carlos Mendes | Recorrente | Combo Corte + Barba quinzenal aos sabados. |
| 3 | Anderson Silva | Recorrente | Gosta de degrade; costuma agendar com Rafael. |
| 4 | Lucas Ferreira | Recorrente | Traz o filho para o Corte Infantil. |
| 5 | Pedro Henrique Alves | Novo | Primeiro atendimento recente; ainda sem profissional fixo. |
| 6 | Gustavo Rocha | Recorrente | Barba e pigmentacao com Bruno. |
| 7 | Felipe Cardoso | Recorrente | Corte Masculino mensal; flexivel de profissional. |
| 8 | Thiago Barbosa | Recorrente | Combo Completo de vez em quando; gosta de sobrancelha. |
| 9 | Rodrigo Nunes | Inativo | Sem agendamentos ha varios meses; aparece so no historico. |
| 10 | Marcos Vinicius | Recorrente | Degrade com Diego; agenda em horarios de menor movimento. |
| 11 | Eduardo Tavares | Recorrente | Hidratacao Capilar periodica. |
| 12 | Vinicius Ramos | Novo | Indicado por amigo; agendou Corte Masculino. |
| 13 | Daniel Moreira | Recorrente | Traz o filho para o Corte Infantil aos sabados. |
| 14 | Sergio Lopes | Recorrente | Relaxamento / Progressiva; so com Marcelo ou Bruno. |
| 15 | Andre Martins | Recorrente | Barba Navalhada com Bruno. |
| 16 | Ricardo Gomes | Recorrente | Corte + Pezinho; cliente de longa data. |
| 17 | Fabio Souza | Novo | Cadastro recente; ainda explorando servicos. |
| 18 | Leonardo Dias | Inativo | Mudou de bairro; mantido no historico. |
| 19 | Otavio Castro | Recorrente | Combo Corte + Barba mensal com Rafael. |
| 20 | Henrique Azevedo | Recorrente | Sobrancelha e barba; agenda flexivel. |

## Padroes de agenda

Para uma demo realista, a massa de dados deve ter entre 40 e 80 agendamentos distribuidos em aproximadamente 4 semanas, cobrindo passado, presente e futuro (tomando a data de referencia da simulacao como o "hoje" do cenario).

Distribuicao esperada:

- Dia cheio: um sabado com agenda lotada (alto volume entre os 4 profissionais; varias confirmacoes e conclusoes; sabado e o pico).
- Dia fraco: uma terca com poucos agendamentos (movimento baixo; varios horarios livres).
- Marcelo Andrade: agenda mais cheia entre todos.
- Diego Santos: agenda mais vazia entre todos.
- Rafael Lima e Bruno Costa: volume intermediario.
- Variedade de status: pendentes, confirmados, em atendimento (no dia de hoje), concluidos (passado) e cancelados/no-shows espalhados.
- Cancelamentos: ao menos alguns agendamentos cancelados no historico.
- No-shows: ao menos alguns agendamentos marcados como Nao compareceu no passado.
- Respeitar sempre as regras: nenhum profissional com sobreposicao de horario; nada sobre bloqueios; nada fora do expediente (possivel com confirmacao, mas foge do cenario).

### Distribuicao indicativa por profissional

| Profissional | Volume relativo | Observacao |
| --- | --- | --- |
| Marcelo Andrade | Mais cheia | Concentra os classicos, navalha e parte dos combos. |
| Rafael Lima | Intermediaria | Degrades e cortes modernos. |
| Bruno Costa | Intermediaria | Barba, navalhada, pigmentacao e cuidados. |
| Diego Santos | Mais vazia | Cortes basicos e acabamentos; muitos horarios livres. |

## Series recorrentes de exemplo

Sugestao de duas series recorrentes, ligadas por `seriesId` e com origem `recurrence` (`RecurrenceSeries` em `packages/contracts/src/recurrence-series.ts`; frequencias `weekly`, `biweekly`, `monthly`).

### Serie 1 - Carlos Mendes (quinzenal, sabado, Marcelo)

| Campo | Valor |
| --- | --- |
| Cliente | Carlos Mendes |
| Profissional | Marcelo Andrade |
| Servico | Combo Corte + Barba (60 min) |
| Frequencia | Quinzenal |
| Dia/horario | Sabado, 10:00 |
| Termino | Por numero de ocorrencias (ex.: 4 ocorrencias) |

### Serie 2 - Joao Pereira (mensal, Marcelo)

| Campo | Valor |
| --- | --- |
| Cliente | Joao Pereira |
| Profissional | Marcelo Andrade |
| Servico | Corte Masculino (30 min) |
| Frequencia | Mensal (mesmo dia da semana e horario) |
| Dia/horario | Sexta, 18:00 |
| Termino | Por data final (ex.: 3 meses a frente) |

Observacoes sobre series:

- Cada serie gera N ocorrencias finitas (sem recorrencia infinita).
- Se uma ocorrencia cair em horario ocupado, fora do expediente da unidade, fora do horario do profissional, no intervalo de almoco ou em bloqueio, ela e sinalizada como conflito e NAO e criada (na serie nao ha a confirmacao "mesmo assim" do agendamento avulso).
- **Remarcacao** de uma ocorrencia pergunta o escopo: "Somente esta ocorrência" ou "Esta e as futuras". **Cancelamento** e sempre de uma ocorrencia por vez (nao existe cancelar/excluir serie).

## Status de agendamento

`AppointmentStatus` em `packages/contracts/src/common.ts`; rotulos em `lib/labels.ts`.

| Chave | Rotulo |
| --- | --- |
| `pending` | Pendente |
| `confirmed` | Confirmado |
| `in_service` | Em atendimento |
| `completed` | Concluído |
| `canceled` | Cancelado |
| `no_show` | Não compareceu |

## Origem de agendamento

`AppointmentOrigin` = `"manual" | "recurrence"`. `online` e `whatsapp` sao futuros e **nao** estao no tipo.

| Enum | Significado | Status no MVP |
| --- | --- | --- |
| `manual` | Criado por alguem da equipe na Agenda | No MVP |
| `recurrence` | Gerado por uma serie recorrente | No MVP |
| `online` | Criado pelo cliente em canal online | Futuro (fora do tipo) |
| `whatsapp` | Criado via WhatsApp | Futuro (fora do tipo) |

## Exemplos concretos de agendamento

Os exemplos abaixo sao ilustrativos e consistentes com o cenario (profissional faz o servico, dentro do expediente, sem sobreposicao). Um agendamento aceita varios servicos (`serviceIds`); duracao e preco sao a soma.

| Cliente | Profissional | Servico | Data | Horario | Status | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| Carlos Mendes | Marcelo Andrade | Combo Corte + Barba | Sabado (dia cheio) | 10:00 - 11:00 | Confirmado | recurrence |
| Anderson Silva | Rafael Lima | Corte Degrade | Sabado (dia cheio) | 11:30 - 12:10 | Concluido | manual |
| Lucas Ferreira | Diego Santos | Corte Infantil | Sabado (dia cheio) | 09:00 - 09:30 | Pendente | manual |
| Gustavo Rocha | Bruno Costa | Pigmentacao de Barba | Terca (dia fraco) | 15:00 - 15:45 | Confirmado | manual |

Exemplos adicionais de estados especiais (para historico):

| Cliente | Profissional | Servico | Data | Horario | Status | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| Sergio Lopes | Marcelo Andrade | Relaxamento / Progressiva | Sexta passada | 14:00 - 15:30 | Cancelado | manual |
| Vinicius Ramos | Rafael Lima | Corte Masculino | Quinta passada | 17:00 - 17:30 | Nao compareceu | manual |

## Pendencias

- Decidir se vale ter um "carregar cenario de demonstracao" opcional (hoje so os testes e2e montam dados via `localStorage`); se sim, este documento volta a ser a fonte desses dados.
- A data de referencia e o volume de 40-80 agendamentos so importam para quem montar o cenario a mao; nao ha seed a fixar.
- O almoço dos barbeiros seniores (Marcelo e Rafael, 12:00–13:00) deve ser cadastrado como intervalo do horário de trabalho (`breakStart`/`breakEnd`), não como bloqueio avulso — aparece como faixa "Almoço" na Agenda e, ao agendar nesse horário, pede confirmação ("Agendar durante o intervalo?") em vez de recusar. Bloqueios avulsos (folga/indisponibilidade) são criados pela UI e recusam agendamento.
