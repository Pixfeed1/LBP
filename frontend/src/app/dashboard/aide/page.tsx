"use client";

import { useState } from "react";
import {
  Rocket, HelpCircle, Mail, ChevronRight, ChevronLeft, ChevronDown,
  FileSignature, CalendarSync, MessageSquare, Bell, Users, Settings as SettingsIcon,
  Sparkles, Clock, Shield, ExternalLink, BookOpen, Phone,
  Plus, Send, FileText, CheckCircle2, AlertTriangle, Search,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";

// ============================================================
// Types & Constants
// ============================================================

type SectionId = "demarrage" | "faq" | "contact";

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  group: string;
  mobileSubtitle?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "demarrage",
    label: "Démarrage rapide",
    icon: <Rocket className="h-3.5 w-3.5" />,
    group: "Premiers pas",
    mobileSubtitle: "6 étapes pour bien commencer",
  },
  {
    id: "faq",
    label: "Foire aux questions",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    group: "Documentation",
    mobileSubtitle: "Réponses aux questions fréquentes",
  },
  {
    id: "contact",
    label: "Contacter le support",
    icon: <Mail className="h-3.5 w-3.5" />,
    group: "Aide",
    mobileSubtitle: "Une question ? On vous répond",
  },
];

// ============================================================
// Données : Démarrage rapide
// ============================================================

const QUICK_START_STEPS = [
  {
    icon: <Plus className="h-4 w-4" />,
    title: "Créer votre première intervention",
    content: "Cliquez sur \"+ Nouvelle intervention\" en haut à droite du tableau de bord. Renseignez les coordonnées du client, la date et l'heure du RDV, puis la description des travaux et le montant estimé. L'intervention apparaît immédiatement avec le statut \"En attente\".",
  },
  {
    icon: <Send className="h-4 w-4" />,
    title: "Envoyer les documents en signature",
    content: "Sur la fiche de l'intervention, cliquez sur \"Envoyer en signature\". L'application génère automatiquement les 3 documents juridiques (Procès-verbal, Fiche de travaux, Attestation TVA), envoie un SMS au client avec le lien sécurisé, et le statut passe à \"Envoyé\".",
  },
  {
    icon: <FileSignature className="h-4 w-4" />,
    title: "Le client signe en ligne",
    content: "Le client clique sur le lien reçu par SMS, accède à une page sécurisée, consulte chaque document, signe avec son doigt sur mobile ou la souris sur desktop, puis valide. Aucun compte n'est nécessaire pour le client.",
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: "Recevoir et archiver le PDF signé",
    content: "Dès que le client a signé, vous recevez une notification dans le dashboard. Si l'email du client est renseigné, il reçoit automatiquement les PDFs par email. Tous les documents sont archivés dans \"Documents signés\" avec leur valeur juridique (hash SHA-256, IP, horodatage).",
  },
  {
    icon: <CalendarSync className="h-4 w-4" />,
    title: "Synchroniser avec Google Calendar (optionnel)",
    content: "Dans \"Synchro Calendar\", connectez votre compte Google et autorisez l'accès. Toutes les 15 minutes, l'app importe automatiquement vos événements Calendar contenant les bonnes infos (TEL ASSU:, ADRESSE:, MONTANT_TTC:...) et les transforme en interventions.",
  },
  {
    icon: <SettingsIcon className="h-4 w-4" />,
    title: "Personnaliser vos préférences",
    content: "Dans \"Configuration\", personnalisez vos templates SMS, le délai d'expiration des liens de signature, les heures d'envoi des rappels automatiques, et les emails admin qui reçoivent les notifications critiques.",
  },
];

// ============================================================
// Données : FAQ
// ============================================================

