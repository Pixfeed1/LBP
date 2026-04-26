"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Save, Loader2, X, RotateCcw, Check, MessageSquare, PenLine,
  FileText, Mail, RefreshCw, Bell, Cloud, Users, MapPin, Settings as SettingsIcon,
  ChevronRight, ChevronLeft, Send,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { SettingItem } from "@/types/setting";

// ============================================================
// Types & Constants
// ============================================================

type SectionId = "signature" | "templates" | "notifs";

interface NavItem {
  id: SectionId | "placeholder";
  label: string;
  icon: React.ReactNode;
  group: string;
  badge?: number;
  available: boolean;
  placeholderKey?: string;
  mobileSubtitle?: string;
}

// ============================================================
// Page principale
// ============================================================

export default function ConfigurationPage() {
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<SectionId>("signature");
  const [mobileSubpage, setMobileSubpage] = useState<SectionId | null>(null);
  const [settings, setSettings] = useState<Record<string, SettingItem>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const loadSettings = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (user) loadSettings();
  }, [user, loadSettings]);

  if (!user) return null;

  const setDraft = (key: string, value: string) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  };

  const dirtyKeysAll = Object.keys(drafts).filter(
    (k) => drafts[k] !== settings[k]?.value
  );

  const cancelChanges = () => {
    const reset: Record<string, string> = {};
    for (const [key, item] of Object.entries(settings)) {
      reset[key] = item.value;
    }
    setDrafts(reset);
  };

  const handleSave = async () => {
    if (dirtyKeysAll.length === 0) return;
    setSaving(true);
    try {
      const changes: Record<string, string> = {};
      for (const k of dirtyKeysAll) changes[k] = drafts[k];

      await api.put("/api/settings", { settings: changes });
      await loadSettings();
      setSavedAt(new Date());
    } catch (err) {
      console.error("Erreur save:", err);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Cmd+S / Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirtyKeysAll.length > 0 && isAdmin) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, settings, isAdmin]);

  // Calcule les sous-titres mobile en fonction des valeurs actuelles
  const provider = drafts["signature.default_provider"] ?? "maison";
  const tokenDays = drafts["signature.token_validity_days"] ?? "30";
  const enabledTemplatesCount = [
    "sms.template_initial_enabled",
    "sms.template_rappel_j1_enabled",
    "sms.template_relance_enabled",
    "sms.template_deplacement_enabled",
    "sms.template_annulation_enabled",
  ].filter((k) => drafts[k] === "true").length;
  const adminEmails = (drafts["notif.admin_emails"] ?? "").split(",").filter(Boolean).length;

  const NAV_ITEMS: NavItem[] = [
    {
      id: "signature",
      label: "Signature électronique",
      icon: <PenLine className="h-3.5 w-3.5" />,
      group: "Signature",
      available: true,
      mobileSubtitle: `${provider === "maison" ? "Maison" : "Yousign"} · ${tokenDays} jours`,
    },
    { id: "placeholder", label: "Documents (PDF)", icon: <FileText className="h-3.5 w-3.5" />, group: "Signature", available: false, placeholderKey: "docs", mobileSubtitle: "3 templates" },
    {
      id: "templates",
      label: "Templates SMS",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      group: "Communication",
      available: true,
      badge: 5,
      mobileSubtitle: `${enabledTemplatesCount} template${enabledTemplatesCount > 1 ? "s" : ""} actif${enabledTemplatesCount > 1 ? "s" : ""}`,
    },
    { id: "placeholder", label: "Email SMTP", icon: <Mail className="h-3.5 w-3.5" />, group: "Communication", available: false, placeholderKey: "smtp", mobileSubtitle: "Non configuré" },
    { id: "placeholder", label: "Relances", icon: <RefreshCw className="h-3.5 w-3.5" />, group: "Communication", available: false, placeholderKey: "relances", mobileSubtitle: "3 max · 48h espacé" },
    {
      id: "notifs",
      label: "Notifications",
      icon: <Bell className="h-3.5 w-3.5" />,
      group: "Système",
      available: true,
      mobileSubtitle: `${adminEmails} destinataire${adminEmails > 1 ? "s" : ""}`,
    },
    { id: "placeholder", label: "Archivage Drive", icon: <Cloud className="h-3.5 w-3.5" />, group: "Système", available: false, placeholderKey: "archive", mobileSubtitle: "Désactivé" },
    { id: "placeholder", label: "Équipe", icon: <Users className="h-3.5 w-3.5" />, group: "Système", available: false, placeholderKey: "team", badge: 3, mobileSubtitle: "3 membres" },
    { id: "placeholder", label: "Coordonnées entreprise", icon: <MapPin className="h-3.5 w-3.5" />, group: "Système", available: false, placeholderKey: "company", mobileSubtitle: "Les Bons Plombiers" },
  ];

  const groupedNav: Record<string, NavItem[]> = {};
  for (const item of NAV_ITEMS) {
    if (!groupedNav[item.group]) groupedNav[item.group] = [];
    groupedNav[item.group].push(item);
  }

  // Detect mobile sub-page name pour topbar
  const activeNavItem = NAV_ITEMS.find((n) => n.id === mobileSubpage);

  return (
    <>
      <Topbar breadcrumb="Configuration" />

      {/* ===========================================
           MOBILE VIEW (< md) — iOS Settings drill-down
           =========================================== */}
      <div className="md:hidden flex-1 pb-24">
        {/* Mobile sub-page : sticky topbar avec retour */}
        {mobileSubpage && (
          <div className="sticky top-0 z-30 bg-white border-b border-border px-3 py-2.5 flex items-center justify-between gap-2">
            <button
              onClick={() => setMobileSubpage(null)}
              className="flex items-center gap-1 text-sm text-primary px-2 py-1 -ml-2 rounded-md hover:bg-primary/5 active:bg-primary/10"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              <span>Configuration</span>
            </button>
            <div className="text-sm font-semibold absolute left-1/2 -translate-x-1/2 truncate max-w-[60%]">
              {activeNavItem?.label}
            </div>
            <div className="w-12" /> {/* spacer for symetry */}
          </div>
        )}

        {!mobileSubpage ? (
          // === Mobile : Liste des sections (style iOS Settings) ===
          <main className="px-4 py-4">
            <h1 className="text-2xl font-semibold mb-1">Configuration</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Paramétrage du workflow et des notifications
            </p>

            {!isAdmin && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                ⚠️ Mode lecture seule — seuls les administrateurs peuvent modifier.
              </div>
            )}

            {Object.entries(groupedNav).map(([groupName, items]) => (
              <div key={groupName} className="mb-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pb-1.5">
                  {groupName}
                </div>
                <div className="bg-white border border-border rounded-lg overflow-hidden">
                  {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                      <button
                        key={`${groupName}-${idx}`}
                        onClick={() => {
                          if (item.available) setMobileSubpage(item.id as SectionId);
                        }}
                        disabled={!item.available}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                          !isLast ? "border-b border-border/50" : ""
                        } ${
                          item.available
                            ? "hover:bg-muted/30 active:bg-muted/50"
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        style={{ minHeight: "52px" }} // tactile 44px iOS norm
                      >
                        <span className="text-primary [&>svg]:h-4 [&>svg]:w-4 flex-shrink-0">
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.label}</div>
                          {item.mobileSubtitle && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.mobileSubtitle}
                            </div>
                          )}
                        </div>
                        {item.badge !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                            {item.badge}
                          </span>
                        )}
                        {!item.available && (
                          <span className="text-[10px] text-muted-foreground/70 italic">bientôt</span>
                        )}
                        {item.available && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </main>
        ) : (
          // === Mobile : Section ouverte ===
          <main className="px-3 py-3">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : mobileSubpage === "signature" ? (
              <SignatureSectionMobile drafts={drafts} settings={settings} setDraft={setDraft} isAdmin={isAdmin} />
            ) : mobileSubpage === "templates" ? (
              <TemplatesSMSSectionMobile drafts={drafts} settings={settings} setDraft={setDraft} isAdmin={isAdmin} />
            ) : mobileSubpage === "notifs" ? (
              <ComingSoonPlaceholder title="Notifications & archivage" desc="Section disponible dans le prochain commit" icon={<Bell />} />
            ) : null}
          </main>
        )}
      </div>

      {/* ===========================================
           DESKTOP VIEW (>= md) — sidebar + content
           =========================================== */}
      <main className="hidden md:block flex-1 px-5 py-5 max-w-[1300px] w-full mx-auto pb-24">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paramétrage du workflow de signature, des notifications et de l&apos;archivage
          </p>
          {!isAdmin && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              ⚠️ Mode lecture seule — seuls les administrateurs peuvent modifier la configuration.
            </div>
          )}
        </div>

        <div className="grid grid-cols-[240px_1fr] gap-5">
          <aside className="space-y-1">
            {Object.entries(groupedNav).map(([groupName, items]) => (
              <div key={groupName} className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 py-1.5">
                  {groupName}
                </div>
                {items.map((item, idx) => {
                  const isActive = item.available && activeSection === item.id;
                  return (
                    <button
                      key={`${groupName}-${idx}`}
                      onClick={() => {
                        if (item.available) setActiveSection(item.id as SectionId);
                      }}
                      disabled={!item.available}
                      className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : !item.available
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {!item.available && (
                        <span className="text-[10px] text-muted-foreground/60 italic">bientôt</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <div className="bg-white border border-border rounded-lg min-h-[500px]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeSection === "signature" ? (
              <SignatureSection drafts={drafts} settings={settings} setDraft={setDraft} isAdmin={isAdmin} />
            ) : activeSection === "templates" ? (
              <TemplatesSMSSection drafts={drafts} settings={settings} setDraft={setDraft} isAdmin={isAdmin} />
            ) : activeSection === "notifs" ? (
              <ComingSoonPlaceholder title="Notifications & archivage" desc="Section disponible dans le prochain commit (5c)" icon={<Bell />} />
            ) : null}
          </div>
        </div>
      </main>

      {/* Save bar (desktop + mobile) */}
      {(dirtyKeysAll.length > 0 || savedAt) && (
        <div className="fixed bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[1100px] w-[calc(100%-1.5rem)] md:w-full px-2 md:px-4">
          <div className="bg-white border border-border rounded-lg shadow-xl px-3 md:px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs min-w-0">
              {dirtyKeysAll.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span className="hidden sm:inline">{dirtyKeysAll.length} modification{dirtyKeysAll.length > 1 ? "s" : ""} non sauvegardée{dirtyKeysAll.length > 1 ? "s" : ""}</span>
                  <span className="sm:hidden">{dirtyKeysAll.length} modif</span>
                </span>
              ) : savedAt ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Sauvegardé à {savedAt.toLocaleTimeString("fr-FR")}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {dirtyKeysAll.length > 0 && (
                <button
                  onClick={cancelChanges}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!isAdmin || dirtyKeysAll.length === 0 || saving}
                className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Enregistrer
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1 py-0 text-[9px] bg-white/20 rounded">⌘S</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Section : SIGNATURE (Desktop)
// ============================================================

function SignatureSection({
  drafts, settings, setDraft, isAdmin,
}: {
  drafts: Record<string, string>;
  settings: Record<string, SettingItem>;
  setDraft: (key: string, value: string) => void;
  isAdmin: boolean;
}) {
  const provider = drafts["signature.default_provider"] ?? "maison";
  const tokenDays = drafts["signature.token_validity_days"] ?? "30";
  const legalMention = drafts["signature.legal_mention"] ?? "";
  const singleUseToken = drafts["signature.single_use_token"] === "true";
  const requireHandwritten = drafts["signature.require_handwritten_mention"] === "true";
  const logementDefault = drafts["pv.default_logement_2_ans"] ?? "plus_de_2_ans";
  const travauxConformes = drafts["pv.default_travaux_conformes"] === "true";

  return (
    <div>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Signature électronique</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Choisissez votre provider de signature et configurez les paramètres légaux. Le switch entre maison et Yousign est instantané : aucune migration de données nécessaire.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${
          provider === "maison" ? "bg-primary/5 text-primary border-primary/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${provider === "maison" ? "bg-primary" : "bg-emerald-500"}`}></span>
          Mode {provider === "maison" ? "Maison" : "Yousign"} actif
        </span>
      </div>

      <ConfigGroup title="Provider de signature" desc='Le mode "Maison" est gratuit et inclus. Yousign offre un niveau de preuve renforcé (eIDAS simple) pour ~1€ / signature.'>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <ProviderCard name="Maison" desc="Signature électronique simple, gratuite, intégrée à l'outil." features={["Canvas + horodatage UTC", "Hash SHA-256 + IP + user-agent", "Cartouche de preuve incrusté", "Aucun coût par signature"]} selected={provider === "maison"} disabled={!isAdmin} onSelect={() => setDraft("signature.default_provider", "maison")} />
          <ProviderCard name="Yousign" desc="Signature qualifiée avec preuves légales renforcées eIDAS." features={["Conforme eIDAS (Niveau Simple)", "Preuves d'archivage 10 ans", "Vérification SMS OTP", "~1 € par signature"]} selected={provider === "yousign"} disabled={!isAdmin} onSelect={() => setDraft("signature.default_provider", "yousign")} />
        </div>
      </ConfigGroup>

      <ConfigGroup title="Paramètres du lien de signature">
        <SettingRow label="Durée de validité du lien" help='Combien de temps après son envoi le lien reste utilisable. Au-delà, le client doit cliquer sur "Demander un nouveau lien".'>
          <InputWithSuffix value={tokenDays} onChange={(v) => setDraft("signature.token_validity_days", v)} disabled={!isAdmin} suffix="jours" type="number" min="1" max="365" className="w-32" />
        </SettingRow>
        <SettingRow label="Mention de signature obligatoire" help="La phrase que le client doit voir avant de signer. Apparaît dans le cartouche de preuve.">
          <input type="text" value={legalMention} onChange={(e) => setDraft("signature.legal_mention", e.target.value)} disabled={!isAdmin} className="w-72 px-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
        </SettingRow>
        <SettingRow label="Renvoyer un lien à usage unique" help="Chaque token est invalidé après une signature. Recommandé pour la sécurité.">
          <Toggle checked={singleUseToken} onChange={(v) => setDraft("signature.single_use_token", v ? "true" : "false")} disabled={!isAdmin} />
        </SettingRow>
        <SettingRow label="Demander la mention manuscrite" help='Le client doit retaper "Bon pour accord" en plus de signer. Plus de friction mais preuve renforcée.'>
          <Toggle checked={requireHandwritten} onChange={(v) => setDraft("signature.require_handwritten_mention", v ? "true" : "false")} disabled={!isAdmin} />
        </SettingRow>
      </ConfigGroup>

      <ConfigGroup title="Procès-verbal · valeurs par défaut" desc="Pré-remplissages automatiques pour le PV de réception. Modifiable par intervention si besoin." last>
        <SettingRow label="Ancienneté du logement par défaut" help="Coche automatiquement la case correspondante du PV. Affecte le calcul de TVA.">
          <select value={logementDefault} onChange={(e) => setDraft("pv.default_logement_2_ans", e.target.value)} disabled={!isAdmin} className="px-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 min-w-[200px]">
            <option value="plus_de_2_ans">Plus de 2 ans</option>
            <option value="moins_de_2_ans">Moins de 2 ans</option>
            <option value="ask_each">Demander à chaque intervention</option>
          </select>
        </SettingRow>
        <SettingRow label="Cocher 'Travaux conformes' par défaut" help="Le client peut décocher s'il y a réserve. Évite l'oubli côté client.">
          <Toggle checked={travauxConformes} onChange={(v) => setDraft("pv.default_travaux_conformes", v ? "true" : "false")} disabled={!isAdmin} />
        </SettingRow>
      </ConfigGroup>
    </div>
  );
}

// ============================================================
// Section : SIGNATURE (Mobile - iOS Settings style)
// ============================================================

function SignatureSectionMobile({
  drafts, settings, setDraft, isAdmin,
}: {
  drafts: Record<string, string>;
  settings: Record<string, SettingItem>;
  setDraft: (key: string, value: string) => void;
  isAdmin: boolean;
}) {
  const provider = drafts["signature.default_provider"] ?? "maison";
  const tokenDays = drafts["signature.token_validity_days"] ?? "30";
  const legalMention = drafts["signature.legal_mention"] ?? "";
  const singleUseToken = drafts["signature.single_use_token"] === "true";
  const requireHandwritten = drafts["signature.require_handwritten_mention"] === "true";
  const logementDefault = drafts["pv.default_logement_2_ans"] ?? "plus_de_2_ans";
  const travauxConformes = drafts["pv.default_travaux_conformes"] === "true";

  return (
    <div className="space-y-4">
      {/* Provider */}
      <MobileGroup title="Provider de signature">
        <div className="space-y-2">
          <MobileProviderRow name="Maison" desc="Gratuit · Canvas + horodatage" selected={provider === "maison"} disabled={!isAdmin} onSelect={() => setDraft("signature.default_provider", "maison")} />
          <MobileProviderRow name="Yousign" desc="~1€/signature · eIDAS Simple" selected={provider === "yousign"} disabled={!isAdmin} onSelect={() => setDraft("signature.default_provider", "yousign")} />
        </div>
      </MobileGroup>

      {/* Paramètres lien */}
      <MobileGroup title="Paramètres du lien">
        <MobileSettingRow label="Durée de validité" help={`${tokenDays} jours`}>
          <InputWithSuffix value={tokenDays} onChange={(v) => setDraft("signature.token_validity_days", v)} disabled={!isAdmin} suffix="j" type="number" min="1" max="365" className="w-20" />
        </MobileSettingRow>
        <MobileSettingRow label="Mention de signature">
          <input type="text" value={legalMention} onChange={(e) => setDraft("signature.legal_mention", e.target.value)} disabled={!isAdmin} className="w-full max-w-[160px] px-2 py-1 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 text-right" />
        </MobileSettingRow>
        <MobileSettingRow label="Lien à usage unique" help="Recommandé">
          <Toggle checked={singleUseToken} onChange={(v) => setDraft("signature.single_use_token", v ? "true" : "false")} disabled={!isAdmin} />
        </MobileSettingRow>
        <MobileSettingRow label="Mention manuscrite" help="Preuve renforcée">
          <Toggle checked={requireHandwritten} onChange={(v) => setDraft("signature.require_handwritten_mention", v ? "true" : "false")} disabled={!isAdmin} />
        </MobileSettingRow>
      </MobileGroup>

      {/* PV defaults */}
      <MobileGroup title="Procès-verbal" desc="Valeurs par défaut">
        <MobileSettingRow label="Ancienneté logement">
          <select value={logementDefault} onChange={(e) => setDraft("pv.default_logement_2_ans", e.target.value)} disabled={!isAdmin} className="text-xs px-2 py-1 border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
            <option value="plus_de_2_ans">+ 2 ans</option>
            <option value="moins_de_2_ans">- 2 ans</option>
            <option value="ask_each">Au cas par cas</option>
          </select>
        </MobileSettingRow>
        <MobileSettingRow label="Travaux conformes" help="Coché par défaut">
          <Toggle checked={travauxConformes} onChange={(v) => setDraft("pv.default_travaux_conformes", v ? "true" : "false")} disabled={!isAdmin} />
        </MobileSettingRow>
      </MobileGroup>
    </div>
  );
}

// ============================================================
// Section : TEMPLATES SMS (Desktop & Mobile)
// ============================================================

interface SmsTemplate {
  key: string;
  enabledKey: string;
  name: string;
  context: string;
  variables: string[];
  defaultPreviewValues: Record<string, string>;
}

const SMS_TEMPLATES: SmsTemplate[] = [
  {
    key: "sms.template_initial",
    enabledKey: "sms.template_initial_enabled",
    name: "SMS initial",
    context: "Envoyé à la création du RDV",
    variables: ["{prenom}", "{nom}", "{date}", "{heure}", "{lien}"],
    defaultPreviewValues: { "{prenom}": "Jean", "{nom}": "Dupont", "{date}": "lundi 28 avril", "{heure}": "15h", "{lien}": "https://lbp.fr/s/abc123" },
  },
  {
    key: "sms.template_rappel_j1",
    enabledKey: "sms.template_rappel_j1_enabled",
    name: "Rappel J-1",
    context: "Envoyé la veille à 18h",
    variables: ["{prenom}", "{date}", "{heure}", "{lien}"],
    defaultPreviewValues: { "{prenom}": "Jean", "{date}": "demain", "{heure}": "15h", "{lien}": "https://lbp.fr/s/abc123" },
  },
  {
    key: "sms.template_relance",
    enabledKey: "sms.template_relance_enabled",
    name: "Relance signature",
    context: "Envoyée si pas signé après 48h",
    variables: ["{prenom}", "{date}", "{nb_docs}", "{lien}"],
    defaultPreviewValues: { "{prenom}": "Jean", "{date}": "26 avril", "{nb_docs}": "2", "{lien}": "https://lbp.fr/s/abc123" },
  },
  {
    key: "sms.template_deplacement",
    enabledKey: "sms.template_deplacement_enabled",
    name: "Déplacement de RDV",
    context: "Envoyé après modification du RDV",
    variables: ["{prenom}", "{date}", "{heure}", "{motif}", "{lien}"],
    defaultPreviewValues: { "{prenom}": "Jean", "{date}": "mardi 29 avril", "{heure}": "14h", "{motif}": "indispo technicien", "{lien}": "https://lbp.fr/s/abc123" },
  },
  {
    key: "sms.template_annulation",
    enabledKey: "sms.template_annulation_enabled",
    name: "Annulation",
    context: "Envoyé après annulation",
    variables: ["{prenom}", "{date}"],
    defaultPreviewValues: { "{prenom}": "Jean", "{date}": "lundi 28 avril" },
  },
];

function renderPreview(template: string, values: Record<string, string>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\{[a-z_]+\})/g;
  const tokens = template.split(regex);
  let key = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (regex.test(token) && values[token]) {
      parts.push(<mark key={key++} className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-medium not-italic">{values[token]}</mark>);
    } else {
      parts.push(<span key={key++}>{token}</span>);
    }
    regex.lastIndex = 0;
  }
  return parts;
}

function TemplatesSMSSection({
  drafts, settings, setDraft, isAdmin,
}: {
  drafts: Record<string, string>;
  settings: Record<string, SettingItem>;
  setDraft: (key: string, value: string) => void;
  isAdmin: boolean;
}) {
  const restoreDefaults = () => {
    if (!isAdmin) return;
    if (!confirm("Restaurer les 5 templates par défaut ? Les modifications non sauvegardées seront perdues.")) return;
    for (const tpl of SMS_TEMPLATES) {
      const original = settings[tpl.key]?.value ?? "";
      setDraft(tpl.key, original);
    }
  };

  return (
    <div>
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Templates SMS</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Personnalisez chaque message envoyé au client. Cliquez sur une variable pour l&apos;insérer à la position du curseur.
          </p>
        </div>
        <button type="button" onClick={restoreDefaults} disabled={!isAdmin} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md bg-white hover:bg-muted/50 transition-colors disabled:opacity-50 whitespace-nowrap">
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurer
        </button>
      </div>

      <div className="p-6 space-y-4">
        {SMS_TEMPLATES.map((tpl) => (
          <TemplateCard key={tpl.key} template={tpl} value={drafts[tpl.key] ?? ""} enabled={drafts[tpl.enabledKey] === "true"} onChangeValue={(v) => setDraft(tpl.key, v)} onChangeEnabled={(v) => setDraft(tpl.enabledKey, v ? "true" : "false")} disabled={!isAdmin} />
        ))}
      </div>
    </div>
  );
}

function TemplatesSMSSectionMobile({
  drafts, settings, setDraft, isAdmin,
}: {
  drafts: Record<string, string>;
  settings: Record<string, SettingItem>;
  setDraft: (key: string, value: string) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-3">
      {SMS_TEMPLATES.map((tpl) => (
        <TemplateCardMobile
          key={tpl.key}
          template={tpl}
          value={drafts[tpl.key] ?? ""}
          enabled={drafts[tpl.enabledKey] === "true"}
          onChangeValue={(v) => setDraft(tpl.key, v)}
          onChangeEnabled={(v) => setDraft(tpl.enabledKey, v ? "true" : "false")}
          disabled={!isAdmin}
        />
      ))}
      <button
        type="button"
        disabled={!isAdmin}
        onClick={() => alert("Test SMS - à implémenter avec config Twilio")}
        className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-3 text-sm border border-border rounded-lg bg-white hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        Tester avec mon numéro
      </button>
    </div>
  );
}

function TemplateCard({
  template, value, enabled, onChangeValue, onChangeEnabled, disabled,
}: {
  template: SmsTemplate;
  value: string;
  enabled: boolean;
  onChangeValue: (v: string) => void;
  onChangeEnabled: (v: boolean) => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const segmentCount = Math.max(1, Math.ceil(charCount / 160));
  const isOver160 = charCount > 160;
  const previewNodes = renderPreview(value, template.defaultPreviewValues);

  const insertVariable = (variable: string) => {
    if (disabled) return;
    const ta = textareaRef.current;
    if (!ta) {
      onChangeValue(value + variable);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    onChangeValue(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + variable.length;
      ta.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-sm font-semibold truncate">{template.name}</div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted/40 text-muted-foreground border-border"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}></span>
            {enabled ? "Actif" : "Désactivé"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{template.context}</span>
          <Toggle checked={enabled} onChange={onChangeEnabled} disabled={disabled} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <textarea ref={textareaRef} value={value} onChange={(e) => onChangeValue(e.target.value)} disabled={disabled} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 resize-y" />

        <div className="bg-emerald-50/50 border border-emerald-200 rounded-md p-3 flex items-start gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider mb-1">Preview · ce que le client recevra</div>
            <div className="text-sm text-emerald-950 leading-relaxed break-words">{previewNodes}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Variables :</span>
          {template.variables.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} disabled={disabled} className="px-1.5 py-0.5 text-[11px] font-mono bg-white border border-border rounded hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{v}</button>
          ))}
        </div>
        <span className={`text-[11px] font-mono whitespace-nowrap ${isOver160 ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
          <strong>{charCount}</strong> / 160 caractères · {segmentCount} SMS
        </span>
      </div>
    </div>
  );
}

function TemplateCardMobile({
  template, value, enabled, onChangeValue, onChangeEnabled, disabled,
}: {
  template: SmsTemplate;
  value: string;
  enabled: boolean;
  onChangeValue: (v: string) => void;
  onChangeEnabled: (v: boolean) => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const segmentCount = Math.max(1, Math.ceil(charCount / 160));
  const isOver160 = charCount > 160;
  const previewNodes = renderPreview(value, template.defaultPreviewValues);

  const insertVariable = (variable: string) => {
    if (disabled) return;
    const ta = textareaRef.current;
    if (!ta) {
      onChangeValue(value + variable);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    onChangeValue(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + variable.length;
      ta.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{template.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{template.context}</div>
        </div>
        <Toggle checked={enabled} onChange={onChangeEnabled} disabled={disabled} />
      </div>

      <div className="p-3 space-y-2">
        <textarea ref={textareaRef} value={value} onChange={(e) => onChangeValue(e.target.value)} disabled={disabled} rows={4} className="w-full px-2.5 py-2 text-xs border border-border rounded-md bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 resize-y" />

        <div className="flex flex-wrap gap-1">
          {template.variables.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} disabled={disabled} className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-border rounded hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-50 active:bg-primary/10">{v}</button>
          ))}
        </div>

        <div className="bg-muted/40 rounded-md p-2.5">
          <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Aperçu</div>
          <div className="text-xs leading-relaxed break-words">{previewNodes}</div>
        </div>

        <div className={`text-right text-[10px] font-mono ${isOver160 ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
          <strong>{charCount}</strong> / 160 · {segmentCount} SMS
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Composants UI partagés
// ============================================================

function ConfigGroup({ title, desc, children, last = false }: { title: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "px-6 py-5" : "px-6 py-5 border-b border-border"}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{desc}</p>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {help && <div className="text-xs text-muted-foreground mt-0.5 max-w-xl">{help}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// === Mobile-specific ===
function MobileGroup({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pb-1.5 pt-1">
        {title}
      </div>
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {children}
      </div>
      {desc && <div className="text-[10px] text-muted-foreground/70 px-3 mt-1.5">{desc}</div>}
    </div>
  );
}

function MobileSettingRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border/50 last:border-0 min-h-[48px]">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {help && <div className="text-[10px] text-muted-foreground truncate">{help}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function MobileProviderRow({ name, desc, selected, disabled, onSelect }: { name: string; desc: string; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors disabled:opacity-50 min-h-[52px] ${
        selected ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/30 active:bg-muted/50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${selected ? "text-primary" : ""}`}>{name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{desc}</div>
      </div>
      {selected && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary flex-shrink-0">
          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

// === Shared ===
function ProviderCard({ name, desc, features, selected, disabled, onSelect }: { name: string; desc: string; features: string[]; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onSelect} className={`text-left p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${selected ? "border-primary bg-primary/[0.02] ring-2 ring-primary/10" : "border-border hover:border-primary/40 bg-white"}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-base font-semibold">{name}</div>
        {selected && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">{desc}</p>
      <div className="space-y-1.5">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Check className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <span className="text-foreground/80">{f}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function InputWithSuffix({ value, onChange, suffix, disabled, className, type = "text", min, max }: { value: string; onChange: (v: string) => void; suffix: string; disabled?: boolean; className?: string; type?: string; min?: string; max?: string }) {
  return (
    <div className={`inline-flex items-center border border-border rounded-md bg-white overflow-hidden ${className ?? ""}`}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} min={min} max={max} className="flex-1 px-2 py-1.5 text-sm bg-transparent focus:outline-none disabled:opacity-50 min-w-0" />
      <span className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/30 border-l border-border whitespace-nowrap">{suffix}</span>
    </div>
  );
}

function ComingSoonPlaceholder({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-muted-foreground/40 mb-4 [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{desc}</p>
    </div>
  );
}
