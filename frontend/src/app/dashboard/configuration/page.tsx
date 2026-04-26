"use client";

import { useEffect, useState } from "react";
import {
  Save, Loader2, Settings as SettingsIcon, PenLine, MessageSquare,
  Bell, Cloud, ChevronRight,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { SettingItem } from "@/types/setting";

type SectionId = "signature" | "sms" | "notif" | "archive";

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "signature",
    label: "Signature",
    icon: <PenLine className="h-4 w-4" />,
    description: "Provider, durée du token, mention juridique",
  },
  {
    id: "sms",
    label: "Templates SMS",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Modèles d'envoi initial, relance, rappel RDV",
  },
  {
    id: "notif",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    description: "Emails admin, récap quotidien",
  },
  {
    id: "archive",
    label: "Archivage",
    icon: <Cloud className="h-4 w-4" />,
    description: "Sauvegarde Google Drive",
  },
];

export default function ConfigurationPage() {
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<SectionId>("signature");
  const [settings, setSettings] = useState<Record<string, SettingItem>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<SettingItem[]>("/api/settings");
        const map: Record<string, SettingItem> = {};
        const draft: Record<string, string> = {};
        for (const s of res.data) {
          map[s.key] = s;
          draft[s.key] = s.value;
        }
        setSettings(map);
        setDrafts(draft);
      } catch (err) {
        console.error("Erreur chargement settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) return null;

  const setDraft = (key: string, value: string) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  };

  const hasChanges = () => {
    return Object.keys(drafts).some((k) => drafts[k] !== settings[k]?.value);
  };

  const handleSave = async (sectionPrefix: string) => {
    setSaving(true);
    try {
      // Ne push que les changements de la section
      const changes: Record<string, string> = {};
      for (const [key, value] of Object.entries(drafts)) {
        if (key.startsWith(sectionPrefix) && value !== settings[key]?.value) {
          changes[key] = value;
        }
      }

      if (Object.keys(changes).length === 0) return;

      await api.put("/api/settings", { settings: changes });

      // Recharger
      const res = await api.get<SettingItem[]>("/api/settings");
      const map: Record<string, SettingItem> = {};
      for (const s of res.data) map[s.key] = s;
      setSettings(map);
      setSavedAt(new Date());
    } catch (err) {
      console.error("Erreur save:", err);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar breadcrumb="Configuration" />

      <main className="flex-1 px-5 py-5 max-w-[1200px] w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paramétrage du workflow de signature et des notifications
          </p>
          {!isAdmin && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              ⚠️ Mode lecture seule — seuls les administrateurs peuvent modifier la configuration.
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-[260px_1fr] gap-5">
          {/* Sidebar des sections */}
          <aside className="space-y-1">
            {SECTIONS.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-start gap-2.5 ${
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className={isActive ? "text-primary" : "text-muted-foreground"}>
                    {sec.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{sec.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {sec.description}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5" />}
                </button>
              );
            })}
          </aside>

          {/* Contenu */}
          <div className="bg-white border border-border rounded-lg p-6 min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {activeSection === "signature" && (
                  <SignatureSection
                    drafts={drafts}
                    settings={settings}
                    setDraft={setDraft}
                    isAdmin={isAdmin}
                    onSave={() => handleSave("signature.")}
                    saving={saving}
                    hasChanges={hasChanges()}
                  />
                )}
                {activeSection === "sms" && (
                  <PlaceholderSection title="Templates SMS" icon={<MessageSquare className="h-5 w-5" />} />
                )}
                {activeSection === "notif" && (
                  <PlaceholderSection title="Notifications" icon={<Bell className="h-5 w-5" />} />
                )}
                {activeSection === "archive" && (
                  <PlaceholderSection title="Archivage" icon={<Cloud className="h-5 w-5" />} />
                )}
              </>
            )}
          </div>
        </div>

        {savedAt && (
          <div className="fixed bottom-5 right-5 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-900 shadow-lg">
            ✅ Sauvegardé à {savedAt.toLocaleTimeString("fr-FR")}
          </div>
        )}
      </main>
    </>
  );
}

