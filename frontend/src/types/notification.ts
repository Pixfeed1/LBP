/* Types pour les notifications systeme du dashboard admin */

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationType =
  | "signature_received"
  | "signature_complete"
  | "sms_delivered"
  | "sms_failed"
  | "email_sent"
  | "email_failed"
  | "calendar_sync_success"
  | "calendar_sync_error"
  | "intervention_expired"
  | "intervention_created"
  | "system_error";

export interface Notification {
  id: string;
  type: NotificationType | string;
  severity: NotificationSeverity | string;
  title: string;
  message: string;
  link_url: string | null;
  intervention_id: string | null;
  is_read: boolean;
  read_at: string | null;
  email_sent: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}
