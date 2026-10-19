"use server";

import type {
  Id,
  MessageCategory,
  MessageLog,
  MessageLogFilter,
  MessageTemplate,
  MessageTrigger,
  PaginatedResult,
  UpdateTemplatePayload,
  WhatsAppConnection,
} from "@gestarahub/contracts";
import { getClientForTenant } from "@/lib/supabase/tenant-client";

// =============================================================================
// Row Mappers
// =============================================================================

function mapRowToConnection(row: Record<string, unknown>): WhatsAppConnection {
  return {
    organizationId: String(row.organization_id),
    officialStatus: row.official_status as WhatsAppConnection["officialStatus"],
    phoneNumber: row.phone_number ? String(row.phone_number) : undefined,
    displayName: row.display_name ? String(row.display_name) : undefined,
    connectedAt: row.connected_at ? new Date(String(row.connected_at)).toISOString() : undefined,
    allowedSendHours: (row.allowed_send_hours as WhatsAppConnection["allowedSendHours"]) || {
      start: "08:00",
      end: "20:00",
    },
    monthlyQuota: (row.monthly_quota as WhatsAppConnection["monthlyQuota"]) || {
      used: 0,
      included: 500,
    },
  };
}

function mapRowToTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    trigger: row.trigger as MessageTrigger,
    category: row.category as MessageCategory,
    title: String(row.title),
    description: String(row.description),
    enabled: Boolean(row.enabled),
    sendHour: String(row.send_hour),
    daysOffset: typeof row.days_offset === "number" ? row.days_offset : Number(row.days_offset),
    content: String(row.content),
    availableVariables: (row.available_variables as string[]) || [],
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
  };
}

function mapRowToLog(row: Record<string, unknown>): MessageLog {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    recipientName: String(row.recipient_name),
    recipientPhone: String(row.recipient_phone),
    trigger: row.trigger as MessageTrigger,
    category: row.category as MessageCategory,
    content: String(row.content),
    status: row.status as MessageLog["status"],
    clientId: row.client_id ? String(row.client_id) : undefined,
    chargeId: row.charge_id ? String(row.charge_id) : undefined,
    sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : new Date().toISOString(),
    readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : undefined,
    errorReason: row.error_reason ? String(row.error_reason) : undefined,
  };
}

// =============================================================================
// WhatsApp Connection Backend Operations
// =============================================================================

export async function getWhatsAppConnectionFromDb(
  organizationId: string,
): Promise<WhatsAppConnection | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("whatsapp_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[communicationBackend] Erro ao buscar conexão do WhatsApp:", error);
    throw new Error("Erro ao consultar conexão do WhatsApp no banco de dados.");
  }

  return data ? mapRowToConnection(data) : null;
}

export async function saveWhatsAppConnectionInDb(
  connection: WhatsAppConnection,
): Promise<WhatsAppConnection> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("whatsapp_connections")
    .upsert(
      {
        organization_id: connection.organizationId,
        official_status: connection.officialStatus,
        phone_number: connection.phoneNumber ?? null,
        display_name: connection.displayName ?? null,
        connected_at: connection.connectedAt ?? null,
        allowed_send_hours: connection.allowedSendHours,
        monthly_quota: connection.monthlyQuota,
      },
      { onConflict: "organization_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[communicationBackend] Erro ao salvar conexão do WhatsApp:", error);
    throw new Error("Erro ao atualizar conexão do WhatsApp no banco de dados.");
  }

  return mapRowToConnection(data);
}

// =============================================================================
// Message Templates Backend Operations
// =============================================================================

export async function listMessageTemplatesFromDb(
  organizationId: string,
): Promise<MessageTemplate[]> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("message_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("days_offset", { ascending: true });

  if (error) {
    console.error("[communicationBackend] Erro ao listar modelos de mensagem:", error);
    throw new Error("Erro ao consultar modelos de mensagem no banco de dados.");
  }

  return (data || []).map(mapRowToTemplate);
}

export async function getMessageTemplateFromDb(
  id: Id,
  organizationId: string,
): Promise<MessageTemplate | null> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[communicationBackend] Erro ao obter modelo de mensagem:", error);
    throw new Error("Erro ao consultar modelo de mensagem no banco de dados.");
  }

  return data ? mapRowToTemplate(data) : null;
}

export async function saveMessageTemplateInDb(
  template: MessageTemplate,
): Promise<MessageTemplate> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("message_templates")
    .upsert(
      {
        id: template.id,
        organization_id: template.organizationId,
        trigger: template.trigger,
        category: template.category,
        title: template.title,
        description: template.description,
        enabled: template.enabled,
        send_hour: template.sendHour,
        days_offset: template.daysOffset,
        content: template.content,
        available_variables: template.availableVariables,
      },
      { onConflict: "organization_id,trigger" },
    )
    .select()
    .single();

  if (error) {
    console.error("[communicationBackend] Erro ao salvar modelo de mensagem:", error);
    throw new Error("Erro ao salvar modelo de mensagem no banco de dados.");
  }

  return mapRowToTemplate(data);
}

