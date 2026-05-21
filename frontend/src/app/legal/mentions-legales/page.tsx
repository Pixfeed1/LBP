"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Shield, Cookie, Copyright, AlertTriangle, FileSignature, Mail, Phone, MapPin } from "lucide-react";

const SECTION_ICON: Record<string, any> = {
  infos: FileText,
  rgpd: Shield,
  signature: FileSignature,
  cookies: Cookie,
  ip: Copyright,
  responsabilite: AlertTriangle,
};

const SECTIONS: { id: string; label: string }[] = [
  { id: "infos", label: "Informations légales" },
  { id: "rgpd", label: "Politique de confidentialité" },
  { id: "signature", label: "Données de signature" },
  { id: "cookies", label: "Cookies" },
  { id: "ip", label: "Propriété intellectuelle" },
  { id: "responsabilite", label: "Responsabilité" },
];

const INFOS_LEGALES: [string, string][] = [
  ["Raison sociale", "LES BONS PLOMBIERS"],
  ["Forme juridique", "SARL, société à responsabilité limitée"],
  ["SIREN", "892 923 277"],
  ["SIRET (siège)", "892 923 277 00016"],
  ["Numéro RCS", "892 923 277 R.C.S. Paris"],
  ["TVA intracommunautaire", "FR92 892923277"],
  ["Capital social", "50 000,00 €"],
  ["Code APE", "43.22A — Travaux d'installation d'eau et de gaz"],
  ["Siège social", "9 avenue Jean Jaurès, 75019 Paris"],
  ["Téléphone", "01 80 91 43 20"],
  ["Email", "contact@lesbonsplombiers.com"],
  ["Gérant", "Christopher Brasseleur"],
  ["Directeur de publication", "Christopher Brasseleur"],
];

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 lg:px-5 h-12 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Link>
          <span className="text-sm font-semibold">Mentions légales</span>
          <span className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-5 py-6 lg:py-10 space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Mentions légales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informations légales, politique de confidentialité et conditions d'utilisation de l'outil de signature électronique.
          </p>
          <p className="text-xs text-muted-foreground mt-2">Dernière mise à jour : 9 mai 2026</p>
        </div>

        <nav className="bg-white border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Sommaire</p>
          <ul className="space-y-1">
            {SECTIONS.map((sec, i) => {
              const Icon = SECTION_ICON[sec.id];
              return (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground/70 hover:bg-muted/60 hover:text-foreground transition-colors">
                    <span className="text-muted-foreground w-5 text-xs tabular-nums">{i + 1}.</span>
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span>{sec.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <section id="infos" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">1. Informations légales</h2>
          </div>
          <div className="p-5 space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-3">Le présent outil de signature électronique est édité et exploité par :</p>
              <dl className="divide-y divide-border border border-border rounded-md overflow-hidden">
                {INFOS_LEGALES.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 px-3 py-2.5 text-sm">
                    <dt className="text-muted-foreground sm:col-span-1">{label}</dt>
                    <dd className="font-medium sm:col-span-2 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Hébergement</h3>
              <p className="text-muted-foreground leading-relaxed">
                L'outil est hébergé par <strong className="text-foreground">EX2 Inc.</strong>, prestataire d'hébergement web.<br />
                Site web : <a href="https://www.ex2.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.ex2.com</a>
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Conception et développement</h3>
              <p className="text-muted-foreground leading-relaxed">
                L'outil de signature électronique a été conçu et développé par <strong className="text-foreground">PixFeed</strong>, prestataire technique indépendant.
              </p>
            </div>
          </div>
        </section>

        <section id="rgpd" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">2. Politique de confidentialité</h2>
          </div>
          <div className="p-5 space-y-4 text-sm leading-relaxed">
            <div>
              <h3 className="text-sm font-semibold mb-1.5">Responsable du traitement</h3>
              <p className="text-muted-foreground">
                Le responsable du traitement est <strong className="text-foreground">LES BONS PLOMBIERS</strong>, 9 avenue Jean Jaurès, 75019 Paris, joignable à <a href="mailto:contact@lesbonsplombiers.com" className="text-primary hover:underline">contact@lesbonsplombiers.com</a>.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Données collectées</h3>
              <p className="text-muted-foreground mb-2">Dans le cadre de l'utilisation de cet outil, les données suivantes peuvent être collectées :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                <li>Identité du signataire (nom, prénom, nom tapé lors de la signature)</li>
                <li>Coordonnées (téléphone, adresse email)</li>
                <li>Adresse postale et code postal de l'intervention</li>
                <li>Description des travaux et montants associés</li>
                <li>Données techniques (adresse IP, User-Agent, horodatage)</li>
                <li>Tracé manuscrit de la signature</li>
                <li>Consentement explicite (« Lu et approuvé »)</li>
                <li>Empreinte cryptographique SHA-256 garantissant l'intégrité du document</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Finalités</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                <li>Établir la valeur juridique des actes signés conformément au règlement eIDAS (UE n°910/2014)</li>
                <li>Assurer la traçabilité et la preuve juridique en cas de litige</li>
                <li>Notifier les parties par SMS ou email de l'avancement de l'intervention</li>
                <li>Gérer la relation contractuelle entre LES BONS PLOMBIERS et le signataire</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Base légale</h3>
              <p className="text-muted-foreground">
                Le traitement repose sur l'exécution du contrat ou de mesures précontractuelles (article 6.1.b du RGPD) ainsi que sur le respect d'obligations légales et comptables (article 6.1.c).
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Sous-traitants et destinataires</h3>
              <p className="text-muted-foreground mb-2">Les données peuvent être traitées par les prestataires techniques suivants :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                <li><strong className="text-foreground">EX2 Inc.</strong> — hébergement de l'application</li>
                <li><strong className="text-foreground">Twilio Inc.</strong> — envoi de SMS (transferts hors UE encadrés par les clauses contractuelles types)</li>
                <li><strong className="text-foreground">Google LLC</strong> — synchronisation Google Calendar (uniquement si activée)</li>
                <li><strong className="text-foreground">PixFeed</strong> — maintenance technique et support</li>
              </ul>
              <p className="text-muted-foreground mt-2">Aucune donnée n'est revendue ni partagée à des fins commerciales.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Durée de conservation</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                <li>Documents signés et preuves : <strong className="text-foreground">10 ans</strong> (durée légale de conservation)</li>
                <li>Interventions non signées : 3 ans après le dernier échange</li>
                <li>Logs techniques : 12 mois maximum, sauf obligation judiciaire</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1.5">Vos droits</h3>
              <p className="text-muted-foreground mb-2">Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                <li>Droit d'accès, de rectification et de portabilité de vos données</li>
                <li>Droit à l'effacement (sous réserve des obligations légales de conservation)</li>
                <li>Droit d'opposition et de limitation du traitement</li>
                <li>Droit d'introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CNIL</a></li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Pour exercer ces droits : <a href="mailto:contact@lesbonsplombiers.com" className="text-primary hover:underline">contact@lesbonsplombiers.com</a>
              </p>
            </div>
          </div>
        </section>

        <section id="signature" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">3. Données de signature électronique</h2>
          </div>
          <div className="p-5 space-y-4 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              L'outil utilise un mécanisme de <strong className="text-foreground">signature électronique simple</strong> conforme au règlement européen eIDAS (UE n°910/2014). À chaque signature, l'application enregistre les éléments de preuve suivants :
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground pl-2">
              <li>L'horodatage exact de la signature (date et heure UTC)</li>
              <li>L'adresse IP du signataire</li>
              <li>Le User-Agent du navigateur utilisé</li>
              <li>Le tracé manuscrit de la signature (image PNG)</li>
              <li>Le nom tapé par le signataire et la mention « Lu et approuvé »</li>
              <li>Une empreinte cryptographique SHA-256 du document signé</li>
            </ul>
            <p className="text-muted-foreground">
              Ces preuves sont conservées de manière inaltérable et constituent la valeur juridique du document signé. Elles peuvent être utilisées en cas de litige pour démontrer le consentement et l'identité du signataire.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3.5">
              <p className="text-foreground font-medium mb-1">Engagement de sécurité</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Les données de signature sont stockées de manière sécurisée chez l'hébergeur EX2 Inc., sur des serveurs protégés par des contrôles d'accès stricts. L'accès aux documents signés est limité aux personnes autorisées au sein de LES BONS PLOMBIERS et au signataire concerné.
              </p>
            </div>
          </div>
        </section>

        <section id="cookies" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Cookie className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">4. Politique de cookies</h2>
          </div>
          <div className="p-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              À la date de mise à jour de cette page, l'outil <strong className="text-foreground">n'utilise pas</strong> de cookies publicitaires ni de traceurs d'analyse d'audience soumis au recueil préalable du consentement.
            </p>
            <p>
              Seuls des cookies <strong className="text-foreground">strictement nécessaires</strong> au fonctionnement (gestion de la session, sécurité, authentification) peuvent être utilisés.
            </p>
            <p>
              Si des services optionnels nécessitant un consentement préalable devaient être ajoutés, un dispositif d'information et de recueil du consentement adapté serait mis en place.
            </p>
            <p>
              Vous pouvez configurer votre navigateur pour limiter ou bloquer les cookies, sous réserve d'une possible altération de certaines fonctionnalités.
            </p>
          </div>
        </section>

        <section id="ip" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Copyright className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">5. Propriété intellectuelle</h2>
          </div>
          <div className="p-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              L'outil de signature électronique, son code source, son design, son architecture technique et l'ensemble des éléments qui le composent (interfaces, illustrations, structure logicielle) sont la propriété exclusive de <strong className="text-foreground">PixFeed</strong>.
            </p>
            <p>
              Toute reproduction, distribution, modification, adaptation, retransmission ou publication, même partielle, sans autorisation écrite préalable de PixFeed est strictement interdite et constituerait une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
            </p>
            <p>
              Les données saisies par les utilisateurs (informations clients, descriptions de travaux, signatures) restent la propriété de <strong className="text-foreground">LES BONS PLOMBIERS</strong> et de leurs auteurs respectifs.
            </p>
            <p>
              La marque <strong className="text-foreground">LES BONS PLOMBIERS</strong>, son logo et l'ensemble des éléments visuels associés sont la propriété de la société LES BONS PLOMBIERS.
            </p>
          </div>
        </section>

        <section id="responsabilite" className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">6. Responsabilité</h2>
          </div>
          <div className="p-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">LES BONS PLOMBIERS</strong> est responsable du contenu publié sur l'outil et du traitement des données personnelles dans le cadre de l'exploitation de l'application.
            </p>
            <p>
              LES BONS PLOMBIERS s'efforce d'assurer l'exactitude des informations publiées. Toutefois, ils ne sauraient être tenus responsables des erreurs ou omissions, ni des dommages résultant de l'utilisation de ces informations.
            </p>
            <p>
              L'utilisateur est seul responsable de l'usage qu'il fait de l'outil et des données qu'il saisit. Il s'engage à utiliser l'application dans le respect des lois et réglementations en vigueur.
            </p>
            <p>
              <strong className="text-foreground">PixFeed</strong>, en sa qualité de prestataire technique, n'est pas responsable du contenu publié ni de l'usage qui est fait de l'outil par LES BONS PLOMBIERS et ses utilisateurs.
            </p>
          </div>
        </section>

        <section className="bg-muted/40 border border-border rounded-lg p-5 text-sm">
          <h3 className="font-semibold mb-3">Une question juridique ou RGPD ?</h3>
          <div className="space-y-2 text-muted-foreground">
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <a href="mailto:contact@lesbonsplombiers.com" className="text-primary hover:underline">contact@lesbonsplombiers.com</a>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>01 80 91 43 20</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>9 avenue Jean Jaurès, 75019 Paris</span>
            </p>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center pt-2">
          © 2026 LES BONS PLOMBIERS — SARL — RCS Paris 892 923 277<br />
          Outil de signature électronique conçu par <a href="https://pixfeed.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PixFeed</a>
        </p>
      </main>
    </div>
  );
}