interface FaqCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  questions: { q: string; a: string }[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "signatures",
    label: "Signatures",
    icon: <FileSignature className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment envoyer un document à signer ?", a: "Sur la fiche de l'intervention, cliquez sur \"Envoyer en signature\". L'app génère les 3 PDF juridiques et envoie un SMS au client avec le lien. Le statut passe à \"Envoyé\"." },
      { q: "Que se passe-t-il quand le client signe ?", a: "L'application enregistre la signature avec hash SHA-256, IP, horodatage et User-Agent (preuves juridiques). Le statut passe à \"Signé\". Vous recevez une notification, et le client reçoit les PDFs par email si renseigné." },
      { q: "Un PDF signé a-t-il valeur juridique ?", a: "Oui. Conforme au règlement eIDAS (UE n°910/2014) sur la signature électronique simple. Suffisant pour les actes courants comme un PV de fin de chantier ou une attestation TVA." },
      { q: "Le client peut-il refuser ou annuler ?", a: "Oui, le client peut fermer la page sans signer. Tant qu'il n'a pas signé, le statut reste \"Envoyé\". Vous pouvez annuler manuellement depuis la fiche si besoin." },
      { q: "Que faire si le lien a expiré ?", a: "Par défaut, les liens expirent au bout de 30 jours (configurable). Si expiré, le statut passe à \"Expiré\" et vous recevez une notification. Cliquez sur \"Renvoyer en signature\" pour générer un nouveau lien." },
      { q: "Puis-je voir qui a signé et quand ?", a: "Sur la fiche d'une intervention signée, vous voyez le nom tapé par le signataire, son consentement, la date et l'heure exactes, et l'IP utilisée. Tous ces éléments constituent la preuve juridique." },
      { q: "Que faire si un client perd son lien ?", a: "Sur la fiche, cliquez sur \"Renvoyer le SMS\". Un nouveau message sera envoyé avec le même lien. Pas besoin de générer un nouveau lien sauf s'il a expiré." },
    ],
  },
  {
    id: "calendar",
    label: "Google Calendar",
    icon: <CalendarSync className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment connecter mon Google Calendar ?", a: "Allez dans \"Synchro Calendar\" dans la sidebar, cliquez sur \"Connecter Google Calendar\", autorisez l'accès via votre compte Google. Vous pouvez ensuite lancer une première sync manuelle." },
      { q: "Quel format mes événements doivent-ils respecter ?", a: "La description doit contenir au minimum \"TEL ASSU: 06xxxxxxxx\". Les autres champs : EMAIL ASSU:, REFERENCE:, ADRESSE: (avec CP 5 chiffres + ville sur la même ligne), TRAVAUX:, MONTANT_HT:, MONTANT_TTC:, LOGEMENT_2_ANS: (Y ou N). Le titre devient le nom du client." },
      { q: "À quelle fréquence la sync s'effectue-t-elle ?", a: "Toutes les 15 minutes en automatique. Vous pouvez aussi lancer une sync manuelle. Seuls les événements des 30 prochains jours et de la veille sont scannés." },
      { q: "Que se passe-t-il si je modifie un event Calendar ?", a: "Si l'intervention n'est pas encore signée, l'app met à jour automatiquement les données à la prochaine sync. Si elle est signée, elle reste verrouillée pour préserver la valeur juridique." },
      { q: "Comment déconnecter Google Calendar ?", a: "Dans \"Synchro Calendar\", cliquez sur \"Déconnecter\". Les tokens d'accès sont supprimés. Les interventions déjà importées restent dans l'app." },
      { q: "Pourquoi un événement n'apparaît pas comme intervention ?", a: "Causes fréquentes : la description ne contient pas \"TEL ASSU:\" suivi d'un numéro valide, l'événement est hors fenêtre 30j+1j, ou la sync n'a pas encore tourné (attendez 15 min ou lancez-la manuellement)." },
    ],
  },
  {
    id: "sms",
    label: "SMS automatiques",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    questions: [
      { q: "Quand les SMS sont-ils envoyés ?", a: "4 types automatiques : invitation à signer (au clic sur \"Envoyer en signature\"), rappel J-1 (la veille du RDV à 18h), relance signature (24h après envoi sans signature), confirmation après signature." },
      { q: "Comment personnaliser les templates ?", a: "Configuration > Templates SMS. Vous pouvez utiliser des variables : {client_prenom}, {date_rdv}, {heure_rdv}, {lien_signature}. Activez/désactivez chaque template individuellement." },
      { q: "Que se passe-t-il si un SMS échoue ?", a: "Si Twilio ne livre pas (numéro invalide, opérateur en panne...), vous recevez immédiatement une notification. La tentative est tracée dans \"SMS envoyés\" avec le statut \"Échec\" et la raison." },
      { q: "Combien coûte un SMS ?", a: "Facturé directement par Twilio sur votre compte (généralement 0,07-0,10 € par SMS en France). Solde et tarifs visibles dans votre console Twilio." },
      { q: "Puis-je envoyer un SMS manuel ?", a: "Oui, sur la fiche d'une intervention, cliquez sur \"Renvoyer le SMS\". Les SMS de rappel restent en revanche purement automatiques." },
      { q: "Comment voir l'historique des SMS ?", a: "Dans la sidebar, allez dans \"SMS envoyés\". Tous les SMS avec statut (envoyé, livré, échoué), destinataire, contenu et date." },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <Bell className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment fonctionne le système de notifications ?", a: "Notifications automatiques pour les events importants : signature reçue, SMS échoué, sync Calendar, intervention créée, lien expiré. Cloche en haut à droite avec badge. Cliquez pour voir les 10 dernières, ou allez sur la page \"Notifications\" pour l'historique avec filtres." },
      { q: "Quand est-ce que je reçois un email d'admin ?", a: "Pour les notifications de niveau \"Critique\" uniquement (ex: sync Calendar échouée, erreur système). Email envoyé aux adresses configurées dans Configuration > Notifications > \"Emails admin\". Évite le spam tout en alertant des problèmes urgents." },
      { q: "Comment changer les emails admin ?", a: "Configuration > Notifications > \"Emails admin\". Plusieurs adresses séparées par des virgules. Tous les destinataires recevront les emails critiques." },
      { q: "Puis-je désactiver les notifications ?", a: "Pas celles du dashboard (essentielles au suivi). En revanche, retirez toutes les adresses dans \"Emails admin\" pour ne plus recevoir d'email, et consultez la page Notifications quand vous le souhaitez." },
      { q: "Comment marquer plusieurs notifications comme lues ?", a: "Dans le popover de la cloche, cliquez sur \"Tout marquer lu\" en haut à droite. Pareil sur la page complète. Cliquer sur une notification la marque automatiquement lue et redirige vers l'objet concerné." },
    ],
  },
  {
    id: "team",
    label: "Équipe",
    icon: <Users className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment ajouter un utilisateur ?", a: "Section \"Équipe\" dans la sidebar. Cliquez sur \"+ Ajouter un membre\", renseignez nom, email, téléphone et rôle. L'utilisateur reçoit un email avec un mot de passe initial qu'il devra changer." },
      { q: "Quels sont les différents rôles ?", a: "Admin : accès complet, gestion utilisateurs et configuration. Manager : gestion des interventions, SMS, signatures, mais pas la configuration. Collaborateur : voit et crée ses propres interventions seulement." },
      { q: "Comment changer le rôle d'un utilisateur ?", a: "Page Équipe, cliquez sur l'utilisateur, puis \"Modifier le rôle\". Choisissez le nouveau rôle et validez. Permissions mises à jour immédiatement." },
      { q: "Comment supprimer un utilisateur ?", a: "Sur sa fiche, cliquez sur \"Supprimer le compte\". Les interventions qu'il a créées restent dans la base, vous pouvez les réassigner à un autre utilisateur." },
      { q: "Un utilisateur a oublié son mot de passe ?", a: "Sur la page Équipe, cliquez sur \"Réinitialiser le mot de passe\" pour cet utilisateur. Un nouveau mot de passe temporaire sera généré." },
    ],
  },
  {
    id: "search",
    label: "Recherche",
    icon: <Search className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment utiliser la recherche globale ?", a: "Tapez dans la barre en haut du dashboard : nom du client, téléphone, ville, code postal, ou un mot des travaux. Les résultats apparaissent au fur et à mesure." },
      { q: "Y a-t-il un raccourci clavier ?", a: "Oui ! Cmd+K (Mac) ou Ctrl+K (Windows/Linux) depuis n'importe où. Flèches haut/bas pour naviguer, Entrée pour valider, Échap pour fermer." },
      { q: "Pourquoi je ne trouve pas une intervention ?", a: "Tapez au moins 2 caractères. La recherche est insensible aux accents et à la casse. Si l'intervention vient juste d'être créée, attendez 1-2 secondes pour l'indexation." },
    ],
  },
  {
    id: "config",
    label: "Configuration",
    icon: <SettingsIcon className="h-3.5 w-3.5" />,
    questions: [
      { q: "Comment changer le délai d'expiration des liens ?", a: "Configuration > Signature électronique > \"Validité du lien (jours)\". Par défaut 30 jours. Réduisez à 7 jours pour plus de sécurité, ou augmentez à 90 jours pour plus de souplesse." },
      { q: "Comment activer ou désactiver les rappels automatiques ?", a: "Configuration > Relances automatiques. Activez/désactivez le rappel J-1 (avec heure d'envoi) et la relance signature (avec délai en heures avant relance)." },
      { q: "Comment changer mon SMTP (envoi d'emails) ?", a: "Configuré dans le fichier .env du serveur. Pour le changer (ex: passer de Gmail à Outlook), contactez votre support technique." },
      { q: "Comment exporter mes données ?", a: "Tableau de bord, bouton \"Exporter\" en haut à droite. Vous obtenez un CSV avec toutes vos interventions, statuts, montants. Ouvrable dans Excel ou Google Sheets." },
      { q: "Mes documents PDF sont-ils sauvegardés où ?", a: "Sur le serveur LBP, dans un répertoire sécurisé non accessible publiquement. Conservés indéfiniment pour la valeur juridique. Une copie automatique vers Google Drive est prévue dans une prochaine version." },
    ],
  },
];

