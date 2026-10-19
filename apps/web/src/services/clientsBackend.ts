"use server";

import type {
  Client,
  ClientFilter,
  CreateClient,
  DateISO,
  Id,
  ProgressionBeltColor,
  StudentModalityProgression,
  StudentPromotionHistoryEntry,
  UpdateClient,
} from "@gestarahub/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getClientForTenant() {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    if (user) {
      return serverClient;
    }
  } catch {
    // Non-cookie environment (e.g. background tasks or direct scripts)
  }
  return createSupabaseAdminClient();
}


function mapRowToClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email ? String(row.email) : undefined,
    birthDate: row.birth_date ? String(row.birth_date) : undefined,
    guardians: (row.guardians as Client["guardians"]) || undefined,
    notes: row.notes ? String(row.notes) : undefined,
    address: (row.address as Client["address"]) || undefined,
    planId: row.plan_id ? String(row.plan_id) : undefined,
    planStartDate: row.plan_start_date ? String(row.plan_start_date) : undefined,
    billingStrategy: (row.billing_strategy as Client["billingStrategy"]) || undefined,
    cyclePaymentTiming: (row.cycle_payment_timing as Client["cyclePaymentTiming"]) || undefined,
    dueDay: typeof row.due_day === "number" ? row.due_day : 10,
    discount: (row.discount as Client["discount"]) || undefined,
    membershipStatus: (row.membership_status as Client["membershipStatus"]) || "active",
    progressions: (row.progressions as Client["progressions"]) || {},
    status: (row.status as Client["status"]) || "active",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapClientToRow(client: Partial<CreateClient | UpdateClient>, organizationId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    organization_id: organizationId,
  };
  if (client.name !== undefined) row.name = client.name.trim();
  if (client.phone !== undefined) row.phone = client.phone.trim();
  if (client.email !== undefined) row.email = client.email?.trim() || null;
  if (client.birthDate !== undefined) row.birth_date = client.birthDate || null;
  if (client.guardians !== undefined) row.guardians = client.guardians?.length ? client.guardians : null;
  if (client.notes !== undefined) row.notes = client.notes?.trim() || null;
  if (client.address !== undefined) row.address = client.address || null;
  if (client.planId !== undefined) row.plan_id = client.planId || null;
  if (client.planStartDate !== undefined) row.plan_start_date = client.planStartDate || null;
  if (client.billingStrategy !== undefined) row.billing_strategy = client.billingStrategy || null;
  if (client.cyclePaymentTiming !== undefined) row.cycle_payment_timing = client.cyclePaymentTiming || null;
  if (client.dueDay !== undefined) row.due_day = client.dueDay;
  if (client.discount !== undefined) row.discount = client.discount || null;
  if (client.membershipStatus !== undefined) row.membership_status = client.membershipStatus;
  if (client.status !== undefined) row.status = client.status;
  return row;
}

export async function listClientsFromDb(
  organizationId: string,
  filter?: ClientFilter,
): Promise<Client[]> {
  const client = await getClientForTenant();
  let query = client
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[clientsBackend] Erro ao listar clients:", error);
    throw new Error("Erro ao consultar alunos no banco de dados.");
  }

  let clients = (data ?? []).map((row) => mapRowToClient(row as Record<string, unknown>));

  if (filter?.search) {
    const term = filter.search.toLowerCase();
    const digitsOnly = filter.search.replace(/\D/g, "");
    clients = clients.filter((c) => {
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = digitsOnly.length > 0 && c.phone.replace(/\D/g, "").includes(digitsOnly);
      return matchName || matchPhone;
    });
  }

  return clients;
}

export async function getClientFromDb(
  organizationId: string,
  clientId: string,
): Promise<Client | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[clientsBackend] Erro ao buscar client:", error);
    throw new Error("Erro ao buscar dados do aluno no banco de dados.");
  }

  if (!data) return null;
  return mapRowToClient(data as Record<string, unknown>);
}

export async function createClientInDb(
  organizationId: string,
  payload: CreateClient,
): Promise<Client> {
  const client = await getClientForTenant();
  const row = mapClientToRow(payload, organizationId);
  row.progressions = payload.progressions || {};

  const { data, error } = await client
    .from("clients")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[clientsBackend] Erro ao criar client:", error);
    throw new Error("Erro ao salvar aluno no banco de dados.");
  }

  return mapRowToClient(data as Record<string, unknown>);
}

export async function updateClientInDb(
  organizationId: string,
  clientId: string,
  payload: UpdateClient,
): Promise<Client> {
  const client = await getClientForTenant();
  const row = mapClientToRow(payload, organizationId);

  const { data, error } = await client
    .from("clients")
    .update(row)
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .select()
    .single();

  if (error) {
    console.error("[clientsBackend] Erro ao atualizar client:", error);
    throw new Error("Erro ao atualizar aluno no banco de dados.");
  }

  return mapRowToClient(data as Record<string, unknown>);
}

