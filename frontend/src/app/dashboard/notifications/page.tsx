"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, CheckCircle2, AlertTriangle, XCircle, Info,
  Mail, MessageSquare, CalendarSync, FileSignature, Loader2,
  ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { toast } from "sonner";

import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Notification, NotificationListResponse } from "@/types/notification";

const PAGE_SIZE = 20;

const SEVERITY_STYLES: Record<string, { bg: string; iconColor: string; icon: any; label: string }> = {
  critical: { bg: "bg-red-50", iconColor: "text-red-600", icon: XCircle, label: "Critique" },
  warning:  { bg: "bg-amber-50", iconColor: "text-amber-600", icon: AlertTriangle, label: "Avertissement" },
  success:  { bg: "bg-emerald-50", iconColor: "text-emerald-600", icon: CheckCircle2, label: "Succès" },
  info:     { bg: "bg-blue-50", iconColor: "text-blue-600", icon: Info, label: "Information" },
};

const TYPE_LABELS: Record<string, string> = {
  signature_complete: "Signature complète",
  signature_received: "Signature reçue",
  sms_failed: "SMS échoué",
  sms_delivered: "SMS livré",
  email_sent: "Email envoyé",
  email_failed: "Email échoué",
  calendar_sync_success: "Sync Calendar OK",
  calendar_sync_error: "Erreur sync Calendar",
  intervention_created: "Intervention créée",
  intervention_expired: "Lien expiré",
  system_error: "Erreur système",
};

const TYPE_ICONS: Record<string, any> = {
  signature_complete: FileSignature,
  signature_received: FileSignature,
  sms_failed: MessageSquare,
  sms_delivered: MessageSquare,
  email_sent: Mail,
  email_failed: Mail,
  calendar_sync_success: CalendarSync,
  calendar_sync_error: CalendarSync,
  intervention_created: FileSignature,
  intervention_expired: AlertTriangle,
  system_error: XCircle,
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return date.toLocaleDateString("fr-FR");
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filterUnread, setFilterUnread] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (filterUnread) params.set("only_unread", "true");
      if (filterType) params.set("type", filterType);
      if (filterSeverity) params.set("severity", filterSeverity);

      const res = await api.get<NotificationListResponse>(`/api/notifications?${params.toString()}`);
      setNotifications(res.data.items);
      setTotal(res.data.total);
      setUnreadCount(res.data.unread_count);
    } catch (e) {
      toast.error("Erreur lors du chargement des notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [page, filterUnread, filterType, filterSeverity]);

  const handleClickNotif = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await api.post(`/api/notifications/${notif.id}/read`);
        setUnreadCount(c => Math.max(0, c - 1));
        setNotifications(arr => arr.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch {}
    }
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.post<{ marked_count: number }>("/api/notifications/mark-all-read");
      toast.success(`${res.data.marked_count} notification(s) marquée(s) lue(s)`);
      setUnreadCount(0);
      setNotifications(arr => arr.map(n => ({ ...n, is_read: true })));
    } catch {
      toast.error("Erreur");
    }
  };

  const resetFilters = () => {
    setFilterUnread(false);
    setFilterType("");
    setFilterSeverity("");
    setPage(1);
  };

  const hasActiveFilters = filterUnread || filterType || filterSeverity;

  return (
    <>
      <Topbar breadcrumb="Notifications" />

      <main className="flex-1 px-4 lg:px-5 py-5 max-w-5xl w-full mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} au total · {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllRead} variant="outline" size="sm">
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Tout marquer lu
            </Button>
          )}
        </div>

        <div className="bg-white border border-border rounded-lg p-3 flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

          <button
            onClick={() => { setFilterUnread(!filterUnread); setPage(1); }}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              filterUnread
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-foreground border-border hover:bg-muted/40"
            }`}
          >
            Non lues seulement
          </button>

          <select
            value={filterSeverity}
            onChange={e => { setFilterSeverity(e.target.value); setPage(1); }}
            className="text-xs px-2.5 py-1 rounded-md border border-border bg-white"
          >
            <option value="">Tous niveaux</option>
            <option value="critical">Critique</option>
            <option value="warning">Avertissement</option>
            <option value="success">Succès</option>
            <option value="info">Information</option>
          </select>

          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="text-xs px-2.5 py-1 rounded-md border border-border bg-white"
          >
            <option value="">Toutes catégories</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
              Réinitialiser
            </button>
          )}
        </div>

        <div className="bg-white border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? "Aucune notification ne correspond aux filtres" : "Aucune notification"}
              </p>
            </div>
          ) : (
            <ul>
              {notifications.map(notif => {
                const sev = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.info;
                const TypeIcon = TYPE_ICONS[notif.type] || sev.icon;
                const typeLabel = TYPE_LABELS[notif.type] || notif.type;
                const clickable = !!notif.link_url;
                return (
                  <li key={notif.id} className={`border-b border-border last:border-b-0 ${notif.is_read ? "bg-white" : sev.bg}`}>
                    <button
                      onClick={() => handleClickNotif(notif)}
                      className={`w-full text-left px-4 py-3.5 transition-colors ${clickable ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full ${sev.bg} flex items-center justify-center mt-0.5`}>
                          <TypeIcon className={`h-4 w-4 ${sev.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">
                              {!notif.is_read && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: "#9f1239" }} />
                              )}
                              {notif.title}
                            </p>
                            <span className="text-xs text-muted-foreground flex-shrink-0" title={formatDateTime(notif.created_at)}>
                              {formatRelativeTime(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[10px] uppercase tracking-wider font-medium ${sev.iconColor}`}>{sev.label}</span>
                            <span className="text-[10px] text-muted-foreground/60">·</span>
                            <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                            {notif.email_sent && (
                              <>
                                <span className="text-[10px] text-muted-foreground/60">·</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-2.5 w-2.5" />
                                  Email admin envoyé
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Page {page} sur {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-border bg-white hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
