"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus, MoreVertical, Loader2, Users, Shield, ShieldCheck,
  Mail, Edit, Lock, Trash2, X, Check, Copy, AlertTriangle,
} from "lucide-react";

import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { User, UserStats, UserRole, UserCreatePayload, UserCreateResponse } from "@/types/user";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  manager: "Manager",
  collaborator: "Collaborateur",
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin: "bg-purple-50 text-purple-700 border-purple-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  collaborator: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function EquipePage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ user: User; password: string } | null>(null);

  const isAdmin = currentUser?.role === "admin";

  const loadAll = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get<User[]>("/api/users"),
        api.get<UserStats>("/api/users/stats"),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Erreur chargement users:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!currentUser) return null;

  if (!isAdmin) {
    return (
      <>
        <Topbar breadcrumb="Équipe" />
        <main className="flex-1 px-5 py-5 max-w-4xl w-full mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <Shield className="h-10 w-10 text-amber-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-amber-900 mb-1">Accès restreint</h2>
            <p className="text-sm text-amber-800">
              Seuls les administrateurs peuvent gérer l&apos;équipe.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar breadcrumb="Équipe" />

      {/* DESKTOP */}
      <main className="hidden lg:block flex-1 px-5 py-5 max-w-[1400px] w-full mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Équipe</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez les membres de votre équipe et leurs permissions
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Inviter un membre
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Membres total" value={stats?.total ?? 0} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Actifs" value={stats?.active ?? 0} icon={<Check className="h-4 w-4" />} tone="success" />
          <StatCard label="Administrateurs" value={stats?.by_role?.admin ?? 0} icon={<ShieldCheck className="h-4 w-4" />} tone="purple" />
        </div>

        {/* Tableau desktop */}
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              Aucun membre dans l&apos;équipe
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Membre</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Rôle</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Dernière connexion</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isMe={u.id === currentUser.id}
                    onEdit={() => setEditUser(u)}
                    onAfterAction={loadAll}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* MOBILE */}
      <main className="lg:hidden flex-1 px-3 py-3 pb-24">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Équipe</h1>
            <p className="text-xs text-muted-foreground">
              {stats?.total ?? 0} membre{(stats?.total ?? 0) > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Stats mobile (2x2) */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MobileStat label="Total" value={stats?.total ?? 0} />
          <MobileStat label="Actifs" value={stats?.active ?? 0} tone="success" />
          <MobileStat label="Admins" value={stats?.by_role?.admin ?? 0} tone="purple" />
        </div>

        {/* Cards membres */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground bg-white border border-border rounded-lg">
            Aucun membre
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <MobileUserCard
                key={u.id}
                user={u}
                isMe={u.id === currentUser.id}
                onEdit={() => setEditUser(u)}
              />
            ))}
          </div>
        )}

        {/* FAB invite */}
        <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-20 right-4 z-30 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </main>

      {/* Modals */}
      {createOpen && (
        <CreateUserDialog
          onClose={() => setCreateOpen(false)}
          onSuccess={(result) => {
            setCreateOpen(false);
            if (result.password_generated && result.temp_password) {
              setTempPasswordModal({ user: result.user, password: result.temp_password });
            }
            loadAll();
          }}
        />
      )}

      {editUser && (
        <EditUserDialog
          user={editUser}
          isMe={editUser.id === currentUser.id}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); loadAll(); }}
        />
      )}

      {tempPasswordModal && (
        <TempPasswordDialog
          user={tempPasswordModal.user}
          password={tempPasswordModal.password}
          onClose={() => setTempPasswordModal(null)}
        />
      )}
    </>
  );
}

// ============================================================
// Composants
// ============================================================

function StatCard({ label, value, icon, tone = "neutral" }: { label: string; value: number; icon: React.ReactNode; tone?: "neutral" | "success" | "purple" }) {
  const valueColor = tone === "success" ? "text-emerald-600" : tone === "purple" ? "text-purple-600" : "text-foreground";
  const iconBg = tone === "success" ? "bg-emerald-100 text-emerald-700" : tone === "purple" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground";
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={"flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center " + iconBg}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={"text-2xl font-semibold tabular-nums " + valueColor}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function MobileStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "purple" }) {
  const valueColor = tone === "success" ? "text-emerald-600" : tone === "purple" ? "text-purple-600" : "text-foreground";
  return (
    <div className="bg-white border border-border rounded-lg p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={"text-xl font-bold tabular-nums " + valueColor}>{value}</div>
    </div>
  );
}

