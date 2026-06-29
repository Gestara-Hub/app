import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type {
  Category,
  Client,
  Organization,
  Professional,
  Role,
  Service,
  Unit,
  Weekday,
  WorkingHours,
} from "@/types";
import type { MockStore } from "./store";

/**
 * Seed do cenario canonico "Corte Nobre" (docs/product/08-barbearia-corte-nobre.md):
 * 1 organizacao, 1 unidade, 12 servicos, 4 profissionais e 20 clientes.
 *
 * Keys e enum values em ingles; texto livre (nomes, descricoes, observacoes) em
 * portugues. A data de referencia ("hoje" do cenario) e fixada aqui.
 *
 * NOTA: appointments, series e timeBlocks entram com os modulos de Agenda /
 * Agendamentos; por ora as colecoes nascem vazias.
 */

// "Hoje" do cenario (2026-06-27 e um sabado, dia de maior movimento).
export const REFERENCE_DATE = "2026-06-27";
const SEED_NOW = "2026-06-20T12:00:00.000Z";

// IDs estaveis e legiveis dos 12 servicos (facilita a matriz professional x service).
const S = {
  haircut: "svc-corte-masculino",
  fade: "svc-corte-degrade",
  kidsCut: "svc-corte-infantil",
  edgeUp: "svc-pezinho",
  beard: "svc-barba",
  razorBeard: "svc-barba-navalhada",
  beardColor: "svc-pigmentacao-barba",
  eyebrow: "svc-sobrancelha",
  hairTreatment: "svc-hidratacao",
  straightening: "svc-relaxamento",
  comboCutBeard: "svc-combo-corte-barba",
  comboFull: "svc-combo-completo",
} as const;

// IDs das categorias (semeadas por segmento; tenant podera editar no futuro).
const CAT = {
  cabelo: "cat-cabelo",
  barba: "cat-barba",
  cuidados: "cat-cuidados",
  combos: "cat-combos",
} as const;

// IDs dos cargos (entidade Role). Cargos novos sao criados pelo autocomplete da
// Equipe; aqui ficam os do cenario canonico.
const ROLE = {
  owner: "role-barbeiro-proprietario",
  barber: "role-barbeiro",
  junior: "role-barbeiro-junior",
} as const;

function timestamps() {
  return { createdAt: SEED_NOW, updatedAt: SEED_NOW };
}

// Telefone e armazenado apenas com digitos; a UI formata na exibicao.
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

// --- Categorias (preset do segmento barbearia) ----------------------------

function seedCategories(): Category[] {
  const base = (id: string, name: string, position: number): Category => ({
    id,
    organizationId: ORG_ID,
    name,
    position,
    status: "active",
    ...timestamps(),
  });

  return [
    base(CAT.cabelo, "Cabelo", 1),
    base(CAT.barba, "Barba", 2),
    base(CAT.cuidados, "Cuidados", 3),
    base(CAT.combos, "Combos", 4),
  ];
}

// --- Cargos (entidade Role) ------------------------------------------------

function seedRoles(): Role[] {
  const base = (id: string, name: string, position: number): Role => ({
    id,
    organizationId: ORG_ID,
    name,
    position,
    status: "active",
    ...timestamps(),
  });

  return [
    base(ROLE.owner, "Barbeiro e proprietário", 1),
    base(ROLE.barber, "Barbeiro", 2),
    base(ROLE.junior, "Barbeiro júnior", 3),
  ];
}

// --- Organization + Unit ---------------------------------------------------

function seedOrganization(): Organization {
  return {
    id: ORG_ID,
    name: "Corte Nobre",
    segment: "Barbearia",
    status: "active",
  };
}

function seedUnit(): Unit {
  return {
    id: UNIT_ID,
    organizationId: ORG_ID,
    name: "Corte Nobre - Matriz",
    address: "Rua das Tesouras, 120 - Centro",
    phone: digits("(11) 4002-8922"),
    status: "active",
    businessHours: [
      { weekday: 0, closed: true },
      { weekday: 1, closed: false, start: "09:00", end: "20:00" },
      { weekday: 2, closed: false, start: "09:00", end: "20:00" },
      { weekday: 3, closed: false, start: "09:00", end: "20:00" },
      { weekday: 4, closed: false, start: "09:00", end: "20:00" },
      { weekday: 5, closed: false, start: "09:00", end: "20:00" },
      { weekday: 6, closed: false, start: "08:00", end: "18:00" },
    ],
  };
}

