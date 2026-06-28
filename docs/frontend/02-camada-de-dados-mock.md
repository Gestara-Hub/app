# Camada de Dados Mock

## Decisao

A UI nunca acessa mocks diretamente. O acesso a dados acontece sempre por uma cadeia bem definida:

```
UI (componentes/telas)
  -> hooks (TanStack Query: useQuery / useMutation)
    -> services (modulos async tipados, um por entidade)
      -> store em memoria (seedado do cenario Corte Nobre)
```

O mock imita um contrato de API HTTP. Toda funcao de service e assincrona (retorna `Promise`), com latencia simulada e erro simulado opcional. Trocar o mock por um backend real significa trocar SO a implementacao do service (o corpo das funcoes), mantendo a mesma assinatura, os mesmos tipos de retorno e o mesmo formato de erro. Hooks, queryKeys, telas e contratos nao mudam.

Esta e a doc-ponte entre `docs/product` (produto, regras, cenario) e o codigo do frontend. Ela fixa os contratos TypeScript, a forma dos services, a convencao de TanStack Query e como as regras de negocio do `05-regras-negocio.md` sao aplicadas no mock imitando o futuro backend.

## Contexto

- Stack: Next.js (App Router, RSC) + TypeScript strict, shadcn/ui + Tailwind CSS, TanStack Query sobre camada de servico mockada. Detalhes em `technical/00-decisoes-tecnicas.md`.
- TanStack Query e a camada de servico mockada rodam no cliente: o consumo de dados (hooks `useQuery`/`useMutation`) acontece em client components (`'use client'`). No MVP frontend-first nao ha backend nem fetch no servidor; o "backend" e a camada de service mockada que vive na memoria do browser.
- O store em memoria e seedado a partir do cenario canonico `docs/product/08-barbearia-corte-nobre.md` e persistido no localStorage do navegador (simula um banco): sobrevive a reloads. Um `SEED_VERSION` versiona o blob salvo; mudar a versao descarta o dado antigo e re-seeda. A tela Configuracoes oferece "Restaurar dados de exemplo". A persistencia roda so no cliente (no SSR/Node e no-op).
- As entidades e campos seguem `docs/product/04-mvp-barbearia.md`. As regras de conflito/disponibilidade/remarcacao/recorrencia seguem `docs/product/05-regras-negocio.md`. Os estados de carregando/vazio/erro e mensagens seguem `docs/product/10-estados-e-mensagens.md`.

## Escopo

- Contratos TypeScript (entidades, enums, filtros, formato de erro, formato de payloads de create/update).
- Camada de servico: um modulo por entidade, com funcoes CRUD async tipadas e acoes especificas de dominio.
- Store em memoria seedado do cenario Corte Nobre.
- Convencao de queryKeys, useQuery/useMutation e invalidacao.
- Mapeamento dos estados de Query (loading/error/empty) aos estados do `10-estados-e-mensagens.md`.
- Como o service mock valida regras de negocio (conflito, disponibilidade, profissional x servico, etc.).

## Fora de escopo

- Backend real, persistencia real e camada de API (fase 3).
- Implementacao de telas e componentes (ver demais docs de frontend).
- Validacao de formulario na UI: pertence ao doc de design system (React Hook Form + Zod).
- Roteamento (ver `frontend/03-rotas-e-navegacao.md`).
- Sistema de rotulos por segmento (label overrides) - previsao conceitual; o MVP usa linguagem unica e generica.

## Principio: mock como contrato de API

- O service e o unico ponto que conhece o mock. Para a UI, ele e indistinguivel de um cliente HTTP.
- Cada funcao de service:
  - e `async` e retorna uma `Promise` tipada;
  - simula latencia de rede (atraso configuravel);
  - pode simular erro de rede/negocio (probabilidade ou flag), sempre rejeitando com o mesmo formato de erro;
  - recebe e devolve apenas os tipos de contrato (nada de detalhe interno do store).
- Migracao para backend real: substituir o corpo das funcoes por chamadas `fetch`/cliente HTTP. A assinatura publica do service e o `ApiError` permanecem identicos. Nenhum hook ou tela precisa ser reescrito.

