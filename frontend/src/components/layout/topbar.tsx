"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, HelpCircle, LogOut, Menu } from "lucide-react";
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
        <button className="relative p-2 -mr-1 rounded-md hover:bg-muted/60 transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5 text-foreground" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>

      {/* Desktop header (>= lg) */}
      <div className="hidden lg:flex items-center h-12 px-5 gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Les Bons Plombiers</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{breadcrumb}</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors px-3 py-1.5 rounded-md w-72 cursor-pointer">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher (⌘K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden lg:inline-flex h-5 px-1.5 text-[10px] font-medium bg-background border border-border rounded text-muted-foreground items-center">
            ⌘K
          </kbd>
        </div>

        <button className="relative p-1.5 rounded-md hover:bg-muted/60 transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

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
