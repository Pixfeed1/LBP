"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RefreshCw, Search, X, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  PenLine, CheckCircle2, Calendar, Users,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SignatureDetailDialog } from "@/components/dashboard/signature-detail-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { SignatureItem, SignatureListResponse, SignatureStats } from "@/types/signature";
import { formatDateShort } from "@/lib/format";

const PAGE_SIZE = 20;

const DOC_TYPE_LABELS: Record<string, string> = {
  proces_verbal: "PV",
  fiche_travaux: "Fiche",
  attestation_tva: "Att. TVA",
  delegation_paiement: "Délég.",
};

function SignaturesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const [items, setItems] = useState<SignatureItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [stats, setStats] = useState<SignatureStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [selectedSig, setSelectedSig] = useState<SignatureItem | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
      if (!("page" in updates)) params.delete("page");
      router.push(`/dashboard/signatures?${params.toString()}`);
    },
    [router, searchParams]
  );

  const loadStats = async () => {
    try {
      const res = await api.get<SignatureStats>("/api/signatures/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Erreur stats signatures:", err);
    }
  };

  const loadSignatures = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: PAGE_SIZE.toString(),
      });
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await api.get<SignatureListResponse>(`/api/signatures?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error("Erreur signatures:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadSignatures()]);
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
    if (user) loadSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, search, dateFrom, dateTo]);

  if (!user) return null;

  const hasFilters = search || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchInput("");
    router.push("/dashboard/signatures");
  };

  return (
    <>
      <Topbar breadcrumb="Signatures" />

      <main className="flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Signatures</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Audit trail · {total} signature{total > 1 ? "s" : ""}
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
            label="Total signatures"
            value={stats?.total_signatures ?? "—"}
            icon={<PenLine className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
          <MetricCard
            label="Taux signature"
            value={stats ? `${stats.signature_rate}%` : "—"}
            delta={stats ? { value: `${stats.interventions_signed}/${stats.interventions_total}`, trend: "neutral" } : undefined}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600"
          />
          <MetricCard
            label="Signées aujourd'hui"
            value={stats?.signed_today ?? "—"}
            delta={stats?.signed_week ? { value: `${stats.signed_week} cette sem.`, trend: "up" } : undefined}
            icon={<Calendar className="h-3.5 w-3.5" />}
            iconColor="text-amber-600"
          />
          <MetricCard
            label="Clients uniques"
            value={stats?.unique_clients_signed ?? "—"}
            delta={stats?.signed_month ? { value: `${stats.signed_month} ce mois`, trend: "neutral" } : undefined}
            icon={<Users className="h-3.5 w-3.5" />}
            iconColor="text-primary"
          />
        </div>

        {/* Liste */}
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher nom, IP, hash…"
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
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Aucune signature pour ces filtres.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Client</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Document</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Signé le</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">IP</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">Hash</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">Mention</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((sig) => (
                    <tr
                      key={sig.id}
                      onClick={() => setSelectedSig(sig)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">
                          {sig.client_nom} {sig.client_prenom}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sig.client_telephone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/5 text-primary border border-primary/20">
                          {DOC_TYPE_LABELS[sig.document_type] || sig.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDateShort(sig.signed_at)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <code className="text-xs font-mono bg-muted/40 px-1.5 py-0.5 rounded">
                          {sig.signer_ip ?? "—"}
                        </code>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <code className="text-xs font-mono text-muted-foreground">
                          {sig.hash_sha256 ? sig.hash_sha256.slice(0, 16) + "…" : "—"}
                        </code>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground italic">
                          {sig.signer_consent_text ? `"${sig.signer_consent_text}"` : "—"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
                Page {page} sur {pages} · {total} signature{total > 1 ? "s" : ""}
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

      <SignatureDetailDialog
        signature={selectedSig}
        onClose={() => setSelectedSig(null)}
      />
    </>
  );
}

export default function SignaturesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>}>
      <SignaturesPageContent />
    </Suspense>
  );
}


// ============================================================
// MOBILE : Card signature dans la liste
// ============================================================

function MobileSignatureCard({ sig, onClick }: { sig: SignatureItem; onClick: () => void }) {
  const fullName = ((sig.client_nom || "") + " " + (sig.client_prenom || "")).trim() || "—";
  const initials = (((sig.client_prenom || "")[0] || "") + ((sig.client_nom || "")[0] || "")).toUpperCase() || "??";

  const docTypeLabel: Record<string, string> = {
    proces_verbal: "PV",
    fiche_travaux: "Fiche travaux",
    attestation_tva: "Attestation TVA",
    delegation_paiement: "Delegation",
  };
  const docLabel = docTypeLabel[sig.document_type] || sig.document_type;

  const signedAt = sig.signed_at ? new Date(sig.signed_at) : null;
  const dateStr = signedAt
    ? signedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + signedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{fullName}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {docLabel} - {dateStr}
        </div>
        {sig.client_ip ? (
          <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
            IP {sig.client_ip}
          </div>
        ) : null}
      </div>
      <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Signe
      </span>
    </button>
  );
}

