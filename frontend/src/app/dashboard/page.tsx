"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    // Petite tempo pour laisser le hydrate
    const t = setTimeout(() => {
      const token = typeof window !== "undefined" ? localStorage.getItem("lbp_token") : null;
      if (!token) {
        router.replace("/login");
      }
    }, 100);
    return () => clearTimeout(t);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              LBP
            </div>
            <div>
              <h1 className="text-lg font-semibold">Les Bons Plombiers</h1>
              <p className="text-xs text-muted-foreground">Espace pro</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Bonjour, {user.name} 👋</CardTitle>
            <CardDescription>
              Tu es connecté en tant que <strong>{user.role}</strong> ({user.email})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Interventions</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Signatures</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-2xl font-bold text-success">OK</div>
                <div className="text-xs text-muted-foreground">API</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground pt-4">
              Le dashboard sera enrichi dans les prochaines étapes (liste interventions, calendrier, documents...).
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