export async function inactivateClientInDb(
  organizationId: string,
  clientId: string,
): Promise<void> {
  const client = await getClientForTenant();
  const { error } = await client
    .from("clients")
    .update({ status: "inactive" })
    .eq("organization_id", organizationId)
    .eq("id", clientId);

  if (error) {
    console.error("[clientsBackend] Erro ao inativar client:", error);
    throw new Error("Erro ao inativar aluno no banco de dados.");
  }
}

export async function saveModalityProgressionInDb(
  organizationId: string,
  studentId: string,
  progression: Omit<StudentModalityProgression, "updatedAt">,
): Promise<Client> {
  const client = await getClientForTenant();
  const existing = await getClientFromDb(organizationId, studentId);
  if (!existing) {
    throw new Error("Aluno não encontrado.");
  }

  const ts = new Date().toISOString();
  const updatedProgressions = {
    ...(existing.progressions ?? {}),
    [progression.modalityId]: {
      ...progression,
      updatedAt: ts,
    },
  };

  const { data, error } = await client
    .from("clients")
    .update({ progressions: updatedProgressions })
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .select()
    .single();

  if (error) {
    console.error("[clientsBackend] Erro ao salvar progressão:", error);
    throw new Error("Erro ao atualizar graduação no banco de dados.");
  }

  return mapRowToClient(data as Record<string, unknown>);
}

export async function promoteStudentInDb(
  organizationId: string,
  payload: {
    studentId: Id;
    modalityId: Id;
    modalityName?: string;
    toLevelId?: string;
    toLevelName: string;
    toLevelColor?: ProgressionBeltColor;
    toSubLevel: number;
    maxSubLevels?: number;
    date: DateISO;
    attendancesCompleted?: number;
    monthsInLevel?: number;
    isExam?: boolean;
    notes?: string;
    examiner?: string;
  },
): Promise<Client> {
  const client = await getClientForTenant();
  const existing = await getClientFromDb(organizationId, payload.studentId);
  if (!existing) {
    throw new Error("Aluno não encontrado.");
  }

  const currentProgression = existing.progressions?.[payload.modalityId];
  const ts = new Date().toISOString();

  const newHistoryEntry: StudentPromotionHistoryEntry = {
    id: `prom-${Date.now()}`,
    date: payload.date,
    fromLevelName: currentProgression?.levelName,
    fromSubLevel: currentProgression?.subLevel,
    toLevelName: payload.toLevelName,
    toLevelColor: payload.toLevelColor,
    toSubLevel: payload.toSubLevel,
    attendancesCompleted: payload.attendancesCompleted,
    monthsInLevel: payload.monthsInLevel,
    isExam: payload.isExam,
    notes: payload.notes,
    examiner: payload.examiner,
    createdAt: ts,
  };

  const updatedProgression: StudentModalityProgression = {
    modalityId: payload.modalityId,
    modalityName: payload.modalityName ?? currentProgression?.modalityName,
    levelId: payload.toLevelId ?? currentProgression?.levelId,
    levelName: payload.toLevelName,
    levelColor: payload.toLevelColor,
    subLevel: payload.toSubLevel,
    maxSubLevels: payload.maxSubLevels ?? currentProgression?.maxSubLevels,
    promotedAt: payload.date,
    strengths: currentProgression?.strengths ?? [],
    goals: currentProgression?.goals ?? [],
    evaluations: currentProgression?.evaluations ?? [],
    promotionHistory: [
      newHistoryEntry,
      ...(currentProgression?.promotionHistory ?? []),
    ],
    updatedAt: ts,
  };

  const updatedProgressions = {
    ...(existing.progressions ?? {}),
    [payload.modalityId]: updatedProgression,
  };

  const { data, error } = await client
    .from("clients")
    .update({ progressions: updatedProgressions })
    .eq("organization_id", organizationId)
    .eq("id", payload.studentId)
    .select()
    .single();

  if (error) {
    console.error("[clientsBackend] Erro ao promover aluno:", error);
    throw new Error("Erro ao gravar graduação no banco de dados.");
  }

  return mapRowToClient(data as Record<string, unknown>);
}

export async function updateStudentProgressionInDb(
  organizationId: string,
  studentId: string,
  progression: StudentModalityProgression,
): Promise<Client> {
  const client = await getClientForTenant();
  const existing = await getClientFromDb(organizationId, studentId);
  if (!existing) {
    throw new Error("Aluno não encontrado.");
  }

  const updatedProgressions = {
    ...(existing.progressions ?? {}),
    [progression.modalityId]: progression,
  };

  const { data, error } = await client
    .from("clients")
    .update({ progressions: updatedProgressions, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .select()
    .single();

  if (error) {
    console.error("[clientsBackend] Erro ao gravar progressão:", error);
    throw new Error("Erro ao atualizar dados pedagógicos no banco de dados.");
  }

  return mapRowToClient(data as Record<string, unknown>);
}