// ============================================================
// SECTION : SIGNATURE
// ============================================================

function SignatureSection({
  drafts,
  settings,
  setDraft,
  isAdmin,
  onSave,
  saving,
  hasChanges,
}: {
  drafts: Record<string, string>;
  settings: Record<string, SettingItem>;
  setDraft: (key: string, value: string) => void;
  isAdmin: boolean;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}) {
  const provider = drafts["signature.default_provider"] ?? "maison";
  const tokenHours = drafts["signature.token_validity_hours"] ?? "168";
  const consentText = drafts["signature.consent_text"] ?? "lu et approuvé";
  const logementDefault = drafts["signature.logement_default_2_ans"] ?? "Y";

  const sectionChanged = Object.keys(drafts)
    .filter((k) => k.startsWith("signature."))
    .some((k) => drafts[k] !== settings[k]?.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <PenLine className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Signature électronique</h2>
      </div>

      {/* Provider */}
      <div className="space-y-2">
        <label className="block">
          <div className="text-sm font-medium mb-1">Provider de signature</div>
          <p className="text-xs text-muted-foreground mb-2">
            Détermine le flow utilisé après envoi du SMS au client.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDraft("signature.default_provider", "maison")}
              className={`p-3 rounded-lg border-2 text-left transition-colors disabled:opacity-50 ${
                provider === "maison"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-semibold">🏠 Maison</div>
              <div className="text-xs text-muted-foreground mt-1">
                Page web LBP avec canvas + horodatage + IP
              </div>
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDraft("signature.default_provider", "yousign")}
              className={`p-3 rounded-lg border-2 text-left transition-colors disabled:opacity-50 ${
                provider === "yousign"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-semibold">📝 Yousign</div>
              <div className="text-xs text-muted-foreground mt-1">
                API Yousign (eIDAS, certificat qualifié)
              </div>
            </button>
          </div>
        </label>
      </div>

      {/* Durée validité token */}
      <div className="space-y-2 max-w-md">
        <label className="block">
          <div className="text-sm font-medium mb-1">Durée de validité du lien</div>
          <p className="text-xs text-muted-foreground mb-2">
            Après ce délai, le client devra demander un nouveau lien.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="720"
              disabled={!isAdmin}
              value={tokenHours}
              onChange={(e) => setDraft("signature.token_validity_hours", e.target.value)}
              className="w-24 px-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">
              heures ({Math.round((parseInt(tokenHours, 10) || 0) / 24)} jours)
            </span>
          </div>
        </label>
      </div>

      {/* Mention manuscrite */}
      <div className="space-y-2 max-w-md">
        <label className="block">
          <div className="text-sm font-medium mb-1">Mention manuscrite obligatoire</div>
          <p className="text-xs text-muted-foreground mb-2">
            Le client doit retaper exactement cette phrase au-dessus de sa signature.
          </p>
          <input
            type="text"
            disabled={!isAdmin}
            value={consentText}
            onChange={(e) => setDraft("signature.consent_text", e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </label>
      </div>

      {/* Logement +2 ans par défaut */}
      <div className="space-y-2">
        <label className="block">
          <div className="text-sm font-medium mb-1">Ancienneté logement par défaut</div>
          <p className="text-xs text-muted-foreground mb-2">
            Pour la TVA réduite (10% sur logements de plus de 2 ans).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDraft("signature.logement_default_2_ans", "Y")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-50 ${
                logementDefault === "Y"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-border hover:bg-muted/40"
              }`}
            >
              Plus de 2 ans (TVA 10%)
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setDraft("signature.logement_default_2_ans", "N")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-50 ${
                logementDefault === "N"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-border hover:bg-muted/40"
              }`}
            >
              Moins de 2 ans (TVA 20%)
            </button>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sectionChanged ? "⚠️ Modifications non enregistrées" : "Aucune modification"}
        </p>
        <button
          onClick={onSave}
          disabled={!isAdmin || !sectionChanged || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function PlaceholderSection({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <div className="text-primary">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="py-12 text-center">
        <SettingsIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Section en cours de développement</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Disponible dans le prochain commit
        </p>
      </div>
    </div>
  );
}
