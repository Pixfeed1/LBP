export type CalendarState = "connected" | "disconnected" | "error";

export interface CalendarStatus {
  enabled: boolean;
  state: CalendarState;
  calendar_email: string | null;
  poll_interval_minutes: number;
  last_sync: string | null;
  error_message: string | null;
}

export interface CalendarStats {
  total_synced: number;
  today: number;
  week: number;
  month: number;
  last_event_at: string | null;
}

export interface SyncHistoryEntry {
  timestamp: string;
  status: "success" | "error";
  events_added: number;
  events_updated: number;
  error: string | null;
}

export interface FieldMapping {
  google_field: string;
  intervention_field: string;
  transformation: string | null;
  required: boolean;
}
