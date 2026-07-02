import { ORG_ID, REFERENCE_DATE, UNIT_ID } from "@/config/tenant";
import type {
  Appointment,
  AppointmentOrigin,
  AppointmentStatus,
  Category,
  Client,
  Organization,
  Professional,
  RecurrenceSeries,
  Role,
  Service,
  TimeBlock,
  TimeISO,
  Unit,
  User,
  Weekday,
  WorkingHours,
} from "@/types";
import {
  addMinutesToTime,
  generateOccurrenceDates,
  minutesToTime,
  rangesOverlap,
  timeToMinutes,
  weekdayOf,
} from "@/lib/scheduling";
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

// "Hoje" do cenario vem do config (REFERENCE_DATE). Timestamp fixo do seed:
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

// Almoco padrao dos barbeiros seniores (aplicado a todos os dias trabalhados).
const LUNCH = { start: "12:00", end: "13:00" };

function workingHours(
  days: Weekday[],
  lunch?: { start: string; end: string },
): WorkingHours[] {
  return days.map((weekday) => ({
    weekday,
    ...hoursForDay(weekday),
    ...(lunch ? { breakStart: lunch.start, breakEnd: lunch.end } : {}),
  }));
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
    lunch?: { start: string; end: string },
  ): Professional => ({
    id,
    organizationId: ORG_ID,
    unitId: UNIT_ID,
    name,
    roleId,
    phone: digits(phone),
    status: "active",
    workingHours: workingHours(days, lunch),
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
      LUNCH,
    ),
    base(
      "prof-rafael",
      "Rafael Lima",
      ROLE.barber,
      "(11) 98800-0002",
      [2, 3, 4, 5, 6], // Ter a Sab
      ALL_SERVICES.filter((id) => id !== S.straightening),
      LUNCH,
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

// --- Users (acesso / RBAC) -------------------------------------------------

// Usuarios do cenario cobrindo os 4 perfis. `professionalId` opcional: usuario
// pode ou nao ser um profissional. Marcelo (owner) tambem atende; Patricia
// (gerente) e Sofia (atendente) nao sao profissionais; Rafael e Diego logam
// como Profissional vinculados. Bruno (profissional) nao tem login.
function seedUsers(): User[] {
  const base = (
    id: string,
    name: string,
    email: string,
    profile: User["profile"],
    professionalId?: string,
  ): User => ({
    id,
    organizationId: ORG_ID,
    name,
    email,
    profile,
    ...(professionalId ? { professionalId } : {}),
    status: "active",
    ...timestamps(),
  });

  return [
    base("usr-marcelo", "Marcelo Andrade", "marcelo@cortenobre.com", "owner", "prof-marcelo"),
    base("usr-patricia", "Patrícia Nunes", "patricia@cortenobre.com", "manager"),
    base("usr-sofia", "Sofia Ramos", "sofia@cortenobre.com", "attendant"),
    base("usr-rafael", "Rafael Lima", "rafael@cortenobre.com", "professional", "prof-rafael"),
    base("usr-diego", "Diego Santos", "diego@cortenobre.com", "professional", "prof-diego"),
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

// --- Agenda: bloqueios, series e agendamentos ------------------------------
//
// Tudo deterministico (ids sequenciais, sem random/now) para hidratar igual no
// server e no client. Os agendamentos sao posicionados pela engine (rangesOverlap)
// dentro do expediente, pulando bloqueios e horarios ja ocupados — sem conflito.

const PROF = {
  marcelo: "prof-marcelo",
  rafael: "prof-rafael",
  bruno: "prof-bruno",
  diego: "prof-diego",
} as const;
const PROF_ORDER = [PROF.marcelo, PROF.rafael, PROF.bruno, PROF.diego];

// Janela do cenario: semana do REFERENCE_DATE + semana seguinte (sem domingos).
const SCHEDULE_DATES = [
  "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27",
  "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04",
];

interface Interval {
  start: TimeISO;
  end: TimeISO;
}
type BusyMap = Map<string, Interval[]>;
const busyKey = (professionalId: string, date: string) => `${professionalId}|${date}`;

function busyFor(busy: BusyMap, professionalId: string, date: string): Interval[] {
  const key = busyKey(professionalId, date);
  let arr = busy.get(key);
  if (!arr) {
    arr = [];
    busy.set(key, arr);
  }
  return arr;
}

// Status do agendamento avulso: passado concluido (com alguns no-show/cancelado),
// hoje em andamento/confirmado/pendente, futuro pendente/confirmado.
function appointmentStatusFor(date: string, idx: number): AppointmentStatus {
  if (date < REFERENCE_DATE) {
    if (idx % 9 === 4) return "no_show";
    if (idx % 11 === 7) return "canceled";
    return "completed";
  }
  if (date === REFERENCE_DATE) {
    const cycle = idx % 4;
    if (cycle === 0) return "in_service";
    if (cycle === 1) return "confirmed";
    if (cycle === 2) return "pending";
    return "confirmed";
  }
  return idx % 3 === 0 ? "pending" : "confirmed";
}

function seriesStatusFor(date: string): AppointmentStatus {
  if (date < REFERENCE_DATE) return "completed";
  if (date === REFERENCE_DATE) return "confirmed";
  return "pending";
}

function makeAppointment(
  professionalId: string,
  serviceId: string,
  clientId: string,
  date: string,
  start: TimeISO,
  end: TimeISO,
  status: AppointmentStatus,
  origin: AppointmentOrigin = "manual",
  seriesId?: string,
): Appointment {
  return {
    id: "", // atribuido por indice no final
    organizationId: ORG_ID,
    unitId: UNIT_ID,
    clientId,
    professionalId,
    serviceIds: [serviceId],
    date,
    start,
    end,
    status,
    origin,
    seriesId,
    ...timestamps(),
  };
}

// O almoco agora faz parte do WorkingHours (breakStart/breakEnd). Semeia o
// `busy` a partir desses intervalos para que os agendamentos semeados nao caiam
// no almoco. Bloqueios avulsos ficam vazios no seed (criados pela UI).
function initBusyFromBreaks(professionals: Professional[]): BusyMap {
  const busy: BusyMap = new Map();
  for (const prof of professionals) {
    for (const date of SCHEDULE_DATES) {
      const w = prof.workingHours.find((x) => x.weekday === weekdayOf(date));
      if (w?.breakStart && w?.breakEnd) {
        busyFor(busy, prof.id, date).push({ start: w.breakStart, end: w.breakEnd });
      }
    }
  }
  return busy;
}

// 2 series recorrentes; ocorrencias entram como agendamentos origin 'recurrence'.
function seedSeries(
  serviceById: Map<string, Service>,
  busy: BusyMap,
  appts: Appointment[],
): RecurrenceSeries[] {
  const defs = [
    {
      id: "ser-1",
      clientId: "cli-carlos-mendes",
      professionalId: PROF.rafael,
      serviceId: S.comboCutBeard,
      frequency: "weekly",
      startDate: "2026-06-27",
      time: "10:00",
      untilOccurrences: 5,
    },
    {
      id: "ser-2",
      clientId: "cli-eduardo-tavares",
      professionalId: PROF.bruno,
      serviceId: S.hairTreatment,
      frequency: "biweekly",
      startDate: "2026-06-24",
      time: "14:00",
      untilOccurrences: 4,
    },
  ] as const;

  const series: RecurrenceSeries[] = [];
  for (const def of defs) {
    const service = serviceById.get(def.serviceId);
    if (!service) continue;
    series.push({
      id: def.id,
      organizationId: ORG_ID,
      unitId: UNIT_ID,
      clientId: def.clientId,
      professionalId: def.professionalId,
      serviceIds: [def.serviceId],
      frequency: def.frequency,
      startDate: def.startDate,
      time: def.time,
      untilOccurrences: def.untilOccurrences,
      ...timestamps(),
    });

    const end = addMinutesToTime(def.time, service.durationMinutes);
    const dates = generateOccurrenceDates(def.frequency, def.startDate, {
      untilOccurrences: def.untilOccurrences,
    });
    for (const date of dates) {
      const arr = busyFor(busy, def.professionalId, date);
      if (arr.some((b) => rangesOverlap(def.time, end, b.start, b.end))) continue;
      appts.push(
        makeAppointment(
          def.professionalId,
          def.serviceId,
          def.clientId,
          date,
          def.time,
          end,
          seriesStatusFor(date),
          "recurrence",
          def.id,
        ),
      );
      arr.push({ start: def.time, end });
    }
  }
  return series;
}

// Agendamentos avulsos: preenche cada profissional/dia (alguns dias ficam vazios).
function seedRegularAppointments(
  professionals: Professional[],
  serviceById: Map<string, Service>,
  clients: Client[],
  busy: BusyMap,
  appts: Appointment[],
): void {
  const activeClients = clients.filter((c) => c.status === "active");
  const byId = new Map(professionals.map((p) => [p.id, p]));
  let counter = 0;

  for (let di = 0; di < SCHEDULE_DATES.length; di++) {
    const date = SCHEDULE_DATES[di];
    const weekday = weekdayOf(date);
    for (let pi = 0; pi < PROF_ORDER.length; pi++) {
      const prof = byId.get(PROF_ORDER[pi]);
      if (!prof) continue;
      const working = prof.workingHours.find((w) => w.weekday === weekday);
      if (!working) continue;

      const target = (pi + di) % 4; // 0 = dia vazio
      if (target === 0) continue;

      const arr = busyFor(busy, prof.id, date);
      const startLimit = timeToMinutes(working.start);
      const endLimit = timeToMinutes(working.end);
      let cursor = startLimit;
      let placed = 0;
      let svcCursor = pi + di;

      while (placed < target) {
        const service = serviceById.get(
          prof.serviceIds[svcCursor % prof.serviceIds.length],
        );
        if (!service) break;
        const dur = service.durationMinutes;
        let start = cursor;
        let done = false;
        while (start + dur <= endLimit) {
          const s = minutesToTime(start);
          const e = minutesToTime(start + dur);
          if (!arr.some((b) => rangesOverlap(s, e, b.start, b.end))) {
            const clientId = activeClients[counter % activeClients.length].id;
            appts.push(
              makeAppointment(
                prof.id,
                service.id,
                clientId,
                date,
                s,
                e,
                appointmentStatusFor(date, counter),
              ),
            );
            arr.push({ start: s, end: e });
            cursor = start + dur;
            placed += 1;
            counter += 1;
            svcCursor += 1;
            done = true;
            break;
          }
          start += 15;
        }
        if (!done) break;
      }
    }
  }
}

/** Constroi um store novo a partir do seed (usado no boot e no reset). */
export function createInitialStore(): MockStore {
  const organization = seedOrganization();
  const unit = seedUnit();
  const clients = seedClients();
  const professionals = seedProfessionals();
  const users = seedUsers();
  const roles = seedRoles();
  const categories = seedCategories();
  const services = seedServices();
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const timeBlocks: TimeBlock[] = [];
  const busy = initBusyFromBreaks(professionals);

  const appts: Appointment[] = [];
  const series = seedSeries(serviceById, busy, appts);
  seedRegularAppointments(professionals, serviceById, clients, busy, appts);

  // ids deterministicos por ordem de geracao (series primeiro, depois avulsos).
  const appointments = appts.map((a, i) => ({
    ...a,
    id: `apt-${String(i + 1).padStart(4, "0")}`,
  }));

  return {
    organization,
    unit,
    clients,
    professionals,
    users,
    roles,
    categories,
    services,
    appointments,
    timeBlocks,
    series,
  };
}