```ts
// Assinatura conceitual estavel entre mock e backend real.
// Hoje: le do store em memoria. Amanha: faz fetch. Mesmo contrato.
export type ServiceFn<Args extends unknown[], Result> = (
  ...args: Args
) => Promise<Result>;
```

## Contratos (TypeScript)

Os contratos abaixo sao 100% coerentes com `docs/product/04-mvp-barbearia.md` e `docs/product/08-barbearia-corte-nobre.md`. Em modo strict.

### Tipos base e enums

```ts
// Identificadores e datas.
// id: string opaca (uuid no mock). Datas/horarios como strings ISO-friendly
// para imitar um payload JSON de API.

export type Id = string;

// Data sem horario, formato 'YYYY-MM-DD' (ex.: '2026-06-26').
export type DataISO = string;

// Horario local 'HH:mm' (ex.: '09:00', '18:30').
export type HoraISO = string;

// Timestamp completo ISO 8601 (ex.: '2026-06-26T12:00:00.000Z').
export type DateTimeISO = string;

// Status generico de cadastro (Cliente, Profissional, Servico, Organizacao, Unidade).
export type StatusCadastro = 'ativo' | 'inativo';

// Chaves exatas do STACK CANON.
export type StatusAgendamento =
  | 'pendente'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'nao_compareceu';

// MVP: manual | recorrencia. Futuro (fora do MVP): online | whatsapp.
export type OrigemAgendamento = 'manual' | 'recorrencia';

export type Frequencia = 'semanal' | 'quinzenal' | 'mensal';

// Dia da semana para horarios de trabalho e funcionamento.
// 0 = domingo ... 6 = sabado.
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Faixa de horario de trabalho de um profissional em um dia.
export interface FaixaHorario {
  diaSemana: DiaSemana;
  inicio: HoraISO; // ex.: '09:00'
  fim: HoraISO; // ex.: '20:00'
}

// Categoria de servico (CANON Corte Nobre).
export type CategoriaServico = 'Cabelo' | 'Barba' | 'Cuidados' | 'Combos';
```

### Organizacao e Unidade

```ts
export interface Organizacao {
  id: Id;
  nome: string; // 'Corte Nobre'
  segmento: string; // 'Barbearia'
  status: StatusCadastro;
}

export interface FuncionamentoDia {
  diaSemana: DiaSemana;
  fechado: boolean; // domingo = true
  inicio?: HoraISO; // presente quando fechado = false
  fim?: HoraISO; // presente quando fechado = false
}

export interface Unidade {
  id: Id;
  organizacaoId: Id;
  nome: string; // 'Corte Nobre - Matriz'
  endereco?: string;
  telefone?: string;
  status: StatusCadastro;
  funcionamento: FuncionamentoDia[]; // horario de funcionamento da unidade
}
```

### Cliente