// --- Services (12) ---------------------------------------------------------

function seedServices(): Service[] {
  const base = (
    id: string,
    name: string,
    categoryId: string,
    durationMinutes: number,
    priceCents: number,
    description: string,
  ): Service => ({
    id,
    organizationId: ORG_ID,
    name,
    categoryId,
    durationMinutes,
    priceCents,
    description,
    status: "active",
    ...timestamps(),
  });

  return [
    base(S.haircut, "Corte Masculino", CAT.cabelo, 30, 4500, "Corte clássico na tesoura e máquina."),
    base(S.fade, "Corte Degradê", CAT.cabelo, 40, 5500, "Degradê com transição suave."),
    base(S.kidsCut, "Corte Infantil", CAT.cabelo, 30, 4000, "Corte para crianças."),
    base(S.edgeUp, "Pezinho / Acabamento", CAT.cabelo, 15, 2000, "Acabamento de contorno entre cortes."),
    base(S.beard, "Barba", CAT.barba, 30, 3500, "Aparo e modelagem da barba."),
    base(S.razorBeard, "Barba Navalhada", CAT.barba, 40, 4500, "Barba feita na navalha com toalha quente."),
    base(S.beardColor, "Pigmentação de Barba", CAT.barba, 45, 6000, "Preenchimento e pigmentação de falhas."),
    base(S.eyebrow, "Sobrancelha", CAT.cuidados, 15, 2000, "Design de sobrancelha masculina."),
    base(S.hairTreatment, "Hidratação Capilar", CAT.cuidados, 30, 4000, "Hidratação e nutrição dos fios."),
    base(S.straightening, "Relaxamento / Progressiva", CAT.cuidados, 90, 12000, "Alisamento e redução de volume."),
    base(S.comboCutBeard, "Combo Corte + Barba", CAT.combos, 60, 7500, "Corte masculino com barba."),
    base(S.comboFull, "Combo Completo (Corte + Barba + Sobrancelha)", CAT.combos, 75, 9000, "Corte, barba e sobrancelha."),
  ];
}

// --- Professionals (4) -----------------------------------------------------

// Horario de trabalho do profissional = funcionamento da unidade nos dias dele.
function hoursForDay(weekday: Weekday): { start: string; end: string } {
  return weekday === 6
    ? { start: "08:00", end: "18:00" }
    : { start: "09:00", end: "20:00" };
}

function workingHours(days: Weekday[]): WorkingHours[] {
  return days.map((weekday) => ({ weekday, ...hoursForDay(weekday) }));
}

const ALL_SERVICES = Object.values(S);

function seedProfessionals(): Professional[] {
  const base = (
    id: string,
    name: string,
    roleId: string,
    phone: string,
    days: Weekday[],
    serviceIds: string[],
  ): Professional => ({
    id,
    organizationId: ORG_ID,
    unitId: UNIT_ID,
    name,
    roleId,
    phone: digits(phone),
    status: "active",
    workingHours: workingHours(days),
    serviceIds,
    ...timestamps(),
  });

  return [
    base(
      "prof-marcelo",
      "Marcelo Andrade",
      ROLE.owner,
      "(11) 98800-0001",
      [1, 2, 3, 4, 5, 6], // Seg a Sab
      [...ALL_SERVICES], // todos os 12
    ),
    base(
      "prof-rafael",
      "Rafael Lima",
      ROLE.barber,
      "(11) 98800-0002",
      [2, 3, 4, 5, 6], // Ter a Sab
      ALL_SERVICES.filter((id) => id !== S.straightening),
    ),
    base(
      "prof-bruno",
      "Bruno Costa",
      ROLE.barber,
      "(11) 98800-0003",
      [1, 2, 3, 4, 5], // Seg a Sex
      ALL_SERVICES.filter((id) => id !== S.kidsCut),
    ),
    base(
      "prof-diego",
      "Diego Santos",
      ROLE.junior,
      "(11) 98800-0004",
      [3, 4, 5, 6], // Qua a Sab
      [S.haircut, S.fade, S.kidsCut, S.edgeUp, S.beard, S.eyebrow],
    ),
  ];
}

