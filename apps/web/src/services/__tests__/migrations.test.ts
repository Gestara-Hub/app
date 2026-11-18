import type { Charge, Client, MessageLog, MessageTemplate, Plan } from "@gestarahub/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialWorld, defaultMessageTemplates } from "@/mocks/seed";
import type { MockStore, MockWorld } from "@/mocks/store";
import { ACADEMY_ORG, academyTenant } from "@/test/academy";

/**
 * Migracoes suaves do banco simulado (`gestarahub:db` no localStorage). No
 * Node a persistencia fica desligada; aqui simulamos o navegador: um
 * localStorage falso com um mundo salvo numa versao antiga e o modulo do store
 * recarregado do zero (`vi.resetModules`), que hidrata e migra ao importar.
 */

const STORAGE_KEY = "gestarahub:db";
const CURRENT_VERSION = 39;

function fakeLocalStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

/** Sobe o store como o navegador faria, a partir de um mundo salvo na versao `v`. */
async function hydrate(v: number, world: MockWorld) {
  const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify({ v, data: world }) });
  vi.stubGlobal("window", { localStorage: storage });
  vi.resetModules();
  const mod = await import("@/mocks/store");
  const saved = () => JSON.parse(storage.data.get(STORAGE_KEY) ?? "null") as { v: number; data: MockWorld } | null;
  return { ...mod, saved };
}

