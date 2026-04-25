"use client";
import { useRouter } from "next/navigation";
import { Calendar, Phone, ChevronRight } from "lucide-react";
import { Intervention, InterventionStatus } from "@/types/intervention";
import { formatPrice, formatDateShort, statusLabel } from "@/lib/format";

const BADGE_CLASSES: Record<InterventionStatus, string> = {
  pending: "badge-pending",
  sent: "badge-sent",
  signed: "badge-signed",
  partial: "badge-partial",
  expired: "badge-expired",
  cancelled: "badge-cancelled",
};

export function InterventionsTable({ items, loading }: { items: Intervention[]; loading: boolean }) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">Chargement...</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Aucune intervention pour ce filtre.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Client</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">RDV</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Travaux</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Montant</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Statut</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it) => (
            <tr key={it.id} onClick={() => router.push(`/dashboard/interventions/${it.id}`)} className="hover:bg-muted/30 transition-colors cursor-pointer group">
              <td className="px-4 py-3">
                <div className="font-medium text-sm">{it.client_nom} {it.client_prenom}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {it.client_telephone}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateShort(it.date_rdv, it.heure_rdv)}
                </div>
                {it.client_ville && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {it.client_code_postal} {it.client_ville}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                <div className="text-sm line-clamp-1">{it.description_travaux ?? "—"}</div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="text-sm font-semibold tabular-nums">{formatPrice(it.montant_devis_ttc)}</div>
                <div className="text-[10px] text-muted-foreground">TTC</div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${BADGE_CLASSES[it.status]}`}>
                  {statusLabel(it.status)}
                </span>
              </td>
              <td className="px-2 py-3">
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
