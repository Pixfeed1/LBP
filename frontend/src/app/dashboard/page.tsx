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

      <main className="flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
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
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium">
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
    </>
  );
}
