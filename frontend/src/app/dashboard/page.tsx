"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw, Download, Plus, FileText, CheckCircle2, Clock,
  AlertCircle, MessageSquare, Calendar,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { InterventionsTable } from "@/components/dashboard/interventions-table";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type {
  Intervention, InterventionListResponse, InterventionStats, InterventionStatus,
} from "@/types/intervention";
import { statusLabel } from "@/lib/format";
import { InterventionDialog } from "@/components/dashboard/intervention-dialog";
import { useRouter } from "next/navigation";

const STATUS_TABS: { value: InterventionStatus | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "sent", label: "Envoyées" },
  { value: "signed", label: "Signées" },
  { value: "partial", label: "Partielles" },
  { value: "expired", label: "Expirées" },
  { value: "cancelled", label: "Annulées" },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<InterventionStats | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InterventionStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const loadStats = async () => {
    try {
      const res = await api.get<InterventionStats>("/api/interventions/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Erreur stats:", err);
    }
  };

  const loadInterventions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "20" });
      if (activeTab !== "all") params.set("status", activeTab);
      const res = await api.get<InterventionListResponse>(`/api/interventions?${params}`);
      setInterventions(res.data.items);
    } catch (err) {
      console.error("Erreur interventions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadInterventions()]);
    setRefreshing(false);
  };

  useEffect(() => { if (user) loadStats(); }, [user]);
  useEffect(() => { if (user) loadInterventions(); }, [user, activeTab]);

  if (!user) return null;

  const today = new Date();
  const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Faux sparklines basés sur les vraies stats (mocked progressivement)
  const sparkInterventions = [40, 50, 35, 60, 45, 70, 80];
  const sparkSignatures = [30, 40, 35, 50, 45, 60, 70];

  return (
    <>
      <Topbar breadcrumb="Tableau de bord" />

      {/* ===== MOBILE VIEW (< lg) ===== */}
      <main className="lg:hidden flex-1 px-3 pt-3 pb-4">
        {/* KPIs en 2x2 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <MobileKpi
            label="Interventions"
            value={stats?.total ?? "—"}
            sub={stats && stats.this_week ? `+${stats.this_week} cette sem.` : "Total"}
            tone="success"
          />
          <MobileKpi
            label="Signées"
            value={stats?.signed ?? "—"}
            sub={stats && stats.total ? `${Math.round((stats.signed / stats.total) * 100)}% taux` : "—"}
          />
          <MobileKpi
            label="En attente"
            value={(stats?.pending ?? 0) + (stats?.sent ?? 0)}
            sub={stats?.sent ? `${stats.sent} à relancer` : "—"}
            tone="warning"
          />
          <MobileKpi
            label="Interventions"
            value={stats?.this_month ?? "—"}
            sub="Ce mois"
          />
        </div>

        {/* À venir cette semaine */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-semibold">À venir cette semaine</h2>
          <button
            onClick={() => router.push("/dashboard/interventions")}
            className="text-xs text-primary"
          >
            Voir tout
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Chargement…</div>
        ) : interventions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground bg-white border border-border rounded-lg">
            Aucune intervention à venir
          </div>
        ) : (
          <div className="space-y-2">
            {interventions.slice(0, 5).map((iv) => (
              <MobileRdvCard
                key={iv.id}
                intervention={iv}
                onClick={() => router.push(`/dashboard/interventions/${iv.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      <main className="hidden lg:block flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        {/* Page head */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              {dayName} {dateStr}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-white hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-white hover:bg-muted/50 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Exporter
            </button>
            <button onClick={() => setDialogOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium">
              <Plus className="h-3.5 w-3.5" />
              Nouvelle intervention
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard
            label="Interventions"
            value={stats?.total ?? "—"}
            delta={stats?.week ? { value: `${stats.week} cette sem.`, trend: "up" } : undefined}
            icon={<FileText className="h-3.5 w-3.5" />}
            iconColor="text-primary"
            spark={sparkInterventions}
          />
          <MetricCard
            label="Signatures"
            value={stats?.signed ?? "—"}
            delta={stats && stats.total > 0 ? {
              value: `${Math.round((stats.signed / stats.total) * 100)}% taux`,
              trend: "neutral"
            } : undefined}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600"
            spark={sparkSignatures}
          />
          <MetricCard
            label="En attente"
            value={stats?.pending ?? "—"}
            delta={stats && stats.pending > 0 ? { value: "à relancer", trend: "down" } : undefined}
            icon={<Clock className="h-3.5 w-3.5" />}
            iconColor="text-amber-600"
          />
          <MetricCard
            label="Expirés"
            value={stats?.expired ?? "—"}
            delta={stats && stats.expired > 0 ? { value: "à archiver", trend: "neutral" } : undefined}
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            iconColor="text-red-600"
          />
          <MetricCard
            label="SMS envoyés"
            value="—"
            empty
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            iconColor="text-muted-foreground"
          />
          <MetricCard
            label="Cette semaine"
            value={stats?.week ?? "—"}
            delta={stats?.month ? { value: `${stats.month} ce mois`, trend: "neutral" } : undefined}
            icon={<Calendar className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
        </div>

        {/* Liste interventions */}
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <h2 className="font-semibold">Interventions récentes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {interventions.length} affichée{interventions.length > 1 ? "s" : ""}
                  {activeTab !== "all" && ` · ${statusLabel(activeTab as InterventionStatus)}`}
                </p>
              </div>
            </div>

            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map((tab) => {
                const isActive = activeTab === tab.value;
                const count = tab.value === "all" ? stats?.total : stats?.[tab.value as keyof InterventionStats];
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white hover:bg-muted/50 border-border text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                    {count !== undefined && count !== null && (
                      <span className={`ml-1 ${isActive ? "opacity-80" : "opacity-60"}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <InterventionsTable items={interventions} loading={loading} />
        </div>
      </main>
      <InterventionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { handleRefresh(); }}
      />
    </>
  );
}


// ============================================================
// Composants mobile-specific
// ============================================================

function MobileKpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const subColors = {
    neutral: "text-muted-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  };
  return (
    <div className="bg-white border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${subColors[tone]}`}>{sub}</div>}
    </div>
  );
}

function MobileRdvCard({
  intervention,
  onClick,
}: {
  intervention: Intervention;
  onClick: () => void;
}) {
  const initials = (
    (intervention.client_prenom?.[0] ?? "") + (intervention.client_nom?.[0] ?? "")
  ).toUpperCase() || "??";

  const statusBadge: Record<string, { label: string; classes: string }> = {
    pending: { label: "En attente", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    sent: { label: "SMS envoyé", classes: "bg-blue-50 text-blue-700 border-blue-200" },
    signed: { label: "Signé", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partial: { label: "Partiel", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    expired: { label: "Expiré", classes: "bg-slate-50 text-slate-600 border-slate-200" },
    cancelled: { label: "Annulé", classes: "bg-red-50 text-red-700 border-red-200" },
  };
  const badge = statusBadge[intervention.status] ?? { label: intervention.status, classes: "bg-muted text-muted-foreground border-border" };

  // Format date courte
  const dateRdv = intervention.date_rdv ? new Date(intervention.date_rdv) : null;
  const dateStr = dateRdv
    ? dateRdv.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
    : "Date à définir";

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {intervention.client_nom} {intervention.client_prenom}
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
          {dateStr}
          {intervention.client_ville ? ` · ${intervention.client_ville}` : ""}
        </div>
        <div className="mt-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badge.classes}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </button>
  );
}