export async function insertMessageTemplatesBatchInDb(
  templates: MessageTemplate[],
): Promise<MessageTemplate[]> {
  if (templates.length === 0) return [];
  const client = await getClientForTenant();
  const rows = templates.map((template) => ({
    id: template.id,
    organization_id: template.organizationId,
    trigger: template.trigger,
    category: template.category,
    title: template.title,
    description: template.description,
    enabled: template.enabled,
    send_hour: template.sendHour,
    days_offset: template.daysOffset,
    content: template.content,
    available_variables: template.availableVariables,
  }));

  const { data, error } = await client
    .from("message_templates")
    .upsert(rows, { onConflict: "organization_id,trigger" })
    .select();

  if (error) {
    console.error("[communicationBackend] Erro ao semear modelos de mensagem:", error);
    throw new Error("Erro ao semear modelos de mensagem no banco de dados.");
  }

  return (data || []).map(mapRowToTemplate);
}

export async function updateMessageTemplateInDb(
  id: Id,
  payload: UpdateTemplatePayload,
  organizationId: string,
): Promise<MessageTemplate> {
  const client = await getClientForTenant();
  const updates: Record<string, unknown> = {};

  if (payload.content !== undefined) updates.content = payload.content.trim();
  if (payload.enabled !== undefined) updates.enabled = payload.enabled;
  if (payload.sendHour !== undefined) updates.send_hour = payload.sendHour;
  if (payload.daysOffset !== undefined) updates.days_offset = payload.daysOffset;

  const { data, error } = await client
    .from("message_templates")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();

  if (error) {
    console.error("[communicationBackend] Erro ao atualizar modelo de mensagem:", error);
    throw new Error("Erro ao atualizar modelo de mensagem no banco de dados.");
  }

  return mapRowToTemplate(data);
}

// =============================================================================
// Message Logs Backend Operations
// =============================================================================

export async function listMessageLogsFromDb(
  organizationId: string,
  filter?: { trigger?: string; status?: string; clientId?: Id; limit?: number },
): Promise<MessageLog[]> {
  const client = await getClientForTenant();
  let query = client
    .from("message_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sent_at", { ascending: false });

  if (filter?.clientId) {
    query = query.eq("client_id", filter.clientId);
  }
  if (filter?.trigger && filter.trigger !== "all") {
    query = query.eq("trigger", filter.trigger);
  }
  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[communicationBackend] Erro ao listar logs de mensagem:", error);
    throw new Error("Erro ao consultar histórico de mensagens no banco de dados.");
  }

  return (data || []).map(mapRowToLog);
}

export async function listMessageLogsPaginatedFromDb(
  organizationId: string,
  filter?: MessageLogFilter,
): Promise<PaginatedResult<MessageLog>> {
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const client = await getClientForTenant();
  let query = client
    .from("message_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("sent_at", { ascending: false });

  if (filter?.clientId) {
    query = query.eq("client_id", filter.clientId);
  }
  if (filter?.trigger && filter.trigger !== "all") {
    query = query.eq("trigger", filter.trigger);
  }
  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }
  if (filter?.search?.trim()) {
    const term = `%${filter.search.trim()}%`;
    query = query.or(`recipient_name.ilike.${term},recipient_phone.ilike.${term},content.ilike.${term}`);
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[communicationBackend] Erro ao listar logs de mensagem:", error);
    throw new Error("Erro ao consultar histórico de mensagens no banco de dados.");
  }

  const items = (data || []).map(mapRowToLog);
  const total = count ?? items.length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

export async function createMessageLogInDb(
  log: MessageLog,
): Promise<MessageLog> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("message_logs")
    .insert({
      id: log.id,
      organization_id: log.organizationId,
      recipient_name: log.recipientName.trim(),
      recipient_phone: log.recipientPhone,
      trigger: log.trigger,
      category: log.category,
      content: log.content.trim(),
      status: log.status,
      client_id: log.clientId ?? null,
      charge_id: log.chargeId ?? null,
      sent_at: log.sentAt,
      read_at: log.readAt ?? null,
      error_reason: log.errorReason ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[communicationBackend] Erro ao criar log de mensagem:", error);
    throw new Error("Erro ao salvar histórico de mensagem no banco de dados.");
  }

  return mapRowToLog(data);
}

export async function updateMessageLogInDb(
  log: MessageLog,
): Promise<MessageLog> {
  const client = await getClientForTenant();
  const { data, error } = await client
    .from("message_logs")
    .update({
      status: log.status,
      read_at: log.readAt ?? null,
      error_reason: log.errorReason ?? null,
      sent_at: log.sentAt,
    })
    .eq("id", log.id)
    .eq("organization_id", log.organizationId)
    .select()
    .single();

  if (error) {
    console.error("[communicationBackend] Erro ao atualizar log de mensagem:", error);
    throw new Error("Erro ao atualizar histórico de mensagem no banco de dados.");
  }

  return mapRowToLog(data);
}
