"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, AlertTriangle, Link2, Unlink,
  RefreshCw, Calendar, Clock, ArrowRight, FileText,
  Loader2, Zap, Bell, Workflow,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import type {
  CalendarStatus, CalendarStats, FieldMapping, SyncHistoryEntry,
} from "@/types/calendar";

export default function CalendarPage() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [mapping, setMapping] = useState<FieldMapping[]>([]);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const loadAll = async () => {
    try {
      const [s, st, m, h] = await Promise.all([
        api.get<CalendarStatus>("/api/calendar/status"),
        api.get<CalendarStats>("/api/calendar/stats"),
        api.get<FieldMapping[]>("/api/calendar/mapping"),
        api.get<SyncHistoryEntry[]>("/api/calendar/history"),
      ]);
      setStatus(s.data);
      setStats(st.data);
      setMapping(m.data);
      setHistory(h.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/api/calendar/test");
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("Erreur lors du test");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar breadcrumb="Synchro Calendar" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar breadcrumb="Synchro Calendar" />

      <main className="flex-1 px-5 py-5 max-w-5xl w-full mx-auto space-y-5">
        {/* Page head */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Synchronisation Google Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importer automatiquement les RDV de votre agenda professionnel.
          </p>
        </div>

        {/* État principal selon le state */}
        {status?.state === "disconnected" && <DisconnectedHero />}
        {status?.state === "error" && <ErrorHero status={status} onTest={handleTest} testing={testing} />}
        {status?.state === "connected" && <ConnectedHero status={status} stats={stats} onTest={handleTest} testing={testing} />}

        {/* Bénéfices (toujours visibles si déconnecté) */}
        {status?.state === "disconnected" && <BenefitsList />}

        {/* Mapping des champs */}
        <MappingSection mapping={mapping} />

        {/* Historique (uniquement si activé) */}
        {status?.state === "connected" && history.length > 0 && (
          <HistorySection history={history} />
        )}

        {/* Réglages polling */}
        <PollingSettings status={status} />

        {/* Encart attente Kevin (si déconnecté) */}
        {status?.state === "disconnected" && <PendingKevinNote />}
      </main>
    </>
  );
}

/* ============================================================
   ÉTAT 02 : Déconnecté
   ============================================================ */
function DisconnectedHero() {
  return (
    <div className="bg-white border border-border rounded-lg p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Unlink className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Pas encore connecté</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Connectez votre Google Calendar pour importer automatiquement les RDV
        et synchroniser les interventions sans saisie manuelle.
      </p>
      <Button disabled className="opacity-60 cursor-not-allowed" title="En attente des accès Google de Kevin">
        <Link2 className="mr-1.5 h-3.5 w-3.5" />
        Connecter Google Calendar
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        ⚠️ Cette action sera disponible quand les accès OAuth seront configurés
      </p>
    </div>
  );
}

/* ============================================================
   ÉTAT 03 : Erreur
   ============================================================ */
function ErrorHero({ status, onTest, testing }: { status: CalendarStatus; onTest: () => void; testing: boolean }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-900">Connexion en erreur</h2>
          <p className="text-sm text-red-700 mt-1">
            {status.error_message ?? "Le token OAuth a expiré ou été révoqué."}
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={onTest} disabled={testing} variant="outline" className="border-red-300 hover:bg-red-100">
              {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Tester la connexion
            </Button>
            <Button className="bg-red-600 hover:bg-red-700">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Reconnecter Google Calendar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ÉTAT 01 : Connecté
   ============================================================ */
function ConnectedHero({ status, stats, onTest, testing }: {
  status: CalendarStatus;
  stats: CalendarStats | null;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Synchronisation active</h2>
              <p className="text-sm text-emerald-700 mt-1">
                Calendrier <code className="font-mono text-xs bg-emerald-100 px-1.5 py-0.5 rounded">
                  {status.calendar_email ?? "—"}
                </code>
              </p>
              {status.last_sync && (
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Dernière sync : {formatDateShort(status.last_sync)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onTest} disabled={testing} variant="outline">
              {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Tester
            </Button>
            <Button variant="outline">
              <Unlink className="mr-1.5 h-3.5 w-3.5" />
              Déconnecter
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="Total synchronisés" value={stats.total_synced} icon={<Calendar className="h-3.5 w-3.5" />} />
          <StatBox label="Aujourd'hui" value={stats.today} icon={<Zap className="h-3.5 w-3.5" />} />
          <StatBox label="Cette semaine" value={stats.week} icon={<Calendar className="h-3.5 w-3.5" />} />
          <StatBox label="Ce mois" value={stats.month} icon={<Calendar className="h-3.5 w-3.5" />} />
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ============================================================
   Liste des bénéfices (état déconnecté)
   ============================================================ */
function BenefitsList() {
  const benefits = [
    { icon: <Zap className="h-4 w-4" />, title: "Import automatique des RDV", desc: "Les nouveaux events Google Calendar deviennent des interventions toutes les 15 minutes." },
    { icon: <Workflow className="h-4 w-4" />, title: "Mapping intelligent des champs", desc: "Le titre, lieu, heure et description sont extraits automatiquement vers les bons champs." },
    { icon: <Bell className="h-4 w-4" />, title: "Pas de double saisie", desc: "Vous gérez votre planning sur Google, l'app suit automatiquement le rythme." },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-3">
      {benefits.map((b, i) => (
        <div key={i} className="bg-white border border-border rounded-lg p-5">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
            {b.icon}
          </div>
          <h3 className="font-semibold text-sm mb-1">{b.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Mapping des champs
   ============================================================ */
function MappingSection({ mapping }: { mapping: FieldMapping[] }) {
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          Mapping des champs
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comment les events Google Calendar sont transformés en interventions LBP.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                Google Calendar
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-2.5">→</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                Intervention LBP
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                Transformation
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                Requis
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mapping.map((m, i) => (
              <tr key={i} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <code className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">{m.google_field}</code>
                </td>
                <td className="px-2 py-3 text-center text-muted-foreground">→</td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-primary">{m.intervention_field}</code>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                  {m.transformation ?? "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  {m.required ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Requis
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optionnel</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   Historique des syncs
   ============================================================ */
function HistorySection({ history }: { history: SyncHistoryEntry[] }) {
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Historique des synchronisations
        </h3>
      </div>
      <div className="divide-y divide-border">
        {history.map((h, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-3">
            {h.status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                {h.events_added > 0 && <span className="font-medium">{h.events_added} ajout{h.events_added > 1 ? "s" : ""}</span>}
                {h.events_added > 0 && h.events_updated > 0 && <span className="text-muted-foreground"> · </span>}
                {h.events_updated > 0 && <span className="font-medium">{h.events_updated} mise{h.events_updated > 1 ? "s" : ""} à jour</span>}
                {h.events_added === 0 && h.events_updated === 0 && <span className="text-muted-foreground">Aucun changement</span>}
              </div>
              {h.error && <div className="text-xs text-red-600 mt-0.5">{h.error}</div>}
            </div>
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {formatDateShort(h.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Réglages de polling
   ============================================================ */
function PollingSettings({ status }: { status: CalendarStatus | null }) {
  return (
    <div className="bg-white border border-border rounded-lg p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Réglages de polling
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Fréquence à laquelle l'app vérifie les nouveaux events sur Google Calendar.
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm">Toutes les</span>
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-muted text-sm font-mono font-medium">
          {status?.poll_interval_minutes ?? 15} minutes
        </span>
        <span className="text-xs text-muted-foreground">
          (modifiable dans .env via GOOGLE_CALENDAR_POLL_INTERVAL_MINUTES)
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Note d'attente Kevin
   ============================================================ */
function PendingKevinNote() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <FileText className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-900">En attente des accès Kevin</p>
        <p className="text-xs text-amber-800 mt-1">
          Kevin doit fournir : compte Google avec accès au calendrier pro, OAuth Client ID/Secret,
          Refresh Token. Une fois ajoutés au .env du serveur, cette page basculera automatiquement en état actif.
        </p>
      </div>
    </div>
  );
}
