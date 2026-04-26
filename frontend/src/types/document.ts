export type DocumentStatus = "pending" | "sent" | "signed" | "rejected" | "expired";
export type DocumentType = "proces_verbal" | "fiche_travaux" | "attestation_tva" | "delegation_paiement";

export interface DocumentItem {
  id: string;
  intervention_id: string;
  type: DocumentType | string;
  status: DocumentStatus | string;
  file_path_unsigned: string | null;
  file_path_signed: string | null;
  has_signed_file: boolean;
  signature_provider: string;
  signed_at: string | null;
  created_at: string;

  client_nom: string | null;
  client_prenom: string | null;
  client_telephone: string | null;
}

export interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DocumentStats {
  total: number;
  signed: number;
  pending: number;
  sent: number;
  rejected: number;
  expired: number;
  signed_today: number;
  signed_week: number;
  signed_month: number;
  by_type: Record<string, number>;
}
