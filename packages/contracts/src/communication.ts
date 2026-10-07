import type { DateTimeISO, Id } from "./common";

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "connected";

export interface WhatsAppSession {
  organizationId: Id;
  status: WhatsAppConnectionStatus;
  phoneNumber?: string;
  profileName?: string;
  connectedAt?: DateTimeISO;
  batteryLevel?: number;
  qrCodePayload?: string;
  allowedSendHours: {
    start: string;
    end: string;
  };
  monthlyQuota: {
    used: number;
    included: number;
  };
}

export type MessageTrigger =
  | "billing_before_due"
  | "billing_due_date"
  | "billing_after_due"
  | "billing_critical"
  | "welcome_student"
  | "absence_alert"
  | "birthday_greeting"
  | "manual_broadcast";

export type MessageCategory = "billing" | "retention" | "administrative";

export interface MessageTemplate {
  id: Id;
  organizationId: Id;
  trigger: MessageTrigger;
  category: MessageCategory;
  title: string;
  description: string;
  enabled: boolean;
  sendHour: string;
  daysOffset: number;
  content: string;
  availableVariables: string[];
  updatedAt: DateTimeISO;
}

export type MessageLogStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface MessageLog {
  id: Id;
  organizationId: Id;
  recipientName: string;
  recipientPhone: string;
  trigger: MessageTrigger;
  category: MessageCategory;
  content: string;
  status: MessageLogStatus;
  sentAt: DateTimeISO;
  readAt?: DateTimeISO;
  errorReason?: string;
}

export interface CommunicationMetrics {
  sentThisMonth: number;
  monthlyQuota: number;
  deliveryRate: number;
  readRate: number;
  recoveredAmountCents: number;
  activeAutomationsCount: number;
}

export interface SendMessagePayload {
  recipientName: string;
  recipientPhone: string;
  content: string;
  trigger?: MessageTrigger;
}

export interface UpdateTemplatePayload {
  id: Id;
  enabled?: boolean;
  sendHour?: string;
  daysOffset?: number;
  content?: string;
}

export interface UpdateSessionSettingsPayload {
  allowedSendHours?: {
    start: string;
    end: string;
  };
}
