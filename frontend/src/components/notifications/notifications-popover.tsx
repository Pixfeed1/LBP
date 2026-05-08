"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, Check, CheckCircle2, AlertTriangle, XCircle, Info,
  Mail, MessageSquare, CalendarSync, FileSignature, Loader2,
} from "lucide-react";

import { api } from "@/lib/api";
import type { Notification, NotificationListResponse, UnreadCountResponse } from "@/types/notification";

const POLL_INTERVAL_MS = 30_000; // toutes les 30 secondes

const SEVERITY_STYLES: Record<string, { bg: string; iconColor: string; icon: any }> = {
  critical: { bg: "bg-red-50", iconColor: "text-red-600", icon: XCircle },
  warning:  { bg: "bg-amber-50", iconColor: "text-amber-600", icon: AlertTriangle },
  success:  { bg: "bg-emerald-50", iconColor: "text-emerald-600", icon: CheckCircle2 },
  info:     { bg: "bg-blue-50", iconColor: "text-blue-600", icon: Info },
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

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}j`;
  return date.toLocaleDateString("fr-FR");
}

export function NotificationsPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch unread count (polling)
  const fetchUnreadCount = async () => {
    try {
      const res = await api.get<UnreadCountResponse>("/api/notifications/unread-count");
      setUnreadCount(res.data.unread_count);
    } catch {
      // Silent fail
    }
  };

  // Fetch les 10 dernieres notifs
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get<NotificationListResponse>("/api/notifications?page_size=10");
      setNotifications(res.data.items);
      setUnreadCount(res.data.unread_count);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  // Mount + polling
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Charger notifs quand ouvert
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  // Click en dehors -> ferme
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleClickNotif = async (notif: Notification) => {
    // Ferme le popover en premier
    setOpen(false);

    // Marque lue (en parallele, pas bloquant)
    if (!notif.is_read) {
      api.post(`/api/notifications/${notif.id}/read`).then(() => {
        setUnreadCount(c => Math.max(0, c - 1));
        setNotifications(arr => arr.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }).catch(err => console.error("[NOTIF] mark read error:", err));
    }

    // Redirige si lien
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.post<{ marked_count: number }>("/api/notifications/mark-all-read");
      setUnreadCount(0);
      setNotifications(arr => arr.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  return (
    <div ref={popoverRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 -mr-1 rounded-md hover:bg-muted/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: "#9f1239" }}
            aria-label={`${unreadCount} non lues`}
            title={`${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-h-[520px] bg-white border border-border rounded-lg shadow-lg z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              <ul>
                {notifications.map(notif => {
                  const sev = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.info;
                  const TypeIcon = TYPE_ICONS[notif.type] || sev.icon;
                  return (
                    <li
                      key={notif.id}
                      className={`border-b border-border last:border-b-0 ${notif.is_read ? "bg-white" : sev.bg}`}
                    >
                      <button
                        onClick={() => handleClickNotif(notif)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full ${sev.bg} flex items-center justify-center`}>
                            <TypeIcon className={`h-4 w-4 ${sev.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {!notif.is_read && <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full mr-1.5 align-middle"></span>}
                                {notif.title}
                              </p>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatRelativeTime(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-primary hover:underline py-2"
            >
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