```ts
export interface Cliente {
  id: Id;
  organizacaoId: Id;
  nome: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  status: StatusCadastro;
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### Profissional

```ts
export interface Profissional {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  nome: string;
  cargo: string; // cargo ou especialidade (ex.: 'Barbeiro e proprietario')
  telefone?: string;
  status: StatusCadastro;
  horariosDeTrabalho: FaixaHorario[]; // respeita o funcionamento da unidade
  servicosIds: Id[]; // servicos que o profissional realiza (matriz do CANON)
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### Servico

```ts
export interface Servico {
  id: Id;
  organizacaoId: Id;
  nome: string;
  categoria: CategoriaServico;
  duracaoMinutos: number; // > 0
  precoCentavos: number; // >= 0 (armazenamento em centavos para precisao)
  descricao?: string;
  status: StatusCadastro;
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### Agendamento

```ts
export interface Agendamento {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  clienteId: Id;
  profissionalId: Id;
  servicoId: Id;
  data: DataISO; // 'YYYY-MM-DD'
  inicio: HoraISO; // 'HH:mm'
  fim: HoraISO; // derivado de inicio + duracaoMinutos do servico
  status: StatusAgendamento;
  origem: OrigemAgendamento;
  observacoes?: string;
  serieId?: Id; // presente quando faz parte de uma serie recorrente
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### Bloqueio

```ts
export interface Bloqueio {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  profissionalId: Id;
  data: DataISO;
  inicio: HoraISO;
  fim: HoraISO;
  motivo?: string; // ex.: 'Almoco', 'Folga'
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### SerieRecorrencia

```ts
export interface SerieRecorrencia {
  id: Id;
  organizacaoId: Id;
  unidadeId: Id;
  clienteId: Id;
  profissionalId: Id;
  servicoId: Id;
  frequencia: Frequencia;
  inicio: DataISO; // data da primeira ocorrencia
  hora: HoraISO; // horario fixo das ocorrencias (mesmo horario)
  // Exatamente um dos dois criterios de termino e definido (serie sempre finita).
  terminoPorOcorrencias?: number; // ex.: 4
  terminoPorData?: DataISO; // ex.: 3 meses a frente
  criadoEm: DateTimeISO;
  atualizadoEm: DateTimeISO;
}
```

### Payloads de create/update

Imitam o corpo de um POST/PATCH. Campos gerados pelo "servidor" (`id`, `criadoEm`, `atualizadoEm`, `fim` derivado) NAO entram no payload de create.

```ts
// Create: tudo que o cliente envia ao criar. O service gera id e timestamps.
export type CreateCliente = Omit<
  Cliente,
  'id' | 'criadoEm' | 'atualizadoEm'
>;
export type CreateProfissional = Omit<
  Profissional,
  'id' | 'criadoEm' | 'atualizadoEm'
>;
export type CreateServico = Omit<
  Servico,
  'id' | 'criadoEm' | 'atualizadoEm'
>;

// Agendamento manual: 'fim' e derivado da duracao do servico no service.
// 'origem' e fixada como 'manual' pelo service no create manual.
export type CreateAgendamento = Omit<
  Agendamento,
  'id' | 'fim' | 'origem' | 'status' | 'criadoEm' | 'atualizadoEm'
> & {
  status?: StatusAgendamento; // default 'pendente'
};

export type CreateBloqueio = Omit<
  Bloqueio,
  'id' | 'criadoEm' | 'atualizadoEm'
>;

// Update: PATCH parcial. id vai por argumento, nunca no corpo.
export type UpdateCliente = Partial<CreateCliente>;
export type UpdateProfissional = Partial<CreateProfissional>;
export type UpdateServico = Partial<CreateServico>;
export type UpdateAgendamento = Partial<CreateAgendamento>;
export type UpdateBloqueio = Partial<CreateBloqueio>;
```

### Tipos de filtro

```ts
export interface ClienteFiltro {
  busca?: string; // nome ou telefone
  status?: StatusCadastro;
}

export interface ProfissionalFiltro {
  busca?: string;
  status?: StatusCadastro;
  servicoId?: Id; // profissionais que realizam o servico
}

export interface ServicoFiltro {
  busca?: string;
  categoria?: CategoriaServico;
  status?: StatusCadastro;
}

export interface AgendamentoFiltro {
  // Periodo (inclusivo). Para a Agenda diaria, dataInicio === dataFim.
  dataInicio?: DataISO;
  dataFim?: DataISO;
  profissionalId?: Id;
  clienteId?: Id;
  status?: StatusAgendamento | StatusAgendamento[];
  origem?: OrigemAgendamento;
  serieId?: Id; // ocorrencias de uma serie
  busca?: string; // por cliente
}

export interface BloqueioFiltro {
  dataInicio?: DataISO;
  dataFim?: DataISO;
  profissionalId?: Id;
}
```

### Formato de erro simulado

Um unico formato de erro, imitando um erro de API. O mesmo objeto sera usado quando o backend real existir (basta mapear a resposta HTTP para `ApiError`).

```ts
export type ApiErrorCodigo =
  // Infra simulada
  | 'NETWORK' // falha de rede simulada (gera estado de erro de lista)
  | 'NOT_FOUND' // id inexistente
  | 'VALIDATION' // payload invalido (campos)
  // Regras de negocio (ver secao "Regras de negocio no service")
  | 'CONFLITO_SOBREPOSICAO' // horario ocupado para o profissional
  | 'FORA_DO_EXPEDIENTE' // fora do funcionamento da unidade/profissional
  | 'HORARIO_BLOQUEADO' // cai sobre um bloqueio
  | 'PROFISSIONAL_NAO_REALIZA_SERVICO'
  | 'PROFISSIONAL_INATIVO'
  | 'SERVICO_INATIVO';

export interface ApiErrorCampo {
  campo: string; // ex.: 'nome', 'precoCentavos'
  mensagem: string; // texto de referencia do doc 10
}

export interface ApiError {
  codigo: ApiErrorCodigo;
  // Mensagem amigavel (alinhada ao doc 10-estados-e-mensagens.md).
  mensagem: string;
  // Detalhes por campo para erros de validacao de formulario.
  campos?: ApiErrorCampo[];
  // Status HTTP equivalente (para quando virar backend real).
  statusHttp?: number; // 400 | 404 | 409 | 422 | 500
}

// Type guard para uso nos hooks/telas.
export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'codigo' in e &&
    'mensagem' in e
  );
}
```

## Store em memoria

- Modulo unico (ex.: `store`) que mantem as colecoes em memoria: organizacao, unidade, clientes, profissionais, servicos, agendamentos, bloqueios, series.
- Seedado a partir do cenario canonico `docs/product/08-barbearia-corte-nobre.md` (1 organizacao, 1 unidade, 4 profissionais, 12 servicos, ~20 clientes, 40-80 agendamentos, >=2 series, >=1 bloqueio, ao menos 1 remarcado com rastro).
- Persistido no localStorage do navegador (chave `gestarahub:db`, blob versionado por `SEED_VERSION`): sobrevive a reloads. Hidrata na 1a carga do modulo e regrava a cada escrita (via `simulateWrite`). No SSR/Node e no-op (apenas em memoria).
- Apenas os services leem/escrevem no store. A UI nunca importa o store.
- Convencao: o store guarda os registros "como o banco guardaria"; os services aplicam regras, derivam campos (ex.: `fim`) e montam os tipos de contrato no retorno.
- A data de referencia ("hoje" do cenario) deve ser fixada num unico ponto do seed para manter passado/presente/futuro estaveis entre telas (pendencia herdada do doc 08).

```ts
// Forma conceitual do store (interno; nao exportar para a UI).
interface MockStore {
  organizacao: Organizacao;
  unidade: Unidade;
  clientes: Cliente[];
  profissionais: Profissional[];
  servicos: Servico[];
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  series: SerieRecorrencia[];
}
```

## Camada de servico

Um modulo por entidade. Funcoes CRUD padrao mais acoes especificas de dominio. Todas async, com latencia simulada e erro simulado opcional.

### CRUD base (forma comum)

Todo service de cadastro segue a mesma forma:

```ts
interface CrudService<T, Create, Update, Filtro> {
  list(filtro?: Filtro): Promise<T[]>;
  getById(id: Id): Promise<T>; // rejeita ApiError NOT_FOUND se nao existir
  create(payload: Create): Promise<T>;
  update(id: Id, payload: Update): Promise<T>;
  remove(id: Id): Promise<void>;
}
```

### clientesService

```ts
export const clientesService: CrudService<
  Cliente,
  CreateCliente,
  UpdateCliente,
  ClienteFiltro
