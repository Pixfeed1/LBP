export interface SignatureItem {
  id: string;
  intervention_id: string;
  document_id: string;
  document_type: string;
  status: string;

  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signer_name_typed: string | null;
  signer_consent_text: string | null;
  hash_sha256: string | null;

  client_nom: string | null;
  client_prenom: string | null;
  client_telephone: string | null;
  intervention_status: string | null;

  signature_image: string | null;
}

export interface SignatureListResponse {
  items: SignatureItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SignatureStats {
  total_signatures: number;
  signed_today: number;
  signed_week: number;
  signed_month: number;
  unique_clients_signed: number;
  interventions_signed: number;
  interventions_total: number;
  signature_rate: number;
}

/* Signature individuelle dans la liste retournee par /api/interventions/{id}/signatures */
export interface SignatureItem {
  id: string;
  document_id: string;
  document_type: string;
  status: string;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signer_name_typed: string | null;
  signer_consent_text: string | null;
  hash_sha256: string | null;
  signature_image: string | null;
  provider: string;
}

/* Document associe a une signature */
export interface SignatureDocument {
  id: string;
  type: string;
  status: string;
  signed_at: string | null;
}

/* Reponse complete de /api/interventions/{id}/signatures */
export interface SignatureData {
  intervention_id: string;
  is_signed: boolean;
  signatures: SignatureItem[];
  documents: SignatureDocument[];
}
