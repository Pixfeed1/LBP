"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog, DialogHeader, DialogTitle, DialogDescription,
  DialogContent, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Intervention, InterventionStatus } from "@/types/intervention";

const schema = z.object({
  client_nom: z.string().min(1, "Nom requis"),
  client_prenom: z.string().min(1, "Prénom requis"),
  client_telephone: z.string().min(8, "Téléphone invalide"),
  client_email: z.string().email("Email invalide").optional().or(z.literal("")),
  client_adresse: z.string().optional(),
  client_code_postal: z.string().optional(),
  client_ville: z.string().optional(),
  date_rdv: z.string().min(1, "Date requise"),
  heure_rdv: z.string().optional(),
  duree_estimee: z.coerce.number().min(15).max(480).optional(),
  description_travaux: z.string().optional(),
  montant_devis_ht: z.coerce.number().min(0).optional(),
  montant_devis_ttc: z.coerce.number().min(0).optional(),
  logement_plus_2_ans: z.enum(["Y", "N"]).default("Y"),
  status: z.enum(["pending", "sent", "signed", "partial", "expired", "cancelled"]).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (intervention: Intervention) => void;
  /** Si fourni, mode édition (PATCH). Sinon mode création (POST). */
  intervention?: Intervention | null;
}

export function InterventionDialog({ open, onClose, onSaved, intervention }: Props) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!intervention;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      logement_plus_2_ans: "Y",
      date_rdv: tomorrowDate,
      heure_rdv: "09h00",
      duree_estimee: 60,
    },
  });

  // Précharger les valeurs en mode édition
  useEffect(() => {
    if (!open) return;
    if (intervention) {
      const d = new Date(intervention.date_rdv);
      reset({
        client_nom: intervention.client_nom,
        client_prenom: intervention.client_prenom,
        client_telephone: intervention.client_telephone,
        client_email: intervention.client_email ?? "",
        client_adresse: intervention.client_adresse ?? "",
        client_code_postal: intervention.client_code_postal ?? "",
        client_ville: intervention.client_ville ?? "",
        date_rdv: d.toISOString().split("T")[0],
        heure_rdv: intervention.heure_rdv ?? "09h00",
        duree_estimee: intervention.duree_estimee ?? 60,
        description_travaux: intervention.description_travaux ?? "",
        montant_devis_ht: intervention.montant_devis_ht ? intervention.montant_devis_ht / 100 : undefined,
        montant_devis_ttc: intervention.montant_devis_ttc ? intervention.montant_devis_ttc / 100 : undefined,
        logement_plus_2_ans: (intervention.logement_plus_2_ans === "N" ? "N" : "Y") as "Y" | "N",
        status: intervention.status,
      });
    } else {
      reset({
        client_nom: "",
        client_prenom: "",
        client_telephone: "",
        client_email: "",
        client_adresse: "",
        client_code_postal: "",
        client_ville: "",
        date_rdv: tomorrowDate,
        heure_rdv: "09h00",
        duree_estimee: 60,
        description_travaux: "",
        logement_plus_2_ans: "Y",
      });
    }
  }, [open, intervention, reset, tomorrowDate]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        client_nom: data.client_nom,
        client_prenom: data.client_prenom,
        client_telephone: data.client_telephone,
        client_email: data.client_email || undefined,
        client_adresse: data.client_adresse || undefined,
        client_code_postal: data.client_code_postal || undefined,
        client_ville: data.client_ville || undefined,
        heure_rdv: data.heure_rdv || undefined,
        duree_estimee: data.duree_estimee || undefined,
        description_travaux: data.description_travaux || undefined,
        montant_devis_ht: data.montant_devis_ht ? Math.round(data.montant_devis_ht * 100) : undefined,
        montant_devis_ttc: data.montant_devis_ttc ? Math.round(data.montant_devis_ttc * 100) : undefined,
        logement_plus_2_ans: data.logement_plus_2_ans,
        date_rdv: new Date(`${data.date_rdv}T${data.heure_rdv?.replace("h", ":") || "09:00"}:00`).toISOString(),
      };
      if (isEdit && data.status) {
        payload.status = data.status;
      }

      let res;
      if (isEdit && intervention) {
        res = await api.patch<Intervention>(`/api/interventions/${intervention.id}`, payload);
        toast.success(`Intervention modifiée`);
      } else {
        res = await api.post<Intervention>("/api/interventions", payload);
        toast.success(`Intervention créée pour ${res.data.client_nom} ${res.data.client_prenom}`);
      }
      onSaved(res.data);
      onClose();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string | unknown[] } } };
      const detail = error?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : `Erreur lors de ${isEdit ? "la modification" : "la création"}`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'intervention" : "Nouvelle intervention"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettre à jour les informations du RDV ou changer son statut."
              : "Créer un RDV et préparer les documents à signer."}
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-5">
          {/* Statut (mode édition seulement) */}
          {isEdit && (
            <div>
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                {...register("status")}
                disabled={loading}
                className="flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="pending">En attente</option>
                <option value="sent">Envoyé (SMS au client)</option>
                <option value="signed">Signé</option>
                <option value="partial">Partiel</option>
                <option value="expired">Expiré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          )}

          {/* Section Client */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client_nom">Nom *</Label>
                <Input id="client_nom" {...register("client_nom")} disabled={loading} />
                {errors.client_nom && <p className="text-xs text-destructive mt-1">{errors.client_nom.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_prenom">Prénom *</Label>
                <Input id="client_prenom" {...register("client_prenom")} disabled={loading} />
                {errors.client_prenom && <p className="text-xs text-destructive mt-1">{errors.client_prenom.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_telephone">Téléphone *</Label>
                <Input id="client_telephone" {...register("client_telephone")} disabled={loading} />
                {errors.client_telephone && <p className="text-xs text-destructive mt-1">{errors.client_telephone.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_email">Email</Label>
                <Input id="client_email" type="email" {...register("client_email")} disabled={loading} />
                {errors.client_email && <p className="text-xs text-destructive mt-1">{errors.client_email.message}</p>}
              </div>
              <div className="col-span-2">
                <Label htmlFor="client_adresse">Adresse</Label>
                <Input id="client_adresse" {...register("client_adresse")} disabled={loading} />
              </div>
              <div>
                <Label htmlFor="client_code_postal">Code postal</Label>
                <Input id="client_code_postal" {...register("client_code_postal")} disabled={loading} />
              </div>
              <div>
                <Label htmlFor="client_ville">Ville</Label>
                <Input id="client_ville" {...register("client_ville")} disabled={loading} />
              </div>
            </div>
          </div>

          {/* Section RDV */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rendez-vous</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="date_rdv">Date *</Label>
                <Input id="date_rdv" type="date" {...register("date_rdv")} disabled={loading} />
                {errors.date_rdv && <p className="text-xs text-destructive mt-1">{errors.date_rdv.message}</p>}
              </div>
              <div>
                <Label htmlFor="heure_rdv">Heure</Label>
                <Input id="heure_rdv" {...register("heure_rdv")} disabled={loading} placeholder="09h00" />
              </div>
              <div>
                <Label htmlFor="duree_estimee">Durée (min)</Label>
                <Input id="duree_estimee" type="number" {...register("duree_estimee")} disabled={loading} />
              </div>
            </div>
          </div>

          {/* Section Travaux */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Travaux</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="description_travaux">Description</Label>
                <Textarea
                  id="description_travaux"
                  {...register("description_travaux")}
                  disabled={loading}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="montant_devis_ht">Montant HT (€)</Label>
                  <Input id="montant_devis_ht" type="number" step="0.01" {...register("montant_devis_ht")} disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="montant_devis_ttc">Montant TTC (€)</Label>
                  <Input id="montant_devis_ttc" type="number" step="0.01" {...register("montant_devis_ttc")} disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="logement_plus_2_ans">Logement +2 ans</Label>
                  <select
                    id="logement_plus_2_ans"
                    {...register("logement_plus_2_ans")}
                    disabled={loading}
                    className="flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Y">Oui</option>
                    <option value="N">Non</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Enregistrer" : "Créer l'intervention"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