// ============================================================
// Page principale
// ============================================================

export default function AidePage() {
  const [activeSection, setActiveSection] = useState<SectionId>("demarrage");
  const [mobileSubpage, setMobileSubpage] = useState<SectionId | null>(null);

  // Group nav items
  const groupedNav = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const currentItem = NAV_ITEMS.find(i => i.id === activeSection);
  const mobileCurrentItem = mobileSubpage ? NAV_ITEMS.find(i => i.id === mobileSubpage) : null;

  return (
    <>
      <Topbar breadcrumb="Aide" />

      {/* ===========================================
           MOBILE VIEW (< md) — iOS Settings drill-down
           =========================================== */}
      <div className="md:hidden flex-1 pb-24">
        {/* Mobile sub-page : sticky topbar avec retour */}
        {mobileSubpage && (
          <div className="sticky top-0 z-30 bg-white border-b border-border px-3 py-2.5 flex items-center justify-between gap-2">
            <button
              onClick={() => setMobileSubpage(null)}
              className="flex items-center gap-1 text-sm text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Aide</span>
            </button>
            <span className="text-sm font-semibold truncate">{mobileCurrentItem?.label}</span>
            <span className="w-12" />
          </div>
        )}

        {!mobileSubpage ? (
          // === Mobile : Liste des sections (home) ===
          <main className="px-3 py-3 space-y-5">
            {/* Header */}
            <div className="px-1">
              <h1 className="text-xl font-semibold tracking-tight">Aide</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Guide, FAQ et support pour LBP Sign
              </p>
            </div>

            {/* Sections grouped */}
            {Object.entries(groupedNav).map(([groupName, items]) => (
              <div key={groupName}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 mb-1.5">
                  {groupName}
                </p>
                <div className="bg-white border border-border rounded-lg overflow-hidden">
                  {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setMobileSubpage(item.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 ${
                          !isLast ? "border-b border-border/50" : ""
                        }`}
                        style={{ minHeight: "52px" }}
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
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
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
            {mobileSubpage === "demarrage" && <DemarrageSection />}
            {mobileSubpage === "faq" && <FaqSection />}
            {mobileSubpage === "contact" && <ContactSection />}
          </main>
        )}
      </div>

      {/* ===========================================
           DESKTOP VIEW (>= md)
           =========================================== */}
      <main className="hidden md:flex flex-1 px-5 py-5 max-w-6xl w-full mx-auto gap-5">
        {/* Sidebar verticale */}
        <aside className="w-56 flex-shrink-0">
          <div className="sticky top-16 space-y-5">
            <div>
              <h1 className="text-xl font-semibold tracking-tight px-1">Aide</h1>
              <p className="text-xs text-muted-foreground mt-0.5 px-1">
                Tout pour utiliser l'application
              </p>
            </div>

            {Object.entries(groupedNav).map(([groupName, items]) => (
              <div key={groupName}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 mb-1.5">
                  {groupName}
                </p>
                <nav className="space-y-0.5">
                  {items.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <span className={active ? "text-primary" : "text-muted-foreground"}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          {activeSection === "demarrage" && <DemarrageSection />}
          {activeSection === "faq" && <FaqSection />}
          {activeSection === "contact" && <ContactSection />}
        </div>
      </main>
    </>
  );
}

// ============================================================
// Section : Démarrage rapide
// ============================================================

function DemarrageSection() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Démarrage rapide</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          6 étapes pour bien commencer avec LBP Sign.
        </p>
      </div>

      <ol className="bg-white border border-border rounded-lg overflow-hidden divide-y divide-border">
        {QUICK_START_STEPS.map((step, i) => (
          <li key={i} className="flex gap-4 p-4">
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center">
                {i + 1}
              </div>
              {i < QUICK_START_STEPS.length - 1 && (
                <div className="flex-1 w-px bg-border min-h-[20px]" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1 pb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-primary">{step.icon}</span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.content}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground mb-0.5">Astuce</p>
          <p className="text-muted-foreground leading-relaxed">
            Utilisez le raccourci <kbd className="inline-flex h-5 px-1.5 mx-0.5 text-[10px] font-medium bg-white border border-border rounded">⌘K</kbd> ou <kbd className="inline-flex h-5 px-1.5 mx-0.5 text-[10px] font-medium bg-white border border-border rounded">Ctrl+K</kbd> pour ouvrir la recherche depuis n'importe quelle page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section : FAQ
// ============================================================

function FaqSection() {
  const [activeCategory, setActiveCategory] = useState<string>("signatures");
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (key: string) => {
    setOpenQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeCat = FAQ_CATEGORIES.find(c => c.id === activeCategory) || FAQ_CATEGORIES[0];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Foire aux questions</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {FAQ_CATEGORIES.reduce((sum, c) => sum + c.questions.length, 0)} questions réparties en {FAQ_CATEGORIES.length} catégories.
        </p>
      </div>

      {/* Catégories - tabs scrollables */}
      <div className="bg-white border border-border rounded-lg p-2 overflow-x-auto">
        <div className="flex gap-1">
          {FAQ_CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setOpenQuestions(new Set()); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted/60"
                }`}
              >
                <span className={active ? "text-primary-foreground" : "text-muted-foreground"}>
                  {cat.icon}
                </span>
                {cat.label}
                <span className={`text-[10px] px-1.5 rounded ${active ? "bg-white/20" : "bg-muted/60 text-muted-foreground"}`}>
                  {cat.questions.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white border border-border rounded-lg overflow-hidden divide-y divide-border">
        {activeCat.questions.map((qa, i) => {
          const key = `${activeCat.id}-${i}`;
          const isOpen = openQuestions.has(key);
          return (
            <div key={key}>
              <button
                onClick={() => toggleQuestion(key)}
                className="w-full px-4 py-3.5 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors"
                style={{ minHeight: "52px" }}
              >
                <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                <span className="flex-1 text-sm font-medium leading-snug">{qa.q}</span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-96" : "max-h-0"}`}
              >
                <div className="px-4 pb-4 pl-11">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {qa.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/40 border border-border rounded-lg p-4 flex items-start gap-3">
        <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground mb-0.5">Vous ne trouvez pas votre réponse ?</p>
          <p className="text-muted-foreground leading-relaxed mb-2">
            L'équipe support est là pour vous aider, sous 48h en jours ouvrés.
          </p>
          
          <a
            href="mailto:contact@pixfeed.net?subject=Question%20LBP%20Sign"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            contact@pixfeed.net
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section : Contact
// ============================================================

function ContactSection() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Contacter le support</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Notre équipe vous répond rapidement pour toute question technique ou demande d'évolution.
        </p>
      </div>

      {/* Card support principal */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-5 lg:p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold mb-1">Support technique</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Pour les bugs, problèmes techniques, questions sur le fonctionnement de l'application, ou demandes d'évolution.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  asChild
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <a href="mailto:contact@pixfeed.net?subject=Support%20LBP%20Sign">
                    <Mail className="h-3.5 w-3.5" />
                    contact@pixfeed.net
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <a href="https://pixfeed.net" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    pixfeed.net
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Réponse sous 48h en jours ouvrés (lundi-vendredi)
          </p>
        </div>
      </div>

      {/* Sécurité */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold mb-1">Sécurité & confidentialité</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Vos données sont stockées en France, sur un serveur dédié sécurisé. Aucune donnée n'est partagée avec des tiers en dehors des prestataires nécessaires (Twilio pour les SMS, Google pour Calendar).
              </p>
              
              <a
                href="mailto:contact@pixfeed.net?subject=Question%20s%C3%A9curit%C3%A9%20LBP"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                Question sécurité
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          LBP Sign · Développé par <a href="https://pixfeed.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PixFeed</a>
        </p>
      </div>
    </div>
  );
}