>;
// remove = inativacao logica (status -> 'inativo'); cliente permanece no historico.
```

### profissionaisService

```ts
export const profissionaisService: CrudService<
  Profissional,
  CreateProfissional,
  UpdateProfissional,
  ProfissionalFiltro
>;
// remove = inativacao logica (status -> 'inativo'); inativo nao e sugerido em novos agendamentos.
```

### servicosService

```ts
export const servicosService: CrudService<
  Servico,
  CreateServico,
  UpdateServico,
  ServicoFiltro
>;
// remove = inativacao logica (status -> 'inativo'); inativo nao e sugerido em novos agendamentos.
```

### agendamentosService

CRUD base mais acoes de dominio. O `create` aplica todas as regras de agendamento (ver "Regras de negocio no service").

```ts
export interface AgendamentosService
  extends CrudService<
    Agendamento,
    CreateAgendamento,
    UpdateAgendamento,
    AgendamentoFiltro
  > {
  // Move horario e/ou profissional, mantendo cliente e servico.
  // Sujeito as mesmas regras de conflito/disponibilidade de um novo agendamento.
  // NAO conclui o agendamento. Registra rastro no historico.
  remarcar(
    id: Id,
    destino: {
      data?: DataISO;
      inicio?: HoraISO;
      profissionalId?: Id;
    },
    // Escopo quando o agendamento pertence a uma serie.
    escopo?: EscopoSerie,
  ): Promise<Agendamento>;

  // Transicao de status (confirmar, iniciar, concluir, cancelar, no-show).
  mudarStatus(id: Id, status: StatusAgendamento): Promise<Agendamento>;
}

