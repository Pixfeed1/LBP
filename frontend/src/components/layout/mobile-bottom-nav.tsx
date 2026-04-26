"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, PenLine, Settings } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Bord", icon: LayoutDashboard },
  { href: "/dashboard/interventions", label: "RDV", icon: FileText },
  { href: "/dashboard/signatures", label: "Sign.", icon: PenLine },
  { href: "/dashboard/configuration", label: "Réglages", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Pour /dashboard exactement (pas les sous-pages comme /dashboard/interventions)
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-30"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)", // safe area iPhone notch
      }}
    >
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{ minHeight: "44px" }} // norme tactile iOS
            >
              <tab.icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
