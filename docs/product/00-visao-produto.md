# Visao do Produto

> 🚀 **DIRETRIZ ATUAL DO MVP:**
> O primeiro ciclo de validação e lançamento do GestaraHub foi priorizado para o **Modelo 3 (Turmas & Aulas / Academia de Lutas)**, guiado por um parceiro de design real no tatame (Jiu-Jitsu).
> O cenário do Modelo 1 (Barbearia "Corte Nobre") permanece implementado como base arquitetural de atendimento individual, mas está com escopo **congelado** em standby.
> Ver especificação do foco ativo em [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md) e [11-modelo-3-turmas.md](11-modelo-3-turmas.md).

## Decisao

GestaraHub e uma plataforma de gestao operacional multi-tenant para pequenos e medios negocios organizarem compromissos, turmas, clientes/alunos, equipe e cobrancas.

A plataforma suporta tres modelos operacionais distintos (`scheduling`, `classes` e `delivery`). O MVP ativo esta concentrado em **Turmas & Aulas (Modelo 3)** para academias de artes marciais, mantendo fundacao compartilhada e contratos neutros.

### Decisao de linguagem (hibrida)

A linguagem do produto e hibrida:

- A interface usa termos simples e genericos (Clientes, Equipe, Servicos, Agenda), mas **a navegacao e alguns rotulos ja mudam conforme o modelo operacional do tenant** (`Organization.model`):
  - `scheduling` (Modelo 1): Dashboard, Clientes, Equipe, Servicos, Agenda.
  - `classes` (Modelo 3): Dashboard, Alunos, Equipe, Turmas, Calendario, Modalidades, Planos, Mensalidades.
  - Rodape (todos os modelos, conforme permissao): Usuarios, Auditoria, Configuracoes.
- Nao existe mais item de menu "Agendamentos": Agenda e Agendamentos foram unificados em `/schedule` (abas Calendario e Lista); `/appointments` apenas redireciona para `/schedule`.
- **Rotulos por modelo: parcialmente implementado.** A troca e fixa por modelo operacional (menu em `components/layout/nav.ts`; substantivos de mensagens e auditoria em `services/nouns.ts` e `lib/labels.ts`: na academia, cliente vira "aluno" e categoria vira "modalidade"). Ainda nao ha rotulos por segmento configuraveis pelo tenant (label overrides): isso continua previsao futura.

No vocabulario de navegacao, "Equipe" e o rotulo do menu; "Profissional" e usado no contexto de um agendamento e em telas de detalhe (no Modelo 3, os formularios falam em "Professor / Instrutor").

Detalhes de tenant, modelo e escopo: [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md).

## Contexto

A ideia inicial era uma aplicacao de controle de agendamentos para negocios como barbearias, saloes, docerias e operacoes com aulas ou turmas. Durante a evolucao, surgiram ideias de modulos gerenciais e add-ons, mas o escopo cresceu demais e dificultou a continuidade.

A retomada do projeto deve reduzir o escopo inicial sem descartar a visao maior. A estrategia e validar primeiro o frontend com dados mockados realistas, garantindo que fluxos, telas e regras operacionais facam sentido antes de investir na camada de backend.

O projeto e construido do zero. Nada da v1 (old/gestarahub-web, old/gestarahub-api) sera reaproveitado.

## Publico-alvo inicial

Pequenos e medios negocios que precisam organizar compromissos com clientes, equipe, horarios, servicos, entregas ou aulas.

Exemplos:

- Barbearias
- Saloes de beleza
- Clinicas pequenas
- Consultorias
- Docerias e confeitarias
- Professores autonomos
- Escolas pequenas
- Negocios com turmas, como judo, danca, musica ou idiomas

## Tese do produto

GestaraHub deve ser simples o bastante para um pequeno negocio usar no dia a dia, mas estruturado o bastante para crescer em modulos sem virar um sistema refeito do zero.

O centro do produto e a agenda operacional: um lugar para entender quem sera atendido, por quem, quando, com qual servico, em qual status e com quais proximas acoes.

## Principios

- Comecar pequeno e bem acabado.
- Priorizar clareza operacional sobre complexidade gerencial.
- Usar linguagem simples para o usuario final.
- Adotar uma linguagem simples e generica, com rotulos que mudam por modelo operacional (ex.: "Alunos" na academia); rotulos configuraveis por segmento ficam para o futuro.
- Preparar a arquitetura conceitual para unidades e modulos futuros.
- Mockar dados no frontend como se fossem contratos reais de API.
- Evitar construir backend antes de validar fluxos e experiencia.

## Escopo atual (frontend mockado)

O MVP ativo e a **academia (Modelo 3, `classes`)**. A barbearia Corte Nobre (Modelo 1, `scheduling`) foi o primeiro recorte construido e continua funcionando, com escopo congelado (ver banner de [04-mvp-barbearia.md](04-mvp-barbearia.md)). O seed cria os dois tenants vazios, so com o proprietario; tudo e cadastrado pela UI.

Fundacao compartilhada (todos os modelos):

- Login mockado por selecao de usuario (lista usuarios de todas as organizacoes; trocar de usuario troca de organizacao).
- Clientes/Alunos, Equipe (com Cargos opcionais).
- Usuarios e RBAC por perfil (Proprietario, Gerente, Atendente, Profissional). Ver [06-perfis-permissoes.md](06-perfis-permissoes.md).
- Auditoria (log imutavel das acoes, com visibilidade por perfil).
- Dashboard por modelo (atendimento ou academia).
- Configuracoes editaveis: organizacao, unidade, contato, endereco, horarios de funcionamento com varios turnos, dados de exemplo (zerar mocks) e, na academia, Regras de Cobranca.
- Checklist de primeiros passos (onboarding) e tour guiado, com passos diferentes por modelo.
- Personalizador de tema (cor, destaque, raio, fonte, cor do menu; sidebar escura por padrao). Ver [`../frontend/06-decisoes-de-interface.md`](../frontend/06-decisoes-de-interface.md).

Modelo 1 (atendimento individual):

- Servicos (com categorias opcionais), Agenda (Calendario Dia/Semana/Mes + Lista).
- Agendamento com um ou mais servicos, status operacionais, remarcacao, bloqueio de horario e recorrencia simples.

Modelo 3 (turmas):

- Modalidades, Turmas, Calendario de aulas, matricula, lista de espera, aula avulsa e experimental, instrutor substituto, presenca.
- Planos (mensal, quinzenal, semanal) e Mensalidades com regras de cobranca da academia ([15-regras-de-cobranca.md](15-regras-de-cobranca.md)). Registro de pagamento manual com forma de pagamento; sem gateway.

## Fora de escopo atual

- Backend real e banco de dados real.
- Autenticacao real (senha, convite por e-mail).
- Gateway de pagamento, cobranca automatica, emissao fiscal.
- Estoque.
- Comissoes.
- WhatsApp e automacoes.
- Encaixe manual com sobreposicao para o mesmo profissional (sobreposicao e bloqueio continuam bloqueando).
- Rotulos por segmento configuraveis pelo tenant (label overrides).
- Modelo 2 (entrega/encomenda): tipado (`delivery`), sem telas.
- Multiunidade completa (Fase 5).
- Relatorios gerenciais avancados e financeiro completo do tenant.

## Pendencias

- (Sem pendencias abertas nesta rodada.)
