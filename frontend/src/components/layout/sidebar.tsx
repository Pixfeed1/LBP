"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, CalendarSync, PenLine,
  Files, MessageSquare, Settings, Users, ChevronDown, Bell,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number | null;
  alert?: number | string | null;
}

const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/interventions", label: "Interventions", icon: FileText, count: null },
  { href: "/dashboard/calendrier", label: "Synchro Calendar", icon: CalendarSync },
  { href: "/dashboard/signatures", label: "Signatures", icon: PenLine, alert: null },
];

const NAV_ACTIVITY: NavItem[] = [
  { href: "/dashboard/documents", label: "Documents signés", icon: Files },
  { href: "/dashboard/sms", label: "SMS envoyés", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
];

const NAV_SETTINGS: NavItem[] = [
  { href: "/dashboard/configuration", label: "Configuration", icon: Settings },
  { href: "/dashboard/equipe", label: "Équipe", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const isActive = (href: string) => pathname === href;
  const initials = user?.name?.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "??";

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-border h-screen sticky top-0">
      {/* Workspace */}
      <div className="px-3 py-3 border-b border-border">
        <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">
            L
          </div>
          <span className="text-sm font-medium flex-1 text-left">Les Bons Plombiers</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Nav scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div>
          {NAV_MAIN.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.count != null && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded">{item.count}</span>
              )}
              {item.alert != null && (
                <span className="text-xs text-amber-700 bg-amber-100 px-1.5 rounded font-medium">{item.alert}</span>
              )}
            </Link>
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-1.5">Activité</p>
          {NAV_ACTIVITY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item.href) ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-1.5">Réglages</p>
          {NAV_SETTINGS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item.href) ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer user */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
              {initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
