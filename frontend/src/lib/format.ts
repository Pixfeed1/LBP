import { InterventionStatus } from "@/types/intervention";

/** Formatage prix : centimes -> "1 234,56 €" */
export function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(euros);
}

/** Formatage date : "2026-04-30T21:53:35" -> "30 avr. 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formatage date+heure court : "30/04 09h00" */
export function formatDateShort(iso: string | null, heure?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  if (heure) return `${datePart} ${heure}`;
  return `${datePart} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Label en français pour un statut */
export function statusLabel(status: InterventionStatus): string {
  const labels: Record<InterventionStatus, string> = {
    pending: "En attente",
    sent: "Envoyé",
    signed: "Signé",
    partial: "Partiel",
    expired: "Expiré",
    cancelled: "Annulé",
  };
  return labels[status];
}

/** Couleur Tailwind pour un statut */
export function statusBadgeClass(status: InterventionStatus): string {
  const classes: Record<InterventionStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    signed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-orange-50 text-orange-700 border-orange-200",
    expired: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return classes[status];
}