/** Mundo salvo com a academia como tenant ativo. */
function oldWorld(edit: (academy: MockStore) => void): MockWorld {
  const world = createInitialWorld();
  world.tenants[ACADEMY_ORG] = academyTenant();
  world.activeOrganizationId = ACADEMY_ORG;
  edit(world.tenants[ACADEMY_ORG]);
  return world;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function client(id: string, extra: Partial<Client> = {}): Client {
  return {
    id,
    organizationId: ACADEMY_ORG,
    name: `Aluno ${id}`,
    status: "active",
    membershipStatus: "active",
    dueDay: 10,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    ...extra,
  } as Client;
}

function charge(id: string, extra: Partial<Charge>): Charge {
  return {
    id,
    organizationId: ACADEMY_ORG,
    studentId: "cli-1",
    kind: "membership",
    competence: "2026-09",
    dueDate: "2026-09-10",
    amountCents: 15000,
    status: "pending",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...extra,
  } as Charge;
}

describe("carga do banco salvo", () => {
  it("versao atual entra sem migrar", async () => {
    const world = oldWorld((t) => {
      const absence = t.messageTemplates.find((x) => x.trigger === "absence_alert")!;
      absence.daysOffset = 14;
    });
    const { store } = await hydrate(CURRENT_VERSION, world);
    expect(store.organization.id).toBe(ACADEMY_ORG);
    expect(store.messageTemplates.find((x) => x.trigger === "absence_alert")?.daysOffset).toBe(14);
  });

  it("versao muito antiga (< 20) recomeca do seed", async () => {
    const world = oldWorld((t) => {
      t.organization.name = "Nome salvo";
    });
    const { store, saved } = await hydrate(19, world);
    // Seed limpo: tenant ativo volta ao padrao e o espaco salvo se perde (a
    // academia nem existe mais no seed do mock: a demonstracao e no banco).
    expect(store.organization.id).not.toBe(ACADEMY_ORG);
    expect(saved()?.v).toBe(CURRENT_VERSION);
    expect(saved()?.data.tenants[ACADEMY_ORG]).toBeUndefined();
  });

  it("migrado e regravado na versao atual", async () => {
    const { saved } = await hydrate(28, oldWorld(() => {}));
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("tira o periodo do nome dos planos", async () => {
    const world = oldWorld((t) => {
      t.plans = [
        { id: "pl-1", name: "Mensal - Plano Ouro" } as Plan,
        { id: "pl-2", name: "Plano Prata" } as Plan,
      ];
    });
    const { store, saved } = await hydrate(CURRENT_VERSION, world);
    expect(store.plans.map((p) => p.name)).toEqual(["Plano Ouro", "Plano Prata"]);
    expect(saved()?.data.tenants[ACADEMY_ORG].plans[0].name).toBe("Plano Ouro");
  });
});

describe("v25: area do espaco vira classSegment", () => {
  it("mapeia a chave antiga, move o nome personalizado e apaga as chaves legadas", async () => {
    const world = oldWorld((t) => {
      t.organization.settings = {
        defaultDueDay: 10,
        businessSegments: ["fitness_wellness", "dance_arts"],
        customSegmentName: "Studio",
      } as never;
    });
    const { store } = await hydrate(24, world);
    expect(store.organization.classSegment).toBe("pilates_yoga");
    expect(store.organization.customSegmentName).toBe("Studio");
    expect(store.organization.settings).toEqual({ defaultDueDay: 10 });
  });

  it("todas as chaves antigas", async () => {
    const pairs = {
      martial_arts: "martial_arts",
      fitness_wellness: "pilates_yoga",
      // A v32 divide "Música & Idiomas"; a academia do seed nao tem idioma.
      education_courses: "music",
      dance_arts: "dance",
      crossfit_functional: "functional_training",
      aquatics_sports: "swimming_sports",
      custom: "custom",
    };
    for (const [legacy, segment] of Object.entries(pairs)) {
      const world = oldWorld((t) => {
        t.organization.settings = { businessSegments: [legacy] } as never;
      });
      const { store } = await hydrate(24, world);
      expect(store.organization.classSegment).toBe(segment);
    }
  });

  it("nao sobrescreve classSegment ja definido nem inventa area desconhecida", async () => {
    const kept = await hydrate(
      24,
      oldWorld((t) => {
        t.organization.classSegment = "dance";
        t.organization.settings = { businessSegments: ["fitness_wellness"] } as never;
      }),
    );
    expect(kept.store.organization.classSegment).toBe("dance");

    const unknown = await hydrate(
      24,
      oldWorld((t) => {
        t.organization.settings = { businessSegments: ["xyz"] } as never;
      }),
    );
    expect(unknown.store.organization.classSegment).toBeUndefined();
    expect(unknown.store.organization.settings).toEqual({});
  });
});

describe("v26: bolsa integral e mensalidades isentas", () => {
  it("desconto de 100% vira bolsa; mensalidade de R$ 0 em aberto vira isenta", async () => {
    const world = oldWorld((t) => {
      t.plans = [{ id: "pl-1", name: "Plano", priceCents: 18000 } as Plan];
      t.clients = [
        client("cli-1", { discount: { type: "percentage", value: 100 } } as Partial<Client>),
        client("cli-2", { discount: { type: "percentage", value: 50 } } as Partial<Client>),
        client("cli-3"),
      ];
      t.charges = [
        charge("c-scholar", { studentId: "cli-1", amountCents: 0, planId: "pl-1" }),
        charge("c-scholar-overdue", { studentId: "cli-1", amountCents: 0, status: "overdue", planId: "pl-1" }),
        charge("c-scholar-paid", { studentId: "cli-1", amountCents: 0, status: "paid", planId: "pl-1" }),
        charge("c-zero", { studentId: "cli-3", amountCents: 0, planId: "pl-1" }),
        charge("c-dropin", { studentId: "cli-3", amountCents: 0, kind: "dropin" }),
        charge("c-half", { studentId: "cli-2", amountCents: 9000, planId: "pl-1" }),
      ];
    });
    const { store } = await hydrate(25, world);
    const byId = (id: string) => store.charges.find((c) => c.id === id)!;

    expect(store.clients.find((c) => c.id === "cli-1")?.discount).toMatchObject({ scholarship: true });
    expect(store.clients.find((c) => c.id === "cli-2")?.discount?.scholarship).toBeUndefined();

    expect(byId("c-scholar")).toMatchObject({ status: "waived", scholarshipPercent: 100, listAmountCents: 18000 });
    expect(byId("c-scholar-overdue")).toMatchObject({ status: "waived", scholarshipPercent: 100 });
    expect(byId("c-scholar-paid").status).toBe("paid");
    expect(byId("c-zero").status).toBe("waived");
    expect(byId("c-zero").scholarshipPercent).toBeUndefined();
    expect(byId("c-dropin").status).toBe("pending");
    expect(byId("c-half").status).toBe("pending");
  });
});

describe("v28: canceladas por troca viram substituidas", () => {
  it("so as canceladas pelo sistema com a nota antiga", async () => {
    const world = oldWorld((t) => {
      t.charges = [
        charge("c-plan", { status: "canceled", canceledBy: "system", notes: "Cancelada por troca de plano" }),
        charge("c-rule", { status: "canceled", canceledBy: "system", notes: "Cancelada por troca da regra de cobrança" }),
        charge("c-grant", { status: "canceled", canceledBy: "system", notes: "Cancelada por troca da bolsa" }),
        charge("c-user", { status: "canceled", canceledBy: "user", notes: "Cancelada por troca de plano" }),
        charge("c-other", { status: "canceled", canceledBy: "system", notes: "Aluno inativado" }),
      ] as Charge[];
    });
    const { store } = await hydrate(27, world);
    const byId = (id: string) => store.charges.find((c) => c.id === id)!;
    expect(byId("c-plan")).toMatchObject({ replaced: true, notes: "Substituída pela troca de plano" });
    expect(byId("c-rule")).toMatchObject({ replaced: true, notes: "Substituída pela troca da regra de cobrança" });
    expect(byId("c-grant")).toMatchObject({ replaced: true, notes: "Substituída pela troca da bolsa" });
    expect(byId("c-user").replaced).toBeUndefined();
    expect(byId("c-other").replaced).toBeUndefined();
  });
});

describe("v29: pontos a melhorar viram metas", () => {
  it("cada ponto vira meta sem progresso e a lista antiga sai", async () => {
    const world = oldWorld((t) => {
      t.clients = [
        client("cli-1", {
          progressions: {
            "mod-bjj": {
              modalityId: "mod-bjj",
              levelName: "Branca",
              subLevel: 0,
              promotedAt: "2026-01-10",
              strengths: [],
              focusAreas: ["Guarda", "Passagem"],
              evaluations: [],
              promotionHistory: [],
              updatedAt: "2026-08-01T12:00:00.000Z",
            },
            "mod-muay": {
              modalityId: "mod-muay",
              levelName: "Nível 1",
              subLevel: 0,
              promotedAt: "2026-01-10",
              strengths: [],
              focusAreas: ["Chute"],
              goals: [{ id: "g-1", title: "Meta existente", progress: 50, createdAt: "2026-02-01T12:00:00.000Z" }],
              evaluations: [],
              promotionHistory: [],
              updatedAt: "2026-08-01T12:00:00.000Z",
            },
            "mod-empty": {
              modalityId: "mod-empty",
              levelName: "Nível 1",
              subLevel: 0,
              promotedAt: "2026-01-10",
              strengths: [],
              evaluations: [],
              promotionHistory: [],
              updatedAt: "2026-08-01T12:00:00.000Z",
            },
          },
        } as unknown as Partial<Client>),
      ];
    });
    const { store } = await hydrate(28, world);
    const progressions = store.clients[0].progressions!;

    expect(progressions["mod-bjj"].goals).toEqual([
      { id: "goal-cli-1-mod-bjj-0", title: "Guarda", progress: 0, createdAt: "2026-08-01T12:00:00.000Z" },
      { id: "goal-cli-1-mod-bjj-1", title: "Passagem", progress: 0, createdAt: "2026-08-01T12:00:00.000Z" },
    ]);
    // Quem ja tinha metas fica com elas.
    expect(progressions["mod-muay"].goals.map((g) => g.title)).toEqual(["Meta existente"]);
    expect(progressions["mod-empty"].goals).toEqual([]);
    for (const p of Object.values(progressions)) expect("focusAreas" in p).toBe(false);
  });
});

describe("v30: WhatsApp com o numero do proprio espaco", () => {
  function legacyTemplates(t: MockStore): MessageTemplate[] {
    return t.messageTemplates.map((x) =>
      x.trigger === "absence_alert"
        ? { ...x, daysOffset: 14, description: "Para alunos sem frequência há 14 dias" }
        : x,
    );
  }

  function log(id: string): MessageLog {
    return {
      id,
      organizationId: ACADEMY_ORG,
      recipientName: "Aluno",
      recipientPhone: "5511977770000",
      trigger: "manual_broadcast",
      category: "administrative",
      content: "Oi",
      status: "delivered",
      sentAt: "2026-09-01T12:00:00.000Z",
    };
  }

  it("sessao por QR vira conexao assistida, mantendo horario e franquia contratada", async () => {
    const world = oldWorld((t) => {
      delete t.whatsAppConnection;
      (t as MockStore & { communicationSession?: unknown }).communicationSession = {
        status: "connected",
        phoneNumber: "5511999990000",
        allowedSendHours: { start: "09:00", end: "18:00" },
        monthlyQuota: { used: 320, included: 500 },
      };
    });
    const { store } = await hydrate(29, world);
    expect(store.whatsAppConnection).toEqual({
      organizationId: ACADEMY_ORG,
      officialStatus: "not_connected",
      allowedSendHours: { start: "09:00", end: "18:00" },
      monthlyQuota: { used: 0, included: 500 },
    });
    expect("communicationSession" in store).toBe(false);
  });

  it("sem sessao antiga usa o padrao", async () => {
    const { store } = await hydrate(29, oldWorld(() => {}));
    // Padrao: sem franquia (sem uso desde 17/11/2026).
    expect(store.whatsAppConnection).toEqual({
      organizationId: ACADEMY_ORG,
      officialStatus: "not_connected",
      allowedSendHours: { start: "08:00", end: "20:00" },
      monthlyQuota: { used: 0, included: 0 },
    });
  });

  it("tira as mensagens ficticias do seed antigo e mantem as reais", async () => {
    const world = oldWorld((t) => {
      t.messageLogs = [
        log(`msg-${ACADEMY_ORG}-1`),
        log(`msg-${ACADEMY_ORG}-20`),
        log(`msg-${ACADEMY_ORG}-21`),
        log("real-1"),
      ];
    });
    const { store } = await hydrate(29, world);
    expect(store.messageLogs.map((l) => l.id)).toEqual([`msg-${ACADEMY_ORG}-21`, "real-1"]);
  });

  it("Sentimos sua falta passa de 14 dias para 3 faltas seguidas; prazo editado fica", async () => {
    const absenceOf = (t: MockStore) => t.messageTemplates.find((x) => x.trigger === "absence_alert")!;

    const legacy = await hydrate(29, oldWorld((t) => { t.messageTemplates = legacyTemplates(t); }));
    expect(absenceOf(legacy.store)).toMatchObject({ daysOffset: 3, description: "Para alunos com 3 faltas seguidas" });

    const edited = await hydrate(
      29,
      oldWorld((t) => {
        t.messageTemplates = legacyTemplates(t).map((x) => (x.trigger === "absence_alert" ? { ...x, daysOffset: 7 } : x));
      }),
    );
    expect(absenceOf(edited.store).daysOffset).toBe(7);
  });

  it("vale para todos os tenants", async () => {
    const world = createInitialWorld();
    for (const t of Object.values(world.tenants)) {
      t.messageLogs = [log(`msg-${t.organization.id}-3`)];
    }
    const { allTenants } = await hydrate(29, world);
    for (const t of allTenants()) {
      expect(t.messageLogs).toEqual([]);
      expect(t.whatsAppConnection?.organizationId).toBe(t.organization.id);
    }
  });
});

describe("v31: textos das mensagens seguem a area do espaco", () => {
  const contentOf = (t: MockStore, trigger: MessageTemplate["trigger"]) =>
    t.messageTemplates.find((x) => x.trigger === trigger)?.content ?? "";

  it("quem nao e de lutas e nao editou recebe o texto da propria area", async () => {
    const { store } = await hydrate(
      30,
      oldWorld((t) => {
        t.organization.classSegment = "pilates_yoga";
        t.messageTemplates = defaultMessageTemplates(t.organization.id);
        const welcome = t.messageTemplates.find((x) => x.trigger === "welcome_student")!;
        welcome.content = "Texto editado no tatame";
      }),
    );
    expect(contentOf(store, "absence_alert")).not.toContain("tatame");
    expect(contentOf(store, "absence_alert")).toBe(
      defaultMessageTemplates(ACADEMY_ORG, "pilates_yoga").find((x) => x.trigger === "absence_alert")!.content,
    );
    expect(contentOf(store, "welcome_student")).toBe("Texto editado no tatame");
  });

  it("espaco de lutas fica como esta", async () => {
    const { store } = await hydrate(
      30,
      oldWorld((t) => {
        t.organization.classSegment = "martial_arts";
        t.messageTemplates = defaultMessageTemplates(t.organization.id);
      }),
    );
    // Desde 18/11/2026 o texto e o mestre, igual em todas as areas.
    expect(contentOf(store, "absence_alert")).toContain("Seu lugar continua guardado");
  });
});

describe("v32: Música & Idiomas vira Música ou Idiomas e reforço", () => {
  const category = (id: string, name: string) =>
    ({ id, organizationId: ACADEMY_ORG, name, position: 0, status: "active" }) as MockStore["categories"][number];

  it("modalidade de idioma ou reforco vira languages", async () => {
    for (const name of ["Inglês", "espanhol kids", "Francês", "Reforço escolar", "Redação", "Libras"]) {
      const { store } = await hydrate(
        31,
        oldWorld((t) => {
          t.organization.classSegment = "music_languages" as never;
          t.organization.segment = "Música & Idiomas";
          t.categories = [category("m-1", "Violão"), category("m-2", name)];
        }),
      );
      expect(store.organization.classSegment).toBe("languages");
      expect(store.organization.segment).toBe("Idiomas e reforço");
    }
  });

  it("so instrumentos (ou nenhuma modalidade) vira music", async () => {
    const instruments = await hydrate(
      31,
      oldWorld((t) => {
        t.organization.classSegment = "music_languages" as never;
        t.organization.segment = "Música & Idiomas";
        t.categories = [category("m-1", "Violão"), category("m-2", "Piano & Teclado")];
      }),
    );
    expect(instruments.store.organization.classSegment).toBe("music");
    expect(instruments.store.organization.segment).toBe("Música");

    const empty = await hydrate(
      31,
      oldWorld((t) => {
        t.organization.classSegment = "music_languages" as never;
        t.organization.segment = "Escola Som";
        t.categories = [];
      }),
    );
    expect(empty.store.organization.classSegment).toBe("music");
    // Rotulo digitado pelo dono fica como esta.
    expect(empty.store.organization.segment).toBe("Escola Som");
  });

  it("outras areas ficam como estao", async () => {
    const { store, saved } = await hydrate(
      31,
      oldWorld((t) => {
        t.organization.classSegment = "dance";
        t.categories = [category("m-1", "Inglês")];
      }),
    );
    expect(store.organization.classSegment).toBe("dance");
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });
});

describe("v33: categoria de sistema das cobranças avulsas", () => {
  it("tenant com categorias ganha \"Cobranças avulsas\" (uma vez); tenant sem categorias segue sem", async () => {
    const world = oldWorld((t) => {
      t.financialCategories = t.financialCategories.filter((c) => c.systemKey !== "extras");
    });
    const otherId = Object.keys(world.tenants).find((id) => id !== ACADEMY_ORG)!;
    world.tenants[otherId].financialCategories = [];
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;

    const { store, saved } = await hydrate(32, world);
    const extras = store.financialCategories.filter((c) => c.systemKey === "extras");
    expect(extras).toEqual([
      expect.objectContaining({
        id: `fcat-${ACADEMY_ORG}-extras`,
        organizationId: ACADEMY_ORG,
        name: "Cobranças avulsas",
        type: "income",
        system: true,
        status: "active",
      }),
    ]);
    expect(store.financialCategories).toHaveLength(before + 1);
    expect(saved()?.data.tenants[otherId].financialCategories).toEqual([]);
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("não duplica quando a categoria já existe", async () => {
    const world = oldWorld(() => {});
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;
    const { store } = await hydrate(32, world);
    expect(store.financialCategories).toHaveLength(before);
    expect(store.financialCategories.filter((c) => c.systemKey === "extras")).toHaveLength(1);
  });
});

describe("v34: categoria de sistema dos cursos", () => {
  it("tenant com categorias ganha \"Cursos\" (uma vez); tenant sem categorias segue sem", async () => {
    const world = oldWorld((t) => {
      t.financialCategories = t.financialCategories.filter((c) => c.systemKey !== "courses");
    });
    const otherId = Object.keys(world.tenants).find((id) => id !== ACADEMY_ORG)!;
    world.tenants[otherId].financialCategories = [];
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;

    const { store, saved } = await hydrate(33, world);
    const courses = store.financialCategories.filter((c) => c.systemKey === "courses");
    expect(courses).toEqual([
      expect.objectContaining({
        id: `fcat-${ACADEMY_ORG}-courses`,
        organizationId: ACADEMY_ORG,
        name: "Cursos",
        type: "income",
        system: true,
        status: "active",
      }),
    ]);
    expect(store.financialCategories).toHaveLength(before + 1);
    expect(saved()?.data.tenants[otherId].financialCategories).toEqual([]);
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("não duplica quando a categoria já existe", async () => {
    const world = oldWorld(() => {});
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;
    const { store } = await hydrate(33, world);
    expect(store.financialCategories).toHaveLength(before);
    expect(store.financialCategories.filter((c) => c.systemKey === "courses")).toHaveLength(1);
  });

  it("vindo de antes da v33, ganha as duas categorias", async () => {
    const world = oldWorld((t) => {
      t.financialCategories = t.financialCategories.filter(
        (c) => c.systemKey !== "courses" && c.systemKey !== "extras",
      );
    });
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;
    const { store } = await hydrate(32, world);
    expect(store.financialCategories).toHaveLength(before + 2);
    expect(store.financialCategories.map((c) => c.systemKey).filter(Boolean)).toEqual(
      expect.arrayContaining(["extras", "courses"]),
    );
  });
});

describe("v35: pacote de aulas", () => {
  it("cria as coleções de pacotes e a categoria \"Pacotes de aulas\" (uma vez)", async () => {
    const world = oldWorld((t) => {
      t.financialCategories = t.financialCategories.filter((c) => c.systemKey !== "packages");
      const legacy = t as Partial<MockStore>;
      delete legacy.lessonPackages;
      delete legacy.studentPackages;
    });
    const otherId = Object.keys(world.tenants).find((id) => id !== ACADEMY_ORG)!;
    world.tenants[otherId].financialCategories = [];
    const before = world.tenants[ACADEMY_ORG].financialCategories.length;

    const { store, saved } = await hydrate(34, world);
    expect(store.lessonPackages).toEqual([]);
    expect(store.studentPackages).toEqual([]);
    expect(store.financialCategories.filter((c) => c.systemKey === "packages")).toEqual([
      expect.objectContaining({
        id: `fcat-${ACADEMY_ORG}-packages`,
        name: "Pacotes de aulas",
        type: "income",
        system: true,
      }),
    ]);
    expect(store.financialCategories).toHaveLength(before + 1);
    expect(saved()?.data.tenants[otherId].financialCategories).toEqual([]);
    expect(saved()?.data.tenants[otherId].studentPackages).toEqual([]);
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("não duplica a categoria nem apaga pacotes já salvos", async () => {
    const world = oldWorld((t) => {
      t.lessonPackages = [
        {
          id: "pkg-1",
          organizationId: ACADEMY_ORG,
          name: "10 aulas",
          lessons: 10,
          priceCents: 50000,
          modalityIds: [],
          absenceConsumes: true,
          status: "active",
          createdAt: "2026-09-01T12:00:00.000Z",
          updatedAt: "2026-09-01T12:00:00.000Z",
        },
      ];
    });
    const { store } = await hydrate(34, world);
    expect(store.lessonPackages.map((p) => p.id)).toEqual(["pkg-1"]);
    expect(store.financialCategories.filter((c) => c.systemKey === "packages")).toHaveLength(1);
  });
});

describe("v36: modelos de WhatsApp do lembrete de cobrança e do pacote acabando", () => {
  const OLD_TRIGGERS = new Set<MessageTemplate["trigger"]>(["charge_reminder", "package_ending"]);
  const withoutNew = (t: MockStore) => {
    t.messageTemplates = t.messageTemplates.filter((x) => !OLD_TRIGGERS.has(x.trigger));
  };
  const find = (t: MockStore, trigger: MessageTemplate["trigger"]) =>
    t.messageTemplates.filter((x) => x.trigger === trigger);

  it("adiciona os dois modelos uma vez, com o texto da área do espaço", async () => {
    const world = oldWorld((t) => {
      t.organization.classSegment = "gastronomy";
      t.messageTemplates = defaultMessageTemplates(t.organization.id, "gastronomy");
      withoutNew(t);
      const welcome = t.messageTemplates.find((x) => x.trigger === "welcome_student")!;
      welcome.content = "Texto meu";
    });
    const before = world.tenants[ACADEMY_ORG].messageTemplates.length;
    const { store, saved } = await hydrate(35, world);
    const own = defaultMessageTemplates(ACADEMY_ORG, "gastronomy");
    expect(store.messageTemplates).toHaveLength(before + 2);
    expect(find(store, "charge_reminder")).toEqual([own.find((x) => x.trigger === "charge_reminder")]);
    expect(find(store, "package_ending")).toEqual([own.find((x) => x.trigger === "package_ending")]);
    expect(find(store, "package_ending")[0].content).not.toMatch(/tatame|trein/);
    expect(find(store, "welcome_student")[0].content).toBe("Texto meu");
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("espaço de lutas recebe o texto de treino", async () => {
    const { store } = await hydrate(
      35,
      oldWorld((t) => {
        t.organization.classSegment = "martial_arts";
        withoutNew(t);
      }),
    );
    // Desde 18/11/2026 o texto e o mestre, igual em todas as areas.
    expect(find(store, "package_ending")[0].content).toContain("seguir com as aulas");
    expect(find(store, "charge_reminder")[0].content).toContain("Lembrete de pagamento:");
  });

  it("não duplica quem já tem e não mexe em quem está sem modelos", async () => {
    const world = oldWorld((t) => {
      const reminder = t.messageTemplates.find((x) => x.trigger === "charge_reminder")!;
      reminder.content = "Já editado";
    });
    const otherId = Object.keys(world.tenants).find((id) => id !== ACADEMY_ORG)!;
    world.tenants[otherId].messageTemplates = [];
    const { store, saved } = await hydrate(35, world);
    expect(find(store, "charge_reminder")).toHaveLength(1);
    expect(find(store, "charge_reminder")[0].content).toBe("Já editado");
    expect(find(store, "package_ending")).toHaveLength(1);
    expect(saved()?.data.tenants[otherId].messageTemplates).toEqual([]);
  });
});

describe("v37: modelos de WhatsApp so de envio manual", () => {
  const MANUAL = ["payment_received", "level_up", "class_canceled", "schedule_change", "holiday_notice"] as const;
  const MANUAL_SET = new Set<MessageTemplate["trigger"]>(MANUAL);
  const find = (t: MockStore, trigger: MessageTemplate["trigger"]) =>
    t.messageTemplates.filter((x) => x.trigger === trigger);

  it("adiciona os cinco uma vez, desligados e com o texto da área do espaço", async () => {
    const world = oldWorld((t) => {
      t.organization.classSegment = "martial_arts";
      t.messageTemplates = defaultMessageTemplates(t.organization.id, "martial_arts").filter(
        (x) => !MANUAL_SET.has(x.trigger),
      );
      t.messageTemplates.find((x) => x.trigger === "birthday_greeting")!.content = "Texto meu";
    });
    const before = world.tenants[ACADEMY_ORG].messageTemplates.length;
    const { store, saved } = await hydrate(36, world);
    const own = defaultMessageTemplates(ACADEMY_ORG, "martial_arts");
    expect(store.messageTemplates).toHaveLength(before + MANUAL.length);
    for (const trigger of MANUAL) {
      expect(find(store, trigger)).toEqual([own.find((x) => x.trigger === trigger)]);
      expect(find(store, trigger)[0].enabled).toBe(false);
    }
    expect(find(store, "class_canceled")[0].content).toContain("a aula de hoje foi cancelada");
    expect(find(store, "birthday_greeting")[0].content).toBe("Texto meu");
    expect(saved()?.v).toBe(CURRENT_VERSION);
  });

  it("não duplica quem já tem e não mexe em quem está sem modelos", async () => {
    const world = oldWorld((t) => {
      t.messageTemplates.find((x) => x.trigger === "holiday_notice")!.content = "Já editado";
      t.messageTemplates = t.messageTemplates.filter((x) => x.trigger !== "level_up");
    });
    const otherId = Object.keys(world.tenants).find((id) => id !== ACADEMY_ORG)!;
    world.tenants[otherId].messageTemplates = [];
    const { store, saved } = await hydrate(36, world);
    expect(find(store, "holiday_notice")).toHaveLength(1);
    expect(find(store, "holiday_notice")[0].content).toBe("Já editado");
    expect(find(store, "level_up")).toHaveLength(1);
    expect(saved()?.data.tenants[otherId].messageTemplates).toEqual([]);
  });
});

describe("v38: atraso de 10 dias com o valor", () => {
  const OLD =
    "Aviso Importante: Olá, {aluno}. Identificamos uma pendência na mensalidade vencida em {vencimento}. Para evitar a suspensão temporária do acesso às aulas, acesse o link de regularização: {link_pagamento} ou procure nossa recepção.";
  const critical = (t: MockStore) => t.messageTemplates.find((x) => x.trigger === "billing_critical")!;

  it("troca o texto padrão antigo e mantém o editado", async () => {
    const world = oldWorld((t) => {
      critical(t).content = OLD;
    });
    const otherId = Object.keys(world.tenants).find(
      (id) => id !== ACADEMY_ORG && world.tenants[id].messageTemplates.length > 0,
    );
    if (otherId) critical(world.tenants[otherId]).content = "Texto meu";
    const { store, saved } = await hydrate(37, world);
    expect(critical(store).content).toContain("{valor}");
    expect(critical(store).content).toContain("Valor devido: {valor}");
    if (otherId) expect(critical(saved()!.data.tenants[otherId]).content).toBe("Texto meu");
  });
});

describe("duas abas abertas", () => {
  it("a gravação de uma aba não apaga o que a outra salvou", async () => {
    const world = oldWorld((t) => {
      t.clients = [client("a")];
    });
    const { store, persist, syncFromStorage, saved } = await hydrate(CURRENT_VERSION, world);
    // A outra aba cria um aluno e grava.
    const other = saved()!;
    other.data.tenants[ACADEMY_ORG].clients.push(client("b"));
    (window.localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem(
      STORAGE_KEY,
      JSON.stringify(other),
    );
    // Esta aba rele antes de gravar (simulateWrite faz isso) e grava por cima.
    expect(syncFromStorage()).toBe(true);
    store.plans = [];
    persist();
    expect(saved()?.data.tenants[ACADEMY_ORG].clients.map((c) => c.id)).toEqual(["a", "b"]);
    // Sem mudanca nova, nao rele.
    expect(syncFromStorage()).toBe(false);
  });
});
