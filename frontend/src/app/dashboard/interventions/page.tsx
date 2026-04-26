"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RefreshCw, Download, Plus, Search, X, ChevronLeft, ChevronRight,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { InterventionsTable } from "@/components/dashboard/interventions-table";
import { InterventionDialog } from "@/components/dashboard/intervention-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type {
  Intervention,
  InterventionListResponse,
  InterventionStats,
  InterventionStatus,
} from "@/types/intervention";

const STATUS_TABS: { value: InterventionStatus | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "sent", label: "Envoyées" },
  { value: "signed", label: "Signées" },
  { value: "partial", label: "Partielles" },
  { value: "expired", label: "Expirées" },
  { value: "cancelled", label: "Annulées" },
];

const PAGE_SIZE = 20;

function InterventionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  // État dérivé de l'URL (filtres = shareable)
  const status = (searchParams.get("status") as InterventionStatus | "all" | null) || "all";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const [items, setItems] = useState<Intervention[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [stats, setStats] = useState<InterventionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Met à jour l'URL (et reset page si on change autre chose que page)
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
      if (!("page" in updates)) params.delete("page");
      router.push(`/dashboard/interventions?${params.toString()}`);
    },
    [router, searchParams]
  );

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
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: PAGE_SIZE.toString(),
      });
      if (status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await api.get<InterventionListResponse>(
        `/api/interventions?${params}`
      );
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
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

  // Debounce recherche : 350ms après dernière frappe -> push URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput || null });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search, updateParams]);

  // Stats : une seule fois au mount
  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  // Liste : se recharge à chaque changement de filtre (URL)
  useEffect(() => {
    if (user) loadInterventions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, page, search, dateFrom, dateTo]);

  if (!user) return null;

  const hasFilters = status !== "all" || search || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchInput("");
    router.push("/dashboard/interventions");
  };

  return (
    <>
      <Topbar breadcrumb="Interventions" />

      <main className="flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        {/* Page head */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Interventions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} intervention{total > 1 ? "s" : ""}
              {hasFilters && " · filtres actifs"}
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
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle intervention
            </button>
          </div>
        </div>

        {/* Carte filtres + table */}
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border space-y-3">
            {/* Ligne 1 : recherche + dates + reset */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher nom, prénom, téléphone…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/40 border border-transparent rounded-md focus:bg-white focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => updateParams({ date_from: e.target.value || null })}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <label className="text-xs text-muted-foreground">au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => updateParams({ date_to: e.target.value || null })}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                  <X className="h-3 w-3" />
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Ligne 2 : tabs status (mêmes compteurs que dashboard) */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map((tab) => {
                const isActive = status === tab.value;
                const count =
                  tab.value === "all"
                    ? stats?.total
                    : stats?.[tab.value as keyof InterventionStats];
                return (
                  <button
                    key={tab.value}
                    onClick={() =>
                      updateParams({ status: tab.value === "all" ? null : tab.value })
                    }
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

          <div className="hidden lg:block">
            <InterventionsTable items={items} loading={loading} />
          </div>

          {/* === MOBILE LIST (< lg) === */}
          <div className="lg:hidden space-y-2">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">
                Chargement...
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">
                Aucune intervention
              </div>
            ) : (
              items.map((iv) => <MobileInterventionCard key={iv.id} iv={iv} />)
            )}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} sur {pages} · {total} résultat{total > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateParams({ page: (page - 1).toString() })}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Page précédente"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => updateParams({ page: (page + 1).toString() })}
                  disabled={page >= pages}
                  className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Page suivante"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <InterventionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          handleRefresh();
        }}
      />
    </>
  );
}

export default function InterventionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      }
    >
      <InterventionsPageContent />
    </Suspense>
  );
}


// ============================================================
// MOBILE : Card intervention dans la liste
// ============================================================

function MobileInterventionCard({ iv }: { iv: Intervention }) {
  const router = useRouter();
  const fullName = ((iv.client_nom || "") + " " + (iv.client_prenom || "")).trim() || "—";
  const initials = (((iv.client_prenom || "")[0] || "") + ((iv.client_nom || "")[0] || "")).toUpperCase() || "??";

  const dateRdv = iv.date_rdv ? new Date(iv.date_rdv) : null;
  const dateStr = dateRdv
    ? dateRdv.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
    : "Date a definir";
  const heureStr = dateRdv
    ? dateRdv.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const statusBadge: Record<string, { label: string; classes: string }> = {
    pending: { label: "En attente", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    sent: { label: "SMS envoye", classes: "bg-blue-50 text-blue-700 border-blue-200" },
    signed: { label: "Signe", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partial: { label: "Partiel", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    expired: { label: "Expire", classes: "bg-slate-50 text-slate-600 border-slate-200" },
    cancelled: { label: "Annule", classes: "bg-red-50 text-red-700 border-red-200" },
  };
  const badge = statusBadge[iv.status] || { label: iv.status, classes: "bg-muted text-muted-foreground border-border" };

  const montantStr = iv.montant_ttc != null ? (iv.montant_ttc / 100).toFixed(2) + " EUR" : "";

  return (
    <button
      onClick={() => router.push("/dashboard/interventions/" + iv.id)}
      className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium truncate">{fullName}</div>
          {montantStr ? (
            <div className="text-xs font-semibold text-primary tabular-nums flex-shrink-0">{montantStr}</div>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {dateStr}{heureStr ? " - " + heureStr : ""}
          {iv.client_ville ? " - " + iv.client_ville : ""}
        </div>
        <div className="mt-1.5">
          <span className={"inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border " + badge.classes}>
            {badge.label}
          </span>
        </div>
      </div>
    </button>
  );
}

