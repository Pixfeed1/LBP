"use client";

import { useState } from "react";
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
import type { Intervention } from "@/types/intervention";

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
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (intervention: Intervention) => void;
}

export function NewInterventionDialog({ open, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  
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

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        // Convertir prix en centimes
        montant_devis_ht: data.montant_devis_ht ? Math.round(data.montant_devis_ht * 100) : undefined,
        montant_devis_ttc: data.montant_devis_ttc ? Math.round(data.montant_devis_ttc * 100) : undefined,
        // Convertir date en datetime ISO
        date_rdv: new Date(`${data.date_rdv}T${data.heure_rdv?.replace("h", ":") || "09:00"}:00`).toISOString(),
        // Vider les chaînes vides
        client_email: data.client_email || undefined,
      };
      
      const res = await api.post<Intervention>("/api/interventions", payload);
      toast.success(`Intervention créée pour ${res.data.client_nom} ${res.data.client_prenom}`);
      reset();
      onCreated(res.data);
      onClose();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string | unknown[] } } };
      const detail = error?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : "Erreur lors de la création";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>Nouvelle intervention</DialogTitle>
          <DialogDescription>Créer un RDV et préparer les documents à signer.</DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-5">
          {/* Section Client */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client_nom">Nom *</Label>
                <Input id="client_nom" {...register("client_nom")} disabled={loading} placeholder="Dupont" />
                {errors.client_nom && <p className="text-xs text-destructive mt-1">{errors.client_nom.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_prenom">Prénom *</Label>
                <Input id="client_prenom" {...register("client_prenom")} disabled={loading} placeholder="Marie" />
                {errors.client_prenom && <p className="text-xs text-destructive mt-1">{errors.client_prenom.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_telephone">Téléphone *</Label>
                <Input id="client_telephone" {...register("client_telephone")} disabled={loading} placeholder="0612345678" />
                {errors.client_telephone && <p className="text-xs text-destructive mt-1">{errors.client_telephone.message}</p>}
              </div>
              <div>
                <Label htmlFor="client_email">Email</Label>
                <Input id="client_email" type="email" {...register("client_email")} disabled={loading} placeholder="client@example.com" />
                {errors.client_email && <p className="text-xs text-destructive mt-1">{errors.client_email.message}</p>}
              </div>
              <div className="col-span-2">
                <Label htmlFor="client_adresse">Adresse</Label>
                <Input id="client_adresse" {...register("client_adresse")} disabled={loading} placeholder="12 rue de la Paix" />
              </div>
              <div>
                <Label htmlFor="client_code_postal">Code postal</Label>
                <Input id="client_code_postal" {...register("client_code_postal")} disabled={loading} placeholder="75001" />
              </div>
              <div>
                <Label htmlFor="client_ville">Ville</Label>
                <Input id="client_ville" {...register("client_ville")} disabled={loading} placeholder="Paris" />
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
                <Input id="duree_estimee" type="number" {...register("duree_estimee")} disabled={loading} placeholder="60" />
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
                  placeholder="Remplacement chaudière, recherche fuite, etc."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="montant_devis_ht">Montant HT (€)</Label>
                  <Input id="montant_devis_ht" type="number" step="0.01" {...register("montant_devis_ht")} disabled={loading} placeholder="280.00" />
                </div>
                <div>
                  <Label htmlFor="montant_devis_ttc">Montant TTC (€)</Label>
                  <Input id="montant_devis_ttc" type="number" step="0.01" {...register("montant_devis_ttc")} disabled={loading} placeholder="336.00" />
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
            Créer l&apos;intervention
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