function UserRow({ user, isMe, onEdit, onAfterAction }: { user: User; isMe: boolean; onEdit: () => void; onAfterAction: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user.name || user.email).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "??";
  const isActive = user.is_active === "Y";

  const lastLoginStr = user.last_login_at
    ? new Date(user.last_login_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "Jamais";

  const handleDeactivate = async () => {
    if (!confirm(`Désactiver ${user.name} ?`)) return;
    try {
      await api.delete(`/api/users/${user.id}`);
      onAfterAction();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {user.name}
              {isMe && <span className="ml-2 text-[10px] text-muted-foreground">(vous)</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border " + ROLE_BADGE_CLASSES[user.role as UserRole]}>
          {ROLE_LABELS[user.role as UserRole]}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border " + (isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
          <span className={"w-1.5 h-1.5 rounded-full " + (isActive ? "bg-emerald-500" : "bg-slate-400")}></span>
          {isActive ? "Actif" : "Désactivé"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{lastLoginStr}</td>
      <td className="px-4 py-3 text-right relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)}></div>
            <div className="absolute right-4 top-12 z-30 bg-white border border-border rounded-md shadow-lg py-1 min-w-[160px]">
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2">
                <Edit className="h-3.5 w-3.5" />
                Modifier
              </button>
              {!isMe && (
                <button onClick={() => { setMenuOpen(false); handleDeactivate(); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-700 flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5" />
                  Désactiver
                </button>
              )}
            </div>
          </>
        )}
      </td>
    </tr>
  );
}

function MobileUserCard({ user, isMe, onEdit }: { user: User; isMe: boolean; onEdit: () => void }) {
  const initials = (user.name || user.email).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "??";
  const isActive = user.is_active === "Y";
  return (
    <button
      onClick={onEdit}
      className="w-full bg-white border border-border rounded-lg p-3 flex items-start gap-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {user.name}
          {isMe && <span className="ml-2 text-[10px] text-muted-foreground">(vous)</span>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">{user.email}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={"inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border " + ROLE_BADGE_CLASSES[user.role as UserRole]}>
            {ROLE_LABELS[user.role as UserRole]}
          </span>
          <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border " + (isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
            <span className={"w-1 h-1 rounded-full " + (isActive ? "bg-emerald-500" : "bg-slate-400")}></span>
            {isActive ? "Actif" : "Désactivé"}
          </span>
        </div>
      </div>
    </button>
  );
}

function CreateUserDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (result: UserCreateResponse) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("collaborator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !name.trim()) {
      setError("Email et nom obligatoires");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: UserCreatePayload = { email: email.trim(), name: name.trim(), role };
      const res = await api.post<UserCreateResponse>("/api/users", payload);
      onSuccess(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Inviter un membre" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-xs text-red-700">{error}</div>
        )}
        <Field label="Nom complet">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jessica Durand" className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jessica@lesbonsplombiers.fr" className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </Field>
        <Field label="Rôle">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="collaborator">Collaborateur</option>
            <option value="manager">Manager</option>
            <option value="admin">Administrateur</option>
          </select>
        </Field>
        <p className="text-[11px] text-muted-foreground italic">Un mot de passe temporaire sera généré automatiquement et affiché après la création.</p>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50 disabled:opacity-50">Annuler</button>
        <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          Inviter
        </button>
      </div>
    </Modal>
  );
}

function EditUserDialog({ user, isMe, onClose, onSuccess }: { user: User; isMe: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role as UserRole);
  const [isActive, setIsActive] = useState(user.is_active === "Y");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/users/${user.id}`, {
        name: name.trim(),
        role,
        is_active: isActive ? "Y" : "N",
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Modifier le membre" onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-xs text-red-700">{error}</div>}
        <Field label="Email"><div className="text-sm text-muted-foreground py-2">{user.email}</div></Field>
        <Field label="Nom">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </Field>
        <Field label="Rôle">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} disabled={isMe} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
            <option value="collaborator">Collaborateur</option>
            <option value="manager">Manager</option>
            <option value="admin">Administrateur</option>
          </select>
          {isMe && <p className="text-[10px] text-muted-foreground mt-1">Vous ne pouvez pas modifier votre propre rôle</p>}
        </Field>
        {!isMe && (
          <Field label="Statut">
            <div className="flex items-center gap-2">
              <button onClick={() => setIsActive(!isActive)} className={"relative inline-flex h-5 w-9 items-center rounded-full transition-colors " + (isActive ? "bg-primary" : "bg-muted-foreground/30")}>
                <span className={"inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform " + (isActive ? "translate-x-[18px]" : "translate-x-0.5")} />
              </button>
              <span className="text-sm">{isActive ? "Actif" : "Désactivé"}</span>
            </div>
          </Field>
        )}
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50 disabled:opacity-50">Annuler</button>
        <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

function TempPasswordDialog({ user, password, onClose }: { user: User; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    const text = `Email : ${user.email}\nMot de passe temporaire : ${password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Membre invité avec succès" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>Notez ce mot de passe maintenant.</strong> Il ne sera plus jamais affiché. Communiquez-le à {user.name} en toute sécurité.
          </div>
        </div>
        <div className="bg-muted/30 border border-border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Email</span>
            <code className="text-sm font-mono">{user.email}</code>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Mot de passe</span>
            <code className="text-sm font-mono font-bold text-primary">{password}</code>
          </div>
        </div>
        <button onClick={copyAll} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted/50">
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier email + mot de passe</>}
        </button>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">J&apos;ai noté</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl border border-border max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 -mr-1 rounded-md hover:bg-muted/50">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
