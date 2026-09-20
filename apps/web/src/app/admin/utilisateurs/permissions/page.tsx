"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Account {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Functionality {
  id: string;
  name: string;
  pole: string;
}

interface PermissionRow {
  user_id: string;
  functionality_id: string;
  can_read: boolean;
  can_write: boolean;
}

const FUNCTIONALITY_LABELS: Record<string, string> = {
  grades: "Notes",
  finances: "Finances",
  wallet: "Wallet",
  timetable: "Emploi du temps",
  student_records: "Dossiers élèves",
  attendance: "Présence",
  enrollments: "Inscriptions",
  school_configuration: "Configuration de l'établissement",
};

const POLE_LABELS: Record<string, string> = {
  academic: "Académique",
  finance: "Finances",
  administrative: "Administratif",
  school_life: "Vie scolaire",
  configuration: "Configuration",
};

const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  professeur: "Professeur",
  eleve: "Élève",
  parent: "Parent",
};

export default function PermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [functionalities, setFunctionalities] = useState<Functionality[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("id", sessionData.session.user.id)
      .single();

    if (!myProfile?.school_id) {
      setError("Aucune école rattachée à ce compte.");
      setLoading(false);
      return;
    }

    if (myProfile.role !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const [accountsRes, functionalitiesRes, permissionsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("school_id", myProfile.school_id)
        .neq("role", "admin"),
      supabase.from("functionalities").select("id, name, pole"),
      supabase.from("user_permissions").select("user_id, functionality_id, can_read, can_write"),
    ]);

    setAccounts(accountsRes.data ?? []);
    setFunctionalities(functionalitiesRes.data ?? []);
    setPermissions(permissionsRes.data ?? []);
    setSelectedAccountId((prev) => prev ?? accountsRes.data?.[0]?.id ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  function getPermission(userId: string, functionalityId: string): { can_read: boolean; can_write: boolean } {
    const row = permissions.find((p) => p.user_id === userId && p.functionality_id === functionalityId);
    return { can_read: row?.can_read ?? false, can_write: row?.can_write ?? false };
  }

  function togglePermission(userId: string, functionalityId: string, field: "can_read" | "can_write") {
    setPermissions((prev) => {
      const existing = prev.find((p) => p.user_id === userId && p.functionality_id === functionalityId);
      if (existing) {
        return prev.map((p) =>
          p.user_id === userId && p.functionality_id === functionalityId ? { ...p, [field]: !p[field] } : p,
        );
      }
      return [...prev, { user_id: userId, functionality_id: functionalityId, can_read: false, can_write: false, [field]: true }];
    });
    setSavedMessage(false);
  }

  async function handleSave() {
    if (!selectedAccountId) return;
    setSaving(true);
    setError(null);

    const rows = functionalities.map((f) => {
      const perm = getPermission(selectedAccountId, f.id);
      return { user_id: selectedAccountId, functionality_id: f.id, can_read: perm.can_read, can_write: perm.can_write };
    });

    const { error: err } = await supabase.from("user_permissions").upsert(rows, { onConflict: "user_id,functionality_id" });

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedMessage(true);
    await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <a href="/admin/utilisateurs" className="text-sm text-zinc-500 underline">
            ← Retour
          </a>
          <p className="text-zinc-700 dark:text-zinc-300">
            Cette page est réservée au compte Admin de l&apos;école.
          </p>
        </div>
      </main>
    );
  }

  const poles = Array.from(new Set(functionalities.map((f) => f.pole)));
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <a href="/admin/utilisateurs" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Permissions individuelles</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Seul le compte Admin a un accès total. Chaque autre compte a des permissions définies ici, indépendamment de son rôle affiché.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {accounts.length === 0 ? (
          <p className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            Aucun compte à gérer pour l&apos;instant (seuls les comptes Admin existent). Les comptes créés pour la Direction,
            les professeurs ou le personnel apparaîtront ici pour configurer leurs droits.
          </p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-col gap-1 sm:w-56 sm:shrink-0">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAccountId(a.id);
                    setSavedMessage(false);
                  }}
                  className={`rounded px-3 py-2 text-left text-sm ${
                    a.id === selectedAccountId
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  {a.first_name} {a.last_name}
                  <span className="block text-xs opacity-70">{ROLE_LABELS[a.role] ?? a.role}</span>
                </button>
              ))}
            </div>

            {selectedAccount && (
              <div className="flex flex-1 flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                  {selectedAccount.first_name} {selectedAccount.last_name}
                </h2>
                {poles.map((pole) => (
                  <div key={pole} className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {POLE_LABELS[pole] ?? pole}
                    </h3>
                    {functionalities
                      .filter((f) => f.pole === pole)
                      .map((f) => {
                        const perm = getPermission(selectedAccount.id, f.id);
                        return (
                          <div key={f.id} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-800 dark:text-zinc-200">{FUNCTIONALITY_LABELS[f.name] ?? f.name}</span>
                            <span className="flex gap-4">
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={perm.can_read}
                                  onChange={() => togglePermission(selectedAccount.id, f.id, "can_read")}
                                />
                                Lecture
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={perm.can_write}
                                  onChange={() => togglePermission(selectedAccount.id, f.id, "can_write")}
                                />
                                Écriture
                              </label>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  {savedMessage && <span className="text-sm text-green-700 dark:text-green-400">Enregistré.</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
