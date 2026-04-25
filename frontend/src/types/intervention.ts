export type InterventionStatus =
  | "pending"
  | "sent"
  | "signed"
  | "partial"
  | "expired"
  | "cancelled";

export interface Intervention {
  id: string;
  google_event_id: string | null;
  
  client_nom: string;
  client_prenom: string;
  client_telephone: string;
  client_email: string | null;
  client_adresse: string | null;
  client_code_postal: string | null;
  client_ville: string | null;
  
  date_rdv: string;
  heure_rdv: string | null;
  duree_estimee: number | null;
  
  description_travaux: string | null;
  montant_devis_ht: number | null;
  montant_devis_ttc: number | null;
  logement_plus_2_ans: string;
  
  status: InterventionStatus;
  signature_token: string | null;
  signature_link_expires_at: string | null;
  
  sms_sent_count: number;
  last_sms_sent_at: string | null;
  
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface InterventionListResponse {
  items: Intervention[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface InterventionStats {
  total: number;
  pending: number;
  sent: number;
  signed: number;
  partial: number;
  expired: number;
  cancelled: number;
  today: number;
  week: number;
  month: number;
}