// Escopo de acoes sobre ocorrencias de serie (ver doc 10).
export type EscopoSerie = 'somente_esta' | 'esta_e_futuras';

export const agendamentosService: AgendamentosService;
```

### bloqueiosService

```ts
export const bloqueiosService: CrudService<
  Bloqueio,
  CreateBloqueio,
  UpdateBloqueio,
  BloqueioFiltro
>;
// create rejeita se o bloqueio se sobrepoe a um agendamento existente do profissional.
```

### seriesService

Criacao e manutencao de series recorrentes. A criacao gera as ocorrencias e trata conflitos: ocorrencias em conflito NAO sao criadas e sao retornadas sinalizadas para resolucao manual.

```ts
export interface CriarSeriePayload {
  clienteId: Id;
  profissionalId: Id;
  servicoId: Id;
  frequencia: Frequencia;
  inicio: DataISO;
  hora: HoraISO;
  // Exatamente um dos dois (serie finita).
  terminoPorOcorrencias?: number;
  terminoPorData?: DataISO;
}

// Uma ocorrencia que cairia em conflito e nao foi criada.
export interface OcorrenciaEmConflito {
  data: DataISO;
  inicio: HoraISO;
  fim: HoraISO;
  motivo: Extract<
    ApiErrorCodigo,
    'CONFLITO_SOBREPOSICAO' | 'FORA_DO_EXPEDIENTE' | 'HORARIO_BLOQUEADO'
  >;
}

export interface CriarSerieResultado {
  serie: SerieRecorrencia;
  // Ocorrencias efetivamente criadas (origem 'recorrencia', com serieId).
  criados: Agendamento[];
  // Ocorrencias sinalizadas como conflito e NAO criadas (resolucao manual).
  conflitos: OcorrenciaEmConflito[];
}

export interface SeriesService {
  getById(id: Id): Promise<SerieRecorrencia>;

  // Gera as ocorrencias finitas; cria as sem conflito e devolve os conflitos.
  criarSerie(payload: CriarSeriePayload): Promise<CriarSerieResultado>;

  // Lista as ocorrencias (agendamentos) de uma serie por serieId.
  listarOcorrencias(serieId: Id): Promise<Agendamento[]>;

  // Cancela/remove ocorrencias da serie respeitando o escopo.
  // 'esta_e_futuras' nao altera ocorrencias ja concluidas.
  cancelarSerie(
    serieId: Id,
    aPartirDeAgendamentoId: Id,
    escopo: EscopoSerie,
  ): Promise<{ removidos: Id[] }>;
}

export const seriesService: SeriesService;
```

### Latencia e erro simulados

```ts
// Configuracao central do comportamento simulado.
export interface MockConfig {
  latenciaMs: number; // ex.: 300; aplicado em toda chamada
  // Probabilidade [0..1] de injetar ApiError 'NETWORK' nas leituras (list/getById).
  // Em 0 desliga o erro aleatorio. Util para exercitar o estado de erro do doc 10.
  taxaErroLeitura: number;
}

