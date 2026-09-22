# Barbearia Corte Nobre (Cenario Canonico)

> ⏸️ **STATUS: CONGELADO / STANDBY (Pós-MVP)**
> Este cenário de dados mockados pertence ao Modelo 1 (agendamento 1:1 de barbearia), que está atualmente em standby. O foco ativo do MVP é o **Modelo 3 (Turmas / Academia de Lutas)**.
> Ver especificação do foco ativo em [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).

## Decisao / Objetivo

Este documento e o CENARIO CANONICO do GestaraHub: a fonte unica de verdade para todos os dados mockados do MVP.

Sempre que o frontend mockado, os exemplos de tela, os testes ou os agentes de desenvolvimento precisarem de dados (organizacao, unidade, profissionais, servicos, clientes ou agendamentos), eles devem usar exatamente o que esta descrito aqui. Qualquer divergencia entre mock e este documento deve ser resolvida ajustando o mock, nao o cenario.

O cenario representa uma barbearia pequena e realista, suficiente para validar o nucleo operacional do MVP: Clientes, Equipe, Servicos, Agenda e Agendamentos.

## Contexto

- A interface do MVP usa linguagem unica e generica de navegacao: Clientes, Equipe, Servicos, Agenda e Agendamentos.
- "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de um agendamento e em telas de detalhe.
- A arquitetura conceitual preve um sistema FUTURO de rotulos por segmento (label overrides). Esse sistema NAO entra no MVP; e apenas previsao conceitual.
- Projeto do zero: nada da v1 e reaproveitado. Todos os dados deste cenario sao novos e ficticios.

## Organizacao

| Campo | Valor |
| --- | --- |
| Nome | Corte Nobre |
| Segmento | Barbearia |
| Status | Ativo |

## Unidade

O MVP simula uma unica unidade.

| Campo | Valor |
| --- | --- |
| Nome | Corte Nobre - Matriz |
| Endereco | Rua das Tesouras, 120 - Centro (ficticio) |
| Telefone | (11) 4002-8922 (ficticio) |
| Status | Ativa |

### Horario de funcionamento

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

| Nome | Papel | Especialidade | Dias de trabalho | Servicos que faz |
| --- | --- | --- | --- | --- |
| Marcelo Andrade | Barbeiro e proprietario | Cortes classicos e navalha | Seg a Sab | Todos os 12 servicos |
| Rafael Lima | Barbeiro | Cortes modernos e degrade | Ter a Sab | Todos, exceto Relaxamento / Progressiva |
| Bruno Costa | Barbeiro | Barba, navalhada, pigmentacao e cuidados | Seg a Sex | Todos, exceto Corte Infantil |
| Diego Santos | Barbeiro junior | Cortes basicos, barba e acabamentos | Qua a Sab | Corte Masculino, Corte Degrade, Corte Infantil, Pezinho / Acabamento, Barba, Sobrancelha |

### Quem faz quais servicos (matriz)

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

Sao 5 usuarios cobrindo os 4 perfis de acesso, incluindo o mix "usuario que e (ou nao) profissional". O perfil de acesso e distinto do cargo (ver `06-perfis-permissoes.md`).

| Nome | E-mail | Perfil | Vinculo com profissional |
| --- | --- | --- | --- |
| Marcelo Andrade | marcelo@cortenobre.com | Proprietario | Sim (tambem atende) |
| Patricia Nunes | patricia@cortenobre.com | Gerente | Nao |
| Sofia Ramos | sofia@cortenobre.com | Atendente | Nao |
| Rafael Lima | rafael@cortenobre.com | Profissional | Sim (Rafael) |
| Diego Santos | diego@cortenobre.com | Profissional | Sim (Diego) |

Observacoes:

- Bruno (profissional) nao possui usuario — nem todo funcionario faz login.
- O login e por selecao de usuario (senha irrelevante no mock); a topbar permite trocar de usuario para demonstrar cada perfil.

## Servicos

Sao 12 servicos. O preco e exibido em reais; o preco em centavos e o valor de armazenamento para precisao.

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

A massa de dados deve ter entre 40 e 80 agendamentos distribuidos em aproximadamente 4 semanas, cobrindo passado, presente e futuro (tomando a data de referencia da simulacao como o "hoje" do cenario).

Distribuicao esperada:

- Dia cheio: um sabado com agenda lotada (alto volume entre os 4 profissionais; varias confirmacoes e conclusoes; sabado e o pico).
- Dia fraco: uma terca com poucos agendamentos (movimento baixo; varios horarios livres).
- Marcelo Andrade: agenda mais cheia entre todos.
- Diego Santos: agenda mais vazia entre todos.
- Rafael Lima e Bruno Costa: volume intermediario.
- Variedade de status: pendentes, confirmados, em atendimento (no dia de hoje), concluidos (passado) e cancelados/no-shows espalhados.
- Cancelamentos: ao menos alguns agendamentos cancelados no historico.
- No-shows: ao menos alguns agendamentos marcados como Nao compareceu no passado.
- Respeitar sempre as regras: nenhum profissional com sobreposicao de horario; nada fora do expediente; nada sobre bloqueios.

### Distribuicao indicativa por profissional

| Profissional | Volume relativo | Observacao |
| --- | --- | --- |
| Marcelo Andrade | Mais cheia | Concentra os classicos, navalha e parte dos combos. |
| Rafael Lima | Intermediaria | Degrades e cortes modernos. |
| Bruno Costa | Intermediaria | Barba, navalhada, pigmentacao e cuidados. |
| Diego Santos | Mais vazia | Cortes basicos e acabamentos; muitos horarios livres. |

## Series recorrentes de exemplo

Pelo menos duas series recorrentes devem existir nos dados, ligadas por `serieId` e com origem `recorrencia`.

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
- Se uma ocorrencia cair em horario ocupado, fora do expediente ou em bloqueio, ela e sinalizada como conflito e NAO e criada automaticamente.
- Edicao/cancelamento de uma ocorrencia segue o escopo: "somente esta ocorrencia" ou "esta e as futuras".

## Status de agendamento

| Chave | Rotulo |
| --- | --- |
| pendente | Pendente |
| confirmado | Confirmado |
| em_atendimento | Em atendimento |
| concluido | Concluido |
| cancelado | Cancelado |
| nao_compareceu | Nao compareceu |

## Origem de agendamento

| Enum | Significado | Status no MVP |
| --- | --- | --- |
| manual | Criado por alguem da equipe na Agenda | No MVP |
| recorrencia | Gerado por uma serie recorrente | No MVP |
| online | Criado pelo cliente em canal online | Futuro |
| whatsapp | Criado via WhatsApp | Futuro |

## Exemplos concretos de agendamento

Os exemplos abaixo sao ilustrativos e 100% consistentes com o CANON (profissional faz o servico, dentro do expediente, sem sobreposicao). As datas usam o padrao do cenario.

| Cliente | Profissional | Servico | Data | Horario | Status | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| Carlos Mendes | Marcelo Andrade | Combo Corte + Barba | Sabado (dia cheio) | 10:00 - 11:00 | Confirmado | recorrencia |
| Anderson Silva | Rafael Lima | Corte Degrade | Sabado (dia cheio) | 11:30 - 12:10 | Concluido | manual |
| Lucas Ferreira | Diego Santos | Corte Infantil | Sabado (dia cheio) | 09:00 - 09:30 | Pendente | manual |
| Gustavo Rocha | Bruno Costa | Pigmentacao de Barba | Terca (dia fraco) | 15:00 - 15:45 | Confirmado | manual |

Exemplos adicionais de estados especiais (para historico):

| Cliente | Profissional | Servico | Data | Horario | Status | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| Sergio Lopes | Marcelo Andrade | Relaxamento / Progressiva | Sexta passada | 14:00 - 15:30 | Cancelado | manual |
| Vinicius Ramos | Rafael Lima | Corte Masculino | Quinta passada | 17:00 - 17:30 | Nao compareceu | manual |

## Pendencias

- Fixar a data de referencia ("hoje" do cenario) usada para distribuir passado/presente/futuro nos mocks, para manter os exemplos estaveis entre telas.
- Definir o numero exato de agendamentos dentro da faixa 40-80 e a alocacao final por dia, garantindo o sabado cheio e a terca fraca.
- O almoço dos barbeiros seniores (Marcelo e Rafael, 12:00–13:00) é modelado como intervalo do horário de trabalho (breakStart/breakEnd), não como bloqueio avulso — aparece como faixa "Almoço" na Agenda e recusa agendamento nesse horário. Bloqueios avulsos (folga/indisponibilidade) são criados pela UI.
