"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, FileText, Eraser } from "lucide-react";
import { toast, Toaster } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-lesbonsplombiers.pixfeed.net";

interface DocumentInfo {
  id: string;
  type: string;
  status: string;
}

interface SignatureInfo {
  intervention_id: string;
  client_nom: string;
  client_prenom: string;
  client_adresse?: string;
  client_code_postal?: string;
  client_ville?: string;
  description_travaux?: string;
  montant_devis_ht?: number;
  montant_devis_ttc?: number;
  date_rdv?: string;
  expires_at?: string;
  is_signed: boolean;
  documents: DocumentInfo[];
}

const REQUIRED_MENTION = "Lu et approuvé";

const DOCUMENT_LABELS: Record<string, string> = {
  proces_verbal: "Procès-verbal de réception",
  fiche_travaux: "Fiche de travaux",
  attestation_tva: "Attestation TVA",
  delegation_paiement: "Délégation de paiement",
};

export default function SignaturePage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  const [signerName, setSignerName] = useState("");
  const [consentText, setConsentText] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  // === Charger les infos ===
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/signature/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Lien invalide ou expiré");
        }
        const data = await res.json();
        setInfo(data);
        if (data.is_signed) setSigned(true);
        setSignerName(`${data.client_prenom} ${data.client_nom}`);
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // === Init Canvas ===
  useEffect(() => {
    if (!info || signed || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    padRef.current = new SignaturePad(canvas, {
      backgroundColor: "rgba(255, 255, 255, 0)",
      penColor: "rgb(0, 0, 50)",
      minWidth: 1,
      maxWidth: 2.5,
    });

    return () => {
      padRef.current?.off();
    };
  }, [info, signed]);

  const handleClearSignature = () => {
    padRef.current?.clear();
  };

  const handleSign = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Veuillez signer dans le cadre");
      return;
    }
    if (signerName.trim().length < 3) {
      toast.error("Veuillez retaper votre nom");
      return;
    }
    if (consentText.trim().toLowerCase() !== REQUIRED_MENTION.toLowerCase()) {
      toast.error(`Vous devez écrire exactement : "${REQUIRED_MENTION}"`);
      return;
    }

    setSigning(true);
    try {
      const signatureImage = padRef.current.toDataURL("image/png");
      const res = await fetch(`${API_URL}/api/public/signature/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image: signatureImage,
          signer_name_typed: signerName.trim(),
          consent_text: consentText.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erreur lors de la signature");
      }
      toast.success("Documents signés avec succès !");
      setSigned(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSigning(false);
    }
  };

  // === États affichage ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-slate-50 p-4">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-slate-600">{error || "Ce lien de signature n'est plus valide."}</p>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-50 p-4">
        <Card className="p-8 max-w-md text-center">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Documents signés !</h1>
          <p className="text-slate-600 mb-6">
            Merci {info.client_prenom} {info.client_nom}. Vos documents ont bien été enregistrés.
            Une copie vous sera envoyée par mail.
          </p>
          <div className="text-sm text-slate-500 bg-slate-50 rounded p-3">
            Les Bons Plombiers vous remercie de votre confiance.
          </div>
        </Card>
      </div>
    );
  }

  // === Page principale ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <Toaster position="top-center" richColors />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Signature électronique</h1>
          <p className="text-slate-600">Les Bons Plombiers</p>
        </div>

        {/* Récap intervention */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Récapitulatif</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Client</dt>
              <dd className="font-medium text-slate-900">
                {info.client_prenom} {info.client_nom}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Adresse</dt>
              <dd className="font-medium text-slate-900">
                {info.client_adresse}, {info.client_code_postal} {info.client_ville}
              </dd>
            </div>
            {info.description_travaux && (
              <div className="md:col-span-2">
                <dt className="text-slate-500">Travaux</dt>
                <dd className="font-medium text-slate-900">{info.description_travaux}</dd>
              </div>
            )}
            {info.montant_devis_ht !== undefined && info.montant_devis_ht !== null && (
              <div>
                <dt className="text-slate-500">Montant HT</dt>
                <dd className="font-medium text-slate-900">
                  {(info.montant_devis_ht / 100).toFixed(2)} €
                </dd>
              </div>
            )}
            {info.montant_devis_ttc !== undefined && info.montant_devis_ttc !== null && (
              <div>
                <dt className="text-slate-500">Montant TTC</dt>
                <dd className="font-medium text-slate-900">
                  {(info.montant_devis_ttc / 100).toFixed(2)} €
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Documents */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Documents à signer ({info.documents.length})
          </h2>
          <div className="space-y-2">
            {info.documents.map((doc) => (
              
              <a
                key={doc.id}
                href={`${API_URL}/api/public/signature/${token}/document/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              >
                <FileText className="h-5 w-5 text-slate-600 flex-shrink-0" />
                <span className="flex-1 text-slate-900 font-medium">
                  {DOCUMENT_LABELS[doc.type] || doc.type}
                </span>
                <span className="text-xs text-blue-600 font-medium">Voir le PDF →</span>
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Veuillez consulter chaque document avant de signer.
          </p>
        </Card>

        {/* Formulaire signature */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Signer les documents</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="signer-name">Votre nom complet</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nom Prénom"
                required
              />
            </div>

            <div>
              <Label htmlFor="consent">
                Tapez exactement : <strong className="text-slate-900">{REQUIRED_MENTION}</strong>
              </Label>
              <Input
                id="consent"
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                placeholder={REQUIRED_MENTION}
                required
              />
            </div>

            <div>
              <Label>Votre signature manuscrite</Label>
              <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg bg-white relative">
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 rounded-lg"
                  style={{ touchAction: "none" }}
                />
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="absolute top-2 right-2 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 bg-white/80 px-2 py-1 rounded"
                >
                  <Eraser className="h-3 w-3" /> Effacer
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Signez avec votre doigt ou la souris</p>
            </div>

            <Button
              onClick={handleSign}
              disabled={signing}
              size="lg"
              className="w-full"
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signature en cours...
                </>
              ) : (
                "Je signe les documents"
              )}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              En signant, vous reconnaissez avoir pris connaissance des documents.
              Votre IP, navigateur et signature seront enregistrés à des fins de preuve.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