// Helper conceitual usado por todos os services.
// async () => { await sleep(latenciaMs); if (deveFalhar) throw networkError(); return dados; }
```

- Latencia: toda funcao espera `latenciaMs` antes de resolver, exercitando os estados de carregando.
- Erro de leitura: controlado por `taxaErroLeitura` (e/ou um flag por chamada em dev) para exercitar o estado de erro simulado de lista. Sempre rejeita com `ApiError` de codigo `NETWORK`.
- Erros de negocio e validacao nao sao aleatorios: vem das regras (secao abaixo).

## Regras de negocio no service

O service mock aplica as regras de `docs/product/05-regras-negocio.md` exatamente onde o backend real aplicaria. Isso mantem a UI honesta: ela ja lida hoje com os mesmos erros que recebera amanha.

### Validacao de campos (create/update)

Antes de qualquer regra de agenda, valida os campos do payload e, se invalido, rejeita com `ApiError` codigo `VALIDATION` e `campos[]` preenchido com as mensagens de referencia do `10-estados-e-mensagens.md`. Exemplos:

- Servico: `duracaoMinutos > 0`; `precoCentavos >= 0` (nunca negativo); categoria valida.
- Cliente: nome e telefone obrigatorios; email valido se preenchido.
- Profissional: nome e cargo obrigatorios; ao menos um `servicosIds`; em cada `FaixaHorario`, `inicio` antes de `fim`.

Esta e a validacao do "servidor" (regra de negocio). A validacao de formulario na UI (React Hook Form + Zod) e tratada no doc de design system e e independente: o service continua sendo a fonte de verdade das regras.

### Validacao de agendamento (create e remarcar)

Aplicada por `agendamentosService.create` e por `agendamentosService.remarcar`, na seguinte ordem (primeira que falha rejeita):

1. Campos obrigatorios: clienteId, profissionalId, servicoId, data, inicio.
2. Profissional realiza o servico: `servicoId` em `profissional.servicosIds`, senao `PROFISSIONAL_NAO_REALIZA_SERVICO`.
3. Profissional ativo: senao `PROFISSIONAL_INATIVO`.
4. Servico ativo: senao `SERVICO_INATIVO`.
5. Derivar `fim` = `inicio` + `servico.duracaoMinutos`.
6. Expediente: `[inicio, fim]` dentro do funcionamento da unidade no dia E dentro dos `horariosDeTrabalho` do profissional. Senao `FORA_DO_EXPEDIENTE`. (Domingo fechado cai aqui.)
7. Bloqueio: `[inicio, fim]` nao pode tocar nenhum `Bloqueio` do profissional naquela data. Senao `HORARIO_BLOQUEADO`.
8. Sobreposicao: `[inicio, fim]` nao pode se sobrepor a outro agendamento do mesmo profissional na data (ignorando status `cancelado` e `nao_compareceu`, e ignorando o proprio agendamento na remarcacao). Senao `CONFLITO_SOBREPOSICAO`. No MVP nao ha encaixe: sempre bloqueia.

Cada `ApiError` carrega a `mensagem` de referencia do doc 10 (ex.: `CONFLITO_SOBREPOSICAO` -> "Este horario ja esta ocupado para [Profissional].").

### Remarcacao

- Mantem `clienteId` e `servicoId`; altera apenas `data`, `inicio` e/ou `profissionalId` (e recalcula `fim`).
- Passa pela mesma cadeia de validacao do create (passos 2-8 acima), ignorando o proprio agendamento na checagem de sobreposicao.
- NAO muda o status para `concluido`; preserva o status atual.
- Registra rastro no historico (horario/profissional anterior e novo). Formato do rastro e pendencia (ver doc 05/10).
- Se `serieId` presente, exige `escopo` (`somente_esta` | `esta_e_futuras`).

### Mudanca de status

- `mudarStatus` aplica a transicao solicitada. Cancelado e nao_compareceu mantem o registro no historico (nao removem).
- Agendamento `concluido` nao deve ser editado livremente como futuro (a UI restringe; o service pode recusar updates de campos de agenda em concluidos).

### Recorrencia (criarSerie)

- Gera as ocorrencias finitas conforme `frequencia` e o termino (`terminoPorOcorrencias` OU `terminoPorData`); nunca infinita.
- Para cada ocorrencia, roda a validacao de agendamento (passos 5-8).
- Ocorrencias validas sao criadas com `origem: 'recorrencia'` e o mesmo `serieId`.
- Ocorrencias em conflito (ocupado, fora do expediente ou bloqueio) NAO sao criadas; voltam em `conflitos[]` para resolucao manual. As demais sao criadas normalmente.
- Cancelamento por escopo: `esta_e_futuras` nao altera ocorrencias ja `concluido`.

### Bloqueios

- `bloqueiosService.create` recusa um bloqueio que se sobreponha a um agendamento ativo do profissional (evita bloquear um horario ja ocupado sem resolucao).
- Bloqueios participam das checagens 7 acima de create/remarcar/recorrencia.

## TanStack Query

A UI consome os services apenas via hooks de TanStack Query. Isso da cache, estados de carregando/erro e invalidacao consistentes.

No Next App Router, esses hooks rodam em client components: todo arquivo de hook (e o componente que o consome) leva a diretiva `'use client'`. O `QueryClientProvider` e montado uma unica vez, num componente `'use client'` (ex.: `Providers`) renderizado no root layout (`src/app/layout.tsx`), envolvendo a arvore da aplicacao. O `QueryClient` deve ser instanciado dentro desse componente (via `useState`/`useRef`), nunca no escopo de modulo, para nao compartilhar cache entre requisicoes/usuarios no servidor.

```tsx
// src/lib/providers.tsx (ou src/app/providers.tsx)
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  // Instancia por arvore de cliente, nao no escopo de modulo.
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

