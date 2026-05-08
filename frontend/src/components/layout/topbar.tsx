"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, LogOut, Menu } from "lucide-react";

import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { SearchBox } from "@/components/layout/search-box";
import { useAuthStore } from "@/stores/auth-store";

export function Topbar({ breadcrumb }: { breadcrumb: string }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [query, setQuery] = useState("");

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-border">
      {/* Mobile header (< lg) */}
      <div className="lg:hidden flex items-center h-12 px-3 gap-2">
        <button className="p-2 -ml-1 rounded-md hover:bg-muted/60 transition-colors" aria-label="Menu">
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 text-center text-sm font-semibold truncate">{breadcrumb}</div>
        <NotificationsPopover />
      </div>

      {/* Desktop header (>= lg) */}
      <div className="hidden lg:flex items-center h-12 px-5 gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Les Bons Plombiers</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{breadcrumb}</span>
        </div>

        <div className="flex-1" />

        <SearchBox />

        <NotificationsPopover />

        <button className="p-1.5 rounded-md hover:bg-muted/60 transition-colors">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
