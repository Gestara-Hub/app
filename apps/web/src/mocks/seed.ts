import type {
  Cliente,
  DiaSemana,
  FaixaHorario,
  Organizacao,
  Profissional,
  Servico,
  Unidade,
} from "@/types";
import { ORG_ID, UNIDADE_ID } from "@/config/tenant";
import type { MockStore } from "./store";

/**
 * Seed do cenario canonico "Corte Nobre" (docs/product/08-barbearia-corte-nobre.md):
 * 1 organizacao, 1 unidade, 12 servicos, 4 profissionais e 20 clientes.
 *
 * A data de referencia ("hoje" do cenario) e fixada aqui para estabilizar
 * passado/presente/futuro entre as telas.
 *
 * NOTA: agendamentos, series e bloqueios entram quando os modulos de Agenda /
 * Agendamentos forem implementados; por ora as colecoes nascem vazias.
 */

// "Hoje" do cenario (2026-06-27 e um sabado, dia de maior movimento).
export const REFERENCE_DATE = "2026-06-27";
const SEED_NOW = "2026-06-20T12:00:00.000Z";

// IDs estaveis e legiveis dos 12 servicos (facilita a matriz profissional x servico).
const S = {
  corteMasculino: "svc-corte-masculino",
  corteDegrade: "svc-corte-degrade",
  corteInfantil: "svc-corte-infantil",
  pezinho: "svc-pezinho",
  barba: "svc-barba",
  barbaNavalhada: "svc-barba-navalhada",
  pigmentacaoBarba: "svc-pigmentacao-barba",
  sobrancelha: "svc-sobrancelha",
  hidratacao: "svc-hidratacao",
  relaxamento: "svc-relaxamento",
  comboCorteBarba: "svc-combo-corte-barba",
  comboCompleto: "svc-combo-completo",
} as const;

function timestamps() {
  return { criadoEm: SEED_NOW, atualizadoEm: SEED_NOW };
}

// --- Organizacao + Unidade -------------------------------------------------

function seedOrganizacao(): Organizacao {
  return {
    id: ORG_ID,
    nome: "Corte Nobre",
    segmento: "Barbearia",
    status: "ativo",
  };
}

function seedUnidade(): Unidade {
  return {
    id: UNIDADE_ID,
    organizacaoId: ORG_ID,
    nome: "Corte Nobre - Matriz",
    endereco: "Rua das Tesouras, 120 - Centro",
    telefone: "(11) 4002-8922",
    status: "ativo",
    funcionamento: [
      { diaSemana: 0, fechado: true },
      { diaSemana: 1, fechado: false, inicio: "09:00", fim: "20:00" },
      { diaSemana: 2, fechado: false, inicio: "09:00", fim: "20:00" },
      { diaSemana: 3, fechado: false, inicio: "09:00", fim: "20:00" },
      { diaSemana: 4, fechado: false, inicio: "09:00", fim: "20:00" },
      { diaSemana: 5, fechado: false, inicio: "09:00", fim: "20:00" },
      { diaSemana: 6, fechado: false, inicio: "08:00", fim: "18:00" },
    ],
  };
}

// --- Servicos (12) ---------------------------------------------------------

function seedServicos(): Servico[] {
  const base = (
    id: string,
    nome: string,
    categoria: Servico["categoria"],
    duracaoMinutos: number,
    precoCentavos: number,
    descricao: string,
  ): Servico => ({
    id,
    organizacaoId: ORG_ID,
    nome,
    categoria,
    duracaoMinutos,
    precoCentavos,
    descricao,
    status: "ativo",
    ...timestamps(),
  });

  return [
    base(S.corteMasculino, "Corte Masculino", "Cabelo", 30, 4500, "Corte clássico na tesoura e máquina."),
    base(S.corteDegrade, "Corte Degradê", "Cabelo", 40, 5500, "Degradê com transição suave."),
    base(S.corteInfantil, "Corte Infantil", "Cabelo", 30, 4000, "Corte para crianças."),
    base(S.pezinho, "Pezinho / Acabamento", "Cabelo", 15, 2000, "Acabamento de contorno entre cortes."),
    base(S.barba, "Barba", "Barba", 30, 3500, "Aparo e modelagem da barba."),
    base(S.barbaNavalhada, "Barba Navalhada", "Barba", 40, 4500, "Barba feita na navalha com toalha quente."),
    base(S.pigmentacaoBarba, "Pigmentação de Barba", "Barba", 45, 6000, "Preenchimento e pigmentação de falhas."),
    base(S.sobrancelha, "Sobrancelha", "Cuidados", 15, 2000, "Design de sobrancelha masculina."),
    base(S.hidratacao, "Hidratação Capilar", "Cuidados", 30, 4000, "Hidratação e nutrição dos fios."),
    base(S.relaxamento, "Relaxamento / Progressiva", "Cuidados", 90, 12000, "Alisamento e redução de volume."),
    base(S.comboCorteBarba, "Combo Corte + Barba", "Combos", 60, 7500, "Corte masculino com barba."),
    base(S.comboCompleto, "Combo Completo (Corte + Barba + Sobrancelha)", "Combos", 75, 9000, "Corte, barba e sobrancelha."),
  ];
}

// --- Profissionais (4) -----------------------------------------------------

// Horario de trabalho do profissional = funcionamento da unidade nos dias uteis dele.
function hoursForDay(d: DiaSemana): { inicio: string; fim: string } {
  return d === 6
    ? { inicio: "08:00", fim: "18:00" }
    : { inicio: "09:00", fim: "20:00" };
}

function horarios(dias: DiaSemana[]): FaixaHorario[] {
  return dias.map((diaSemana) => ({ diaSemana, ...hoursForDay(diaSemana) }));
}