// --- Clients (20) ----------------------------------------------------------

function seedClients(): Client[] {
  const base = (
    id: string,
    name: string,
    phone: string,
    status: Client["status"],
    notes: string,
  ): Client => ({
    id,
    organizationId: ORG_ID,
    name,
    phone: digits(phone),
    notes,
    status,
    ...timestamps(),
  });

  return [
    base("cli-joao-pereira", "João Pereira", "(11) 99100-0001", "active", "Cliente fiel; prefere Marcelo; corte clássico mensal."),
    base("cli-carlos-mendes", "Carlos Mendes", "(11) 99100-0002", "active", "Combo Corte + Barba quinzenal aos sábados."),
    base("cli-anderson-silva", "Anderson Silva", "(11) 99100-0003", "active", "Gosta de degradê; costuma agendar com Rafael."),
    base("cli-lucas-ferreira", "Lucas Ferreira", "(11) 99100-0004", "active", "Traz o filho para o Corte Infantil."),
    base("cli-pedro-henrique", "Pedro Henrique Alves", "(11) 99100-0005", "active", "Primeiro atendimento recente; ainda sem profissional fixo."),
    base("cli-gustavo-rocha", "Gustavo Rocha", "(11) 99100-0006", "active", "Barba e pigmentação com Bruno."),
    base("cli-felipe-cardoso", "Felipe Cardoso", "(11) 99100-0007", "active", "Corte Masculino mensal; flexível de profissional."),
    base("cli-thiago-barbosa", "Thiago Barbosa", "(11) 99100-0008", "active", "Combo Completo de vez em quando; gosta de sobrancelha."),
    base("cli-rodrigo-nunes", "Rodrigo Nunes", "(11) 99100-0009", "inactive", "Sem agendamentos há vários meses; aparece só no histórico."),
    base("cli-marcos-vinicius", "Marcos Vinícius", "(11) 99100-0010", "active", "Degradê com Diego; agenda em horários de menor movimento."),
    base("cli-eduardo-tavares", "Eduardo Tavares", "(11) 99100-0011", "active", "Hidratação Capilar periódica."),
    base("cli-vinicius-ramos", "Vinícius Ramos", "(11) 99100-0012", "active", "Indicado por amigo; agendou Corte Masculino."),
    base("cli-daniel-moreira", "Daniel Moreira", "(11) 99100-0013", "active", "Traz o filho para o Corte Infantil aos sábados."),
    base("cli-sergio-lopes", "Sérgio Lopes", "(11) 99100-0014", "active", "Relaxamento / Progressiva; só com Marcelo ou Bruno."),
    base("cli-andre-martins", "André Martins", "(11) 99100-0015", "active", "Barba Navalhada com Bruno."),
    base("cli-ricardo-gomes", "Ricardo Gomes", "(11) 99100-0016", "active", "Corte + Pezinho; cliente de longa data."),
    base("cli-fabio-souza", "Fábio Souza", "(11) 99100-0017", "active", "Cadastro recente; ainda explorando serviços."),
    base("cli-leonardo-dias", "Leonardo Dias", "(11) 99100-0018", "inactive", "Mudou de bairro; mantido no histórico."),
    base("cli-otavio-castro", "Otávio Castro", "(11) 99100-0019", "active", "Combo Corte + Barba mensal com Rafael."),
    base("cli-henrique-azevedo", "Henrique Azevedo", "(11) 99100-0020", "active", "Sobrancelha e barba; agenda flexível."),
  ];
}

/** Constroi um store novo a partir do seed (usado no boot e no reset). */
export function createInitialStore(): MockStore {
  return {
    organization: seedOrganization(),
    unit: seedUnit(),
    clients: seedClients(),
    professionals: seedProfessionals(),
    roles: seedRoles(),
    categories: seedCategories(),
    services: seedServices(),
    appointments: [],
    timeBlocks: [],
    series: [],
  };
}
