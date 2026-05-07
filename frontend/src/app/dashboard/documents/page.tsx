"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Search, X, ChevronLeft, ChevronRight,
  FileText, CheckCircle2, Clock, Eye, Download,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { DocumentItem, DocumentListResponse, DocumentStats } from "@/types/document";
import { formatDateShort } from "@/lib/format";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = {
  proces_verbal: "Procès-verbal",
  fiche_travaux: "Fiche travaux",
  attestation_tva: "Attestation TVA",
  delegation_paiement: "Délégation",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  sent: "Envoyé",
  signed: "Signé",
  rejected: "Refusé",
  expired: "Expiré",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  signed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-slate-50 text-slate-600 border-slate-200",
};

function DocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const status = searchParams.get("status") || "all";
  const docType = searchParams.get("doc_type") || "all";
  const onlySigned = searchParams.get("only_signed") === "1";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
      if (!("page" in updates)) params.delete("page");
      router.push(`/dashboard/documents?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadStats = async () => {
    try {
      const res = await api.get<DocumentStats>("/api/documents/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Erreur stats documents:", err);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: PAGE_SIZE.toString(),
      });
      if (status !== "all") params.set("status", status);
      if (docType !== "all") params.set("doc_type", docType);
      if (onlySigned) params.set("only_signed", "true");
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await api.get<DocumentListResponse>(`/api/documents?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error("Erreur documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadDocuments()]);
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
    if (user) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, docType, onlySigned, page, search, dateFrom, dateTo]);

  if (!user) return null;

  const hasFilters = status !== "all" || docType !== "all" || onlySigned || search || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchInput("");
    router.push("/dashboard/documents");
  };

  const handleViewPdf = async (doc: DocumentItem) => {
    try {
      const res = await api.get(`/api/documents/${doc.id}/download`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("View PDF error:", err);
      alert("Erreur lors de l'ouverture du PDF");
    }
  };

  const handleDownloadPdf = async (doc: DocumentItem) => {
    try {
      const res = await api.get(`/api/documents/${doc.id}/download`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const label = TYPE_LABELS[doc.type] || doc.type;
      const filename = `${label}_${doc.client_nom ?? "client"}_${doc.id.slice(0, 8)}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Erreur lors du téléchargement du PDF");
    }
  };

  const STATUS_TABS = [
    { value: "all", label: "Tous", count: stats?.total },
    { value: "signed", label: "Signés", count: stats?.signed },
    { value: "sent", label: "Envoyés", count: stats?.sent },
    { value: "pending", label: "En attente", count: stats?.pending },
    { value: "expired", label: "Expirés", count: stats?.expired },
  ];

  const TYPE_TABS = [
    { value: "all", label: "Tous types" },
    { value: "proces_verbal", label: "PV" },
    { value: "fiche_travaux", label: "Fiche" },
    { value: "attestation_tva", label: "Att. TVA" },
    { value: "delegation_paiement", label: "Délégation" },
  ];

  return (
    <>
      <Topbar breadcrumb="Documents signés" />

      <main className="flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} document{total > 1 ? "s" : ""}
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
            label="Total documents"
            value={stats?.total ?? "—"}
            icon={<FileText className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
          <MetricCard
            label="Signés"
            value={stats?.signed ?? "—"}
            delta={stats && stats.total > 0 ? {
              value: `${Math.round((stats.signed / stats.total) * 100)}% du total`,
              trend: "neutral"
            } : undefined}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600"
          />
          <MetricCard
            label="En attente"
            value={stats ? stats.pending + stats.sent : "—"}
            delta={stats && stats.sent > 0 ? { value: `${stats.sent} envoyés`, trend: "up" } : undefined}
            icon={<Clock className="h-3.5 w-3.5" />}
            iconColor="text-amber-600"
          />
          <MetricCard
            label="Cette semaine"
            value={stats?.signed_week ?? "—"}
            delta={stats?.signed_today ? { value: `${stats.signed_today} aujourd'hui`, trend: "up" } : undefined}
            icon={<FileText className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
        </div>

        {/* Filtres + table */}
        {/* === MOBILE LIST === */}
          <div className="lg:hidden space-y-2 mb-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">Chargement...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">Aucun document</div>
            ) : (
              items.map((doc) => <MobileDocCard key={doc.id} doc={doc} />)
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
                  placeholder="Rechercher client, téléphone…"
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

            <div className="flex flex-wrap gap-3">
              <div className="flex gap-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center mr-1">Statut</span>
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
                      {tab.count !== undefined && tab.count !== null && (
                        <span className={`ml-1 ${isActive ? "opacity-80" : "opacity-60"}`}>
                          ({tab.count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center mr-1">Type</span>
                {TYPE_TABS.map((tab) => {
                  const isActive = docType === tab.value;
                  const count = tab.value === "all" ? null : stats?.by_type?.[tab.value];
                  return (
                    <button
                      key={tab.value}
                      onClick={() =>
                        updateParams({ doc_type: tab.value === "all" ? null : tab.value })
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
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "Aucun document pour ces filtres." : "Aucun document généré."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Document</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Client</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Statut</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Provider</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Date</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">
                              {TYPE_LABELS[doc.type] || doc.type}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {doc.has_signed_file ? "PDF signé" : "PDF brut"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/interventions/${doc.intervention_id}`}
                          className="font-medium text-sm hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {doc.client_nom ?? "—"} {doc.client_prenom ?? ""}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {doc.client_telephone ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_CLASSES[doc.status] || ""}`}>
                          {STATUS_LABELS[doc.status] || doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">
                          {doc.signature_provider || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {doc.signed_at ? (
                          <>
                            <div>{formatDateShort(doc.signed_at)}</div>
                            <div className="text-xs text-muted-foreground">signé</div>
                          </>
                        ) : (
                          <>
                            <div>{formatDateShort(doc.created_at)}</div>
                            <div className="text-xs text-muted-foreground">créé</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleViewPdf(doc)}
                            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
                            title="Voir le PDF"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(doc)}
                            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
                            title="Télécharger"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
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
                Page {page} sur {pages} · {total} document{total > 1 ? "s" : ""}
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
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>}>
      <DocumentsPageContent />
    </Suspense>
  );
}


// ============================================================
// MOBILE : Card document dans la liste
// ============================================================

function MobileDocCard({ doc }: { doc: DocumentItem }) {
  const router = useRouter();

  const docTypeLabel: Record<string, string> = {
    proces_verbal: "Proces-verbal",
    fiche_travaux: "Fiche travaux",
    attestation_tva: "Attestation TVA",
    delegation_paiement: "Delegation paiement",
  };
  const typeStr = docTypeLabel[doc.type] || doc.type;

  const isSigned = doc.status === "signed";
  const statusBadge: Record<string, { label: string; classes: string }> = {
    draft: { label: "Brouillon", classes: "bg-slate-50 text-slate-600 border-slate-200" },
    sent: { label: "Envoye", classes: "bg-blue-50 text-blue-700 border-blue-200" },
    signed: { label: "Signe", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    expired: { label: "Expire", classes: "bg-slate-50 text-slate-600 border-slate-200" },
  };
  const badge = statusBadge[doc.status] || { label: doc.status, classes: "bg-muted text-muted-foreground border-border" };

  const fullName = ((doc.client_nom || "") + " " + (doc.client_prenom || "")).trim() || "—";

  const dateStr = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";

  const handleDownload = async function(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await api.get("/api/documents/" + doc.id + "/download", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(function() { window.URL.revokeObjectURL(url); }, 60000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Erreur ouverture PDF");
    }
  };

  return (
    <div className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3">
      <div className={"flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-[10px] font-bold " + (isSigned ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
        PDF
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium truncate">{typeStr}</div>
          <span className={"flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border " + badge.classes}>
            {badge.label}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {fullName} - {dateStr}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={handleDownload}
            className="text-[11px] text-primary hover:underline"
          >
            Voir le PDF
          </button>
          {doc.intervention_id ? (
            <>
              <span className="text-[11px] text-muted-foreground">|</span>
              <button
                onClick={() => router.push("/dashboard/interventions/" + doc.intervention_id)}
                className="text-[11px] text-primary hover:underline"
              >
                Intervention
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