```tsx
// src/app/layout.tsx (root layout) - monta o Provider uma vez.
import { Providers } from '@/lib/providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Referencias de API (manter conceitual, confirmar assinaturas na doc oficial):
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview

### Convencao de queryKeys

Hierarquia estavel: `[entidade]` para listas globais, `[entidade, filtro]` para listas filtradas, `[entidade, id]` para detalhe. Filtros entram como objeto serializavel (o Query faz hash estrutural).

```ts
export const queryKeys = {
  clientes: {
    all: ['clientes'] as const,
    list: (filtro?: ClienteFiltro) => ['clientes', 'list', filtro] as const,
    detail: (id: Id) => ['clientes', 'detail', id] as const,
  },
  profissionais: {
    all: ['profissionais'] as const,
    list: (filtro?: ProfissionalFiltro) =>
      ['profissionais', 'list', filtro] as const,
    detail: (id: Id) => ['profissionais', 'detail', id] as const,
  },
  servicos: {
    all: ['servicos'] as const,
    list: (filtro?: ServicoFiltro) => ['servicos', 'list', filtro] as const,
    detail: (id: Id) => ['servicos', 'detail', id] as const,
  },
  agendamentos: {
    all: ['agendamentos'] as const,
    list: (filtro?: AgendamentoFiltro) =>
      ['agendamentos', 'list', filtro] as const, // ex.: ['agendamentos','list', { dataInicio, dataFim, profissionalId }]
    detail: (id: Id) => ['agendamentos', 'detail', id] as const,
    ocorrencias: (serieId: Id) =>
      ['agendamentos', 'serie', serieId] as const,
  },
  bloqueios: {
    all: ['bloqueios'] as const,
    list: (filtro?: BloqueioFiltro) => ['bloqueios', 'list', filtro] as const,
  },
  series: {
    detail: (id: Id) => ['series', 'detail', id] as const,
  },
} as const;
```

### useQuery (leitura)

```ts
'use client';

// Exemplo: lista de agendamentos da Agenda (um dia, um profissional).
export function useAgendamentos(filtro?: AgendamentoFiltro) {
  return useQuery({
    queryKey: queryKeys.agendamentos.list(filtro),
    queryFn: () => agendamentosService.list(filtro),
  });
}

// Exemplo: detalhe de cliente.
export function useCliente(id: Id) {
  return useQuery({
    queryKey: queryKeys.clientes.detail(id),
    queryFn: () => clientesService.getById(id),
    enabled: Boolean(id),
  });
}
```

### useMutation + invalidacao

Toda mutation invalida as queries afetadas no `onSuccess`, para a UI refletir o novo estado do store.

```ts
'use client';

export function useCriarAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgendamento) =>
      agendamentosService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
    },
  });
}

export function useRemarcarAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: Id;
      destino: { data?: DataISO; inicio?: HoraISO; profissionalId?: Id };
      escopo?: EscopoSerie;
    }) => agendamentosService.remarcar(vars.id, vars.destino, vars.escopo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
    },
  });
}

