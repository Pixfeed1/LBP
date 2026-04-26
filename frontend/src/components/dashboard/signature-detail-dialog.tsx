"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ExternalLink, FileText, User, MapPin, Hash, Clock, Globe } from "lucide-react";

import { api } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import type { SignatureItem } from "@/types/signature";

interface Props {
  signature: SignatureItem | null;
  onClose: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  proces_verbal: "Procès-verbal",
  fiche_travaux: "Fiche travaux",
  attestation_tva: "Attestation TVA",
  delegation_paiement: "Délégation de paiement",
};

export function SignatureDetailDialog({ signature, onClose }: Props) {
  const [fullSig, setFullSig] = useState<SignatureItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signature) {
      setFullSig(null);
      return;
    }
    // Charger l'image canvas (qui n'est pas dans la liste)
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<SignatureItem>(`/api/signatures/${signature.id}`);
        setFullSig(res.data);
      } catch (err) {
        console.error("Erreur détail signature:", err);
        setFullSig(signature);
      } finally {
        setLoading(false);
      }
    })();
  }, [signature]);

  if (!signature) return null;

  const sig = fullSig ?? signature;
  const docLabel = DOC_TYPE_LABELS[sig.document_type] || sig.document_type;

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/api/documents/${sig.document_id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Erreur téléchargement PDF");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Preuve juridique de signature</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sig.client_nom} {sig.client_prenom} · {docLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Image canvas */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-medium text-emerald-900 mb-3">Signature manuscrite</p>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
            ) : sig.signature_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sig.signature_image}
                alt="Signature"
                className="bg-white border border-emerald-300 rounded p-2 max-h-40 mx-auto"
              />
            ) : (
              <div className="text-center text-sm text-muted-foreground py-4">
                Image non disponible
              </div>
            )}
          </div>

          {/* Détails */}
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              icon={<User className="h-3.5 w-3.5" />}
              label="Nom retapé"
              value={sig.signer_name_typed ?? "—"}
            />
            <Field
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Mention manuscrite"
              value={sig.signer_consent_text ?? "—"}
            />
            <Field
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Signé le"
              value={sig.signed_at ? formatDateShort(sig.signed_at) : "—"}
            />
            <Field
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Adresse IP"
              value={sig.signer_ip ?? "—"}
              mono
            />
            <Field
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Hash SHA-256"
              value={sig.hash_sha256 ?? "—"}
              mono
              wrap
            />
            <Field
              icon={<Globe className="h-3.5 w-3.5" />}
              label="User Agent"
              value={sig.signer_user_agent ?? "—"}
              wrap
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Télécharger le PDF signé
            </button>
            <Link
              href={`/dashboard/interventions/${sig.intervention_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-white hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir l&apos;intervention
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono = false,
  wrap = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${wrap ? "break-all" : ""}`}>
        {value}
      </div>
    </div>
  );
}
