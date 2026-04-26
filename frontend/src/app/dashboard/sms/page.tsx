"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Search, X, ChevronLeft, ChevronRight,
  MessageSquare, Send, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { SmsItem, SmsListResponse, SmsStats, SmsStatus } from "@/types/sms";
import { formatDateShort } from "@/lib/format";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<SmsStatus, string> = {
  pending: "En attente",
  sent: "Envoyé",
  delivered: "Délivré",
  failed: "Échoué",
  undelivered: "Non délivré",
};

const STATUS_CLASSES: Record<SmsStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  undelivered: "bg-orange-50 text-orange-700 border-orange-200",
};

const TYPE_LABELS: Record<string, string> = {
  signature_initial: "Signature",
  signature_relance: "Relance",
  rdv_rappel: "Rappel RDV",
  autre: "Autre",
};

function SmsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const status = (searchParams.get("status") as SmsStatus | null) || "all";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const [items, setItems] = useState<SmsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [selectedSms, setSelectedSms] = useState<SmsItem | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
      if (!("page" in updates)) params.delete("page");
      router.push(`/dashboard/sms?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadStats = async () => {
    try {
      const res = await api.get<SmsStats>("/api/sms/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Erreur stats SMS:", err);
    }
  };

  const loadSms = async () => {
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

      const res = await api.get<SmsListResponse>(`/api/sms?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error("Erreur SMS:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadSms()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput || null });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search, updateParams]);

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  useEffect(() => {
    if (user) loadSms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, page, search, dateFrom, dateTo]);

  if (!user) return null;

  const hasFilters = status !== "all" || search || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchInput("");
    router.push("/dashboard/sms");
  };

  const STATUS_TABS: { value: SmsStatus | "all"; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "sent", label: "Envoyés" },
    { value: "delivered", label: "Délivrés" },
    { value: "failed", label: "Échoués" },
    { value: "pending", label: "En attente" },
  ];

  return (
    <>
      <Topbar breadcrumb="SMS envoyés" />

      <main className="flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SMS envoyés</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historique Twilio · {total} SMS
              {hasFilters && " · filtres actifs"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-white hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Total SMS"
            value={stats?.total ?? "—"}
            delta={stats?.sent_week ? { value: `${stats.sent_week} cette sem.`, trend: "up" } : undefined}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
          <MetricCard
            label="Taux succès"
            value={stats ? `${stats.success_rate}%` : "—"}
            delta={stats ? { value: `${stats.sent + stats.delivered}/${stats.total}`, trend: "neutral" } : undefined}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600"
          />
          <MetricCard
            label="Aujourd'hui"
            value={stats?.sent_today ?? "—"}
            icon={<Send className="h-3.5 w-3.5" />}
            iconColor="text-amber-600"
          />
          <MetricCard
            label="Échoués"
            value={stats?.failed ?? "—"}
            icon={<XCircle className="h-3.5 w-3.5" />}
            iconColor="text-red-600"
          />
        </div>

        {/* Filtres + table */}
        {/* === MOBILE LIST === */}
          <div className="lg:hidden space-y-2 mb-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">Chargement...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">Aucun SMS</div>
            ) : (
              items.map((sms) => <MobileSmsCard key={sms.id} sms={sms} onClick={() => setSelectedSms(sms)} />)
            )}
          </div>

          {/* === DESKTOP TABLE === */}
          <div className="hidden lg:block bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher numéro, client, message…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/40 border border-transparent rounded-md focus:bg-white focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => updateParams({ date_from: e.target.value || null })}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-white"
                />
                <label className="text-xs text-muted-foreground">au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => updateParams({ date_to: e.target.value || null })}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-white"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md"
                >
                  <X className="h-3 w-3" />
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map((tab) => {
                const isActive = status === tab.value;
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
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "Aucun SMS pour ces filtres." : "Aucun SMS envoyé pour l'instant."}
              </p>
              {!hasFilters && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Les SMS s&apos;afficheront ici dès le premier envoi.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Destinataire</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Message</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Envoyé</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Statut</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((sms) => (
                    <tr
                      key={sms.id}
                      onClick={() => setSelectedSms(sms)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">
                          {sms.client_nom ? `${sms.client_nom} ${sms.client_prenom ?? ""}`.trim() : "—"}
                        </div>
                        <code className="text-xs font-mono text-muted-foreground">{sms.phone}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/5 text-primary border border-primary/20">
                          {TYPE_LABELS[sms.sms_type] || sms.sms_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-md">
                        <div className="text-sm line-clamp-2 text-muted-foreground">
                          {sms.message}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDateShort(sms.sent_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_CLASSES[sms.status]}`}>
                          {STATUS_LABELS[sms.status]}
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
          )}

          {pages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} sur {pages} · {total} SMS
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateParams({ page: (page - 1).toString() })}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => updateParams({ page: (page + 1).toString() })}
                  disabled={page >= pages}
                  className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal détail SMS */}
      {selectedSms && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedSms(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Détail SMS</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TYPE_LABELS[selectedSms.sms_type] || selectedSms.sms_type} · {formatDateShort(selectedSms.sent_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedSms(null)}
                className="p-1.5 rounded-md hover:bg-muted/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Destinataire</div>
                <div className="text-sm">
                  {selectedSms.client_nom ? `${selectedSms.client_nom} ${selectedSms.client_prenom ?? ""}`.trim() : "—"}
                </div>
                <code className="text-xs font-mono text-muted-foreground">{selectedSms.phone}</code>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="text-sm bg-muted/30 rounded p-3 whitespace-pre-wrap">
                  {selectedSms.message}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {selectedSms.message.length} caractères ·{" "}
                  {Math.ceil(selectedSms.message.length / 160)} segment{selectedSms.message.length > 160 ? "s" : ""}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Statut</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_CLASSES[selectedSms.status]}`}>
                    {STATUS_LABELS[selectedSms.status]}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Twilio SID</div>
                  <code className="text-xs font-mono break-all">{selectedSms.twilio_sid ?? "—"}</code>
                </div>
              </div>

              {selectedSms.error_message && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <div className="text-xs font-medium text-red-900 mb-1">Erreur</div>
                  <div className="text-xs text-red-700 break-all">{selectedSms.error_message}</div>
                </div>
              )}

              {selectedSms.intervention_id && (
                <div className="pt-3 border-t border-border">
                  <Link
                    href={`/dashboard/interventions/${selectedSms.intervention_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-white hover:bg-muted/50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Voir l&apos;intervention
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SmsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>}>
      <SmsPageContent />
    </Suspense>
  );
}


// ============================================================
// MOBILE : Card SMS dans la liste
// ============================================================

function MobileSmsCard({ sms, onClick }: { sms: SmsItem; onClick: () => void }) {
  const sentAt = sms.sent_at ? new Date(sms.sent_at) : null;
  const dateStr = sentAt
    ? sentAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + sentAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  const statusBadge: Record<string, { label: string; classes: string }> = {
    pending: { label: "En attente", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    sent: { label: "Envoye", classes: "bg-blue-50 text-blue-700 border-blue-200" },
    delivered: { label: "Delivre", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    failed: { label: "Echec", classes: "bg-red-50 text-red-700 border-red-200" },
    undelivered: { label: "Non delivre", classes: "bg-red-50 text-red-700 border-red-200" },
  };
  const badge = statusBadge[sms.status] || { label: sms.status, classes: "bg-muted text-muted-foreground border-border" };

  const typeLabel: Record<string, string> = {
    signature_initial: "Initial",
    signature_relance: "Relance",
    rdv_rappel: "Rappel J-1",
    deplacement: "Deplacement",
    annulation: "Annulation",
    test: "Test",
  };
  const typeStr = typeLabel[sms.sms_type] || sms.sms_type;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium font-mono truncate">{sms.phone || "—"}</div>
          <span className={"flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border " + badge.classes}>
            {badge.label}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {typeStr} - {dateStr}
        </div>
        {sms.message ? (
          <div className="text-[11px] text-foreground/70 mt-1 line-clamp-2 italic">
            "{sms.message.slice(0, 80)}{sms.message.length > 80 ? "..." : ""}"
          </div>
        ) : null}
      </div>
    </button>
  );
}

