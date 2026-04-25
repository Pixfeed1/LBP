"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Clock,
  FileText, User, Banknote, Edit, Trash2, Send, CheckCircle2,
  Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { InterventionDialog } from "@/components/dashboard/intervention-dialog";
import { api } from "@/lib/api";
import {
  formatPrice, formatDate, formatDateShort, statusLabel,
} from "@/lib/format";
import type { Intervention, InterventionStatus } from "@/types/intervention";

const BADGE_CLASSES: Record<InterventionStatus, string> = {
  pending: "badge-pending",
  sent: "badge-sent",
  signed: "badge-signed",
  partial: "badge-partial",
  expired: "badge-expired",
  cancelled: "badge-cancelled",
};

export default function InterventionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const reload = async () => {
    if (!id) return;
    try {
      const res = await api.get<Intervention>(`/api/interventions/${id}`);
      setIntervention(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendSignature = async () => {
    if (!intervention) return;
    if (!confirm(`Envoyer ${intervention.client_nom} ${intervention.client_prenom} pour signature ?\n\nCela va générer les documents et créer un lien de signature valide 7 jours.`)) return;
    
    setSending(true);
    try {
      const res = await api.post(`/api/interventions/${intervention.id}/send-signature`, {
        provider: "maison",
        expires_in_days: 7,
      });
      const data = res.data as { signature_url: string; documents_generated: number };
      toast.success(`${data.documents_generated} document(s) prêt(s) à signer !`, {
        description: `Lien : ${data.signature_url.substring(0, 50)}...`,
        duration: 6000,
      });
      await reload();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    api.get<Intervention>(`/api/interventions/${id}`)
      .then((res) => setIntervention(res.data))
      .catch((err) => {
        console.error(err);
        toast.error("Intervention introuvable");
        router.push("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement cette intervention ?")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/interventions/${id}`);
      toast.success("Intervention supprimée");
      router.push("/dashboard");
    } catch {
      toast.error("Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar breadcrumb="Intervention" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (!intervention) return null;

  const fullName = `${intervention.client_nom} ${intervention.client_prenom}`;
  const isUpcoming = new Date(intervention.date_rdv) > new Date();
  const canSendSignature = intervention.status === "pending";

  return (
    <>
      <Topbar breadcrumb={fullName} />

      <main className="flex-1 px-5 py-5 max-w-5xl w-full mx-auto">
        {/* Back button + actions */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au tableau de bord
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-white border border-border rounded-lg p-6 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${BADGE_CLASSES[intervention.status]}`}>
                  {statusLabel(intervention.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                RDV {isUpcoming ? "prévu" : "passé"} {formatDate(intervention.date_rdv)}
                {intervention.heure_rdv && ` à ${intervention.heure_rdv}`}
                {intervention.duree_estimee && ` · ${intervention.duree_estimee} min`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                {formatPrice(intervention.montant_devis_ttc)}
              </div>
              <div className="text-xs text-muted-foreground">
                TTC · {formatPrice(intervention.montant_devis_ht)} HT
              </div>
            </div>
          </div>

          {/* Actions principales */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
            {canSendSignature && (
              <Button onClick={handleSendSignature} disabled={sending}>
                {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Envoyer pour signature
              </Button>
            )}
            {intervention.status === "sent" && (
              <Button variant="outline" onClick={handleSendSignature} disabled={sending}>
                {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Renvoyer le SMS
              </Button>
            )}
            {intervention.status === "signed" && (
              <Button variant="outline">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Télécharger documents signés
              </Button>
            )}
            <Button variant="outline">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Voir documents
            </Button>
          </div>
        </div>

        {/* 2 colonnes : Client + Travaux + Métadonnées */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {/* Client */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" />
              Client
            </h3>
            <div className="space-y-3">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Nom complet" value={fullName} />
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone" value={intervention.client_telephone} />
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={intervention.client_email ?? "—"} />
              <Field
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Adresse"
                value={
                  intervention.client_adresse
                    ? `${intervention.client_adresse}, ${intervention.client_code_postal ?? ""} ${intervention.client_ville ?? ""}`.trim()
                    : "—"
                }
              />
            </div>
          </div>

          {/* Travaux */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Travaux
            </h3>
            <div className="space-y-3">
              <Field
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Description"
                value={intervention.description_travaux ?? "—"}
                multiline
              />
              <Field
                icon={<Banknote className="h-3.5 w-3.5" />}
                label="Montant HT"
                value={formatPrice(intervention.montant_devis_ht)}
              />
              <Field
                icon={<Banknote className="h-3.5 w-3.5" />}
                label="Montant TTC"
                value={formatPrice(intervention.montant_devis_ttc)}
                highlight
              />
              <Field
                icon={<AlertCircle className="h-3.5 w-3.5" />}
                label="Logement +2 ans"
                value={intervention.logement_plus_2_ans === "Y" ? "Oui (TVA 10%)" : "Non (TVA 20%)"}
              />
            </div>
          </div>
        </div>

        {/* Tracking signature */}
        <div className="bg-white border border-border rounded-lg p-5 mb-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Suivi signature
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Field
              icon={<Send className="h-3.5 w-3.5" />}
              label="SMS envoyés"
              value={intervention.sms_sent_count.toString()}
            />
            <Field
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Dernier envoi"
              value={intervention.last_sms_sent_at ? formatDateShort(intervention.last_sms_sent_at) : "—"}
            />
            <Field
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Lien expire"
              value={intervention.signature_link_expires_at ? formatDate(intervention.signature_link_expires_at) : "—"}
            />
          </div>
          {intervention.signature_token && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">Lien de signature</div>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                /signature/{intervention.signature_token}
              </code>
            </div>
          )}
        </div>

        {/* Métadonnées */}
        <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
          <div>ID : <code className="font-mono">{intervention.id}</code></div>
          <div>Créé le : {formatDateShort(intervention.created_at)}</div>
          <div>Modifié le : {formatDateShort(intervention.updated_at)}</div>
          {intervention.google_event_id && (
            <div>Google Event ID : <code className="font-mono">{intervention.google_event_id}</code></div>
          )}
        </div>
      </main>
      <InterventionDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { reload(); }}
        intervention={intervention}
      />
    </>
  );
}

// Helper pour afficher un champ
function Field({
  icon, label, value, highlight, multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm ${highlight ? "font-semibold text-primary" : ""} ${multiline ? "whitespace-pre-wrap" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
