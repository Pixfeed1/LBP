export type SmsStatus = "pending" | "sent" | "delivered" | "failed" | "undelivered";
export type SmsType = "signature_initial" | "signature_relance" | "rdv_rappel" | "autre";

export interface SmsItem {
  id: string;
  intervention_id: string | null;
  phone: string;
  message: string;
  sms_type: SmsType;
  status: SmsStatus;

  twilio_sid: string | null;
  error_message: string | null;

  sent_at: string;
  delivered_at: string | null;

  client_nom: string | null;
  client_prenom: string | null;
}

export interface SmsListResponse {
  items: SmsItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SmsStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  sent_today: number;
  sent_week: number;
  sent_month: number;
  success_rate: number;
}