export function useCriarSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarSeriePayload) =>
      seriesService.criarSerie(payload),
    onSuccess: () => {
      // Ocorrencias geradas afetam a lista de agendamentos.
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos.all });
    },
    // O componente le 'conflitos' do resultado para sinalizar a resolucao manual.
  });
}
```

Convencoes de invalidacao por mutation:

| Mutation | Invalida |
| --- | --- |
| create/update/remove Cliente | `queryKeys.clientes.all` |
| create/update/remove Profissional | `queryKeys.profissionais.all` |
| create/update/remove Servico | `queryKeys.servicos.all` |
| create/update/remarcar/mudarStatus Agendamento | `queryKeys.agendamentos.all` |
| create/remove Bloqueio | `queryKeys.bloqueios.all` e `queryKeys.agendamentos.all` |
| criarSerie / cancelarSerie | `queryKeys.agendamentos.all` |

### Mapeamento de estados (Query -> doc 10)

Os estados de TanStack Query mapeiam diretamente aos estados de `docs/product/10-estados-e-mensagens.md`.

| Estado da Query | Estado do doc 10 | O que a UI mostra |
| --- | --- | --- |
| `isPending` (sem dados em cache) | Carregando | Skeleton/spinner; nao renderizar "vazio". |
| `isError` (`ApiError` `NETWORK`) | Erro simulado | Mensagem de erro + "Tentar novamente" (`refetch`). |
| `isSuccess` e `data.length === 0`, sem filtro/busca | Vazio (sem dados) | Empty state com call-to-action (cadastrar/novo). |
| `isSuccess` e `data.length === 0`, com filtro/busca | Vazio por filtro/busca | "Nenhum resultado..." + "Limpar busca/filtros". |
| `isSuccess` e `data.length > 0` | Com dados | Lista preenchida. |

- O texto exato de cada estado (por contexto: Clientes, Equipe, Servicos, Agendamentos, Agenda) vem do doc 10.
- "Vazio por filtro/busca" e derivado na UI: ha filtro/busca ativo E resultado vazio. O service nao distingue os dois vazios.
- Mutations que retornam `ApiError` de negocio (ex.: `CONFLITO_SOBREPOSICAO`) alimentam as mensagens de conflito/validacao do doc 10, perto do campo ou no dialogo de confirmacao. Usar `isApiError(error)` para extrair `mensagem`/`campos`.

## Estrutura de arquivos

Esta camada segue a estrutura canonica definida em `frontend/01-arquitetura.md`. Dentro de `apps/web`:

```
apps/web/src/
  types/            # contratos deste doc: entidades, enums, filtros, payloads, ApiError
    cliente.ts
    profissional.ts
    servico.ts
    agendamento.ts
    bloqueio.ts
    serie.ts
    comuns.ts       # Id, DataISO, HoraISO, ApiError e tipos compartilhados
  mocks/            # store em memoria + seed (interno; so os services tocam o store)
    store.ts        # store em memoria
    seed.ts         # seed do cenario Corte Nobre (doc 08)
    config.ts       # MockConfig (latencia, taxa de erro)
    helpers.ts      # sleep, geracao de id, ApiError factory, checagens de agenda
  services/         # async tipado = contrato de API (unico ponto que toca o store)
    clientesService.ts
    profissionaisService.ts
    servicosService.ts
    agendamentosService.ts
    bloqueiosService.ts
    seriesService.ts
  features/<dominio>/hooks/   # hooks TanStack Query (useQuery/useMutation), 'use client', por feature
    # ex.: features/agendamentos/hooks/useAgendamentos.ts
  lib/
    providers.tsx   # 'use client': QueryClientProvider (montado no root layout)
    queryKeys.ts    # convencao de queryKeys (ver secao acima)
```

Separacao logica: contratos (`types`) -> store/seed (`mocks`) -> services -> hooks de Query (por feature, client components). A regra de fronteira (a UI nunca toca os mocks; so os services tocam o store) e os caminhos finais estao em `frontend/01-arquitetura.md`.

## Pendencias

- Fixar a data de referencia ("hoje" do cenario) no seed para estabilizar passado/presente/futuro (herdado do doc 08).
- Definir o formato do rastro de remarcacao e do historico de auditoria (alinhar com doc 05/10).
- Definir o fluxo de UI para resolver `conflitos[]` de `criarSerie` (resolucao manual das ocorrencias sinalizadas).
- Confirmar caminhos de pasta e nomes finais em `frontend/01-arquitetura.md`.
- Decidir se `MockConfig.taxaErroLeitura` fica ativa por padrao em dev ou so via flag manual.