const TODOS_SERVICOS = Object.values(S);

function seedProfissionais(): Profissional[] {
  const base = (
    id: string,
    nome: string,
    cargo: string,
    telefone: string,
    dias: DiaSemana[],
    servicosIds: string[],
  ): Profissional => ({
    id,
    organizacaoId: ORG_ID,
    unidadeId: UNIDADE_ID,
    nome,
    cargo,
    telefone,
    status: "ativo",
    horariosDeTrabalho: horarios(dias),
    servicosIds,
    ...timestamps(),
  });

  return [
    base(
      "prof-marcelo",
      "Marcelo Andrade",
      "Barbeiro e proprietário",
      "(11) 98800-0001",
      [1, 2, 3, 4, 5, 6], // Seg a Sab
      [...TODOS_SERVICOS], // todos os 12
    ),
    base(
      "prof-rafael",
      "Rafael Lima",
      "Barbeiro",
      "(11) 98800-0002",
      [2, 3, 4, 5, 6], // Ter a Sab
      TODOS_SERVICOS.filter((id) => id !== S.relaxamento),
    ),
    base(
      "prof-bruno",
      "Bruno Costa",
      "Barbeiro",
      "(11) 98800-0003",
      [1, 2, 3, 4, 5], // Seg a Sex
      TODOS_SERVICOS.filter((id) => id !== S.corteInfantil),
    ),
    base(
      "prof-diego",
      "Diego Santos",
      "Barbeiro júnior",
      "(11) 98800-0004",
      [3, 4, 5, 6], // Qua a Sab
      [S.corteMasculino, S.corteDegrade, S.corteInfantil, S.pezinho, S.barba, S.sobrancelha],
    ),
  ];
}

// --- Clientes (20) ---------------------------------------------------------

function seedClientes(): Cliente[] {
  const base = (
    id: string,
    nome: string,
    telefone: string,
    status: Cliente["status"],
    observacoes: string,
  ): Cliente => ({
    id,
    organizacaoId: ORG_ID,
    nome,
    telefone,
    observacoes,
    status,
    ...timestamps(),
  });

  return [
    base("cli-joao-pereira", "João Pereira", "(11) 99100-0001", "ativo", "Cliente fiel; prefere Marcelo; corte clássico mensal."),
    base("cli-carlos-mendes", "Carlos Mendes", "(11) 99100-0002", "ativo", "Combo Corte + Barba quinzenal aos sábados."),
    base("cli-anderson-silva", "Anderson Silva", "(11) 99100-0003", "ativo", "Gosta de degradê; costuma agendar com Rafael."),
    base("cli-lucas-ferreira", "Lucas Ferreira", "(11) 99100-0004", "ativo", "Traz o filho para o Corte Infantil."),
    base("cli-pedro-henrique", "Pedro Henrique Alves", "(11) 99100-0005", "ativo", "Primeiro atendimento recente; ainda sem profissional fixo."),
    base("cli-gustavo-rocha", "Gustavo Rocha", "(11) 99100-0006", "ativo", "Barba e pigmentação com Bruno."),
    base("cli-felipe-cardoso", "Felipe Cardoso", "(11) 99100-0007", "ativo", "Corte Masculino mensal; flexível de profissional."),
    base("cli-thiago-barbosa", "Thiago Barbosa", "(11) 99100-0008", "ativo", "Combo Completo de vez em quando; gosta de sobrancelha."),
    base("cli-rodrigo-nunes", "Rodrigo Nunes", "(11) 99100-0009", "inativo", "Sem agendamentos há vários meses; aparece só no histórico."),
    base("cli-marcos-vinicius", "Marcos Vinícius", "(11) 99100-0010", "ativo", "Degradê com Diego; agenda em horários de menor movimento."),
    base("cli-eduardo-tavares", "Eduardo Tavares", "(11) 99100-0011", "ativo", "Hidratação Capilar periódica."),
    base("cli-vinicius-ramos", "Vinícius Ramos", "(11) 99100-0012", "ativo", "Indicado por amigo; agendou Corte Masculino."),
    base("cli-daniel-moreira", "Daniel Moreira", "(11) 99100-0013", "ativo", "Traz o filho para o Corte Infantil aos sábados."),
    base("cli-sergio-lopes", "Sérgio Lopes", "(11) 99100-0014", "ativo", "Relaxamento / Progressiva; só com Marcelo ou Bruno."),
    base("cli-andre-martins", "André Martins", "(11) 99100-0015", "ativo", "Barba Navalhada com Bruno."),
    base("cli-ricardo-gomes", "Ricardo Gomes", "(11) 99100-0016", "ativo", "Corte + Pezinho; cliente de longa data."),
    base("cli-fabio-souza", "Fábio Souza", "(11) 99100-0017", "ativo", "Cadastro recente; ainda explorando serviços."),
    base("cli-leonardo-dias", "Leonardo Dias", "(11) 99100-0018", "inativo", "Mudou de bairro; mantido no histórico."),
    base("cli-otavio-castro", "Otávio Castro", "(11) 99100-0019", "ativo", "Combo Corte + Barba mensal com Rafael."),
    base("cli-henrique-azevedo", "Henrique Azevedo", "(11) 99100-0020", "ativo", "Sobrancelha e barba; agenda flexível."),
  ];
}

/** Constroi um store novo a partir do seed (usado no boot e no reset). */
export function createInitialStore(): MockStore {
  return {
    organizacao: seedOrganizacao(),
    unidade: seedUnidade(),
    clientes: seedClientes(),
    profissionais: seedProfissionais(),
    servicos: seedServicos(),
    agendamentos: [],
    bloqueios: [],
    series: [],
  };
}
