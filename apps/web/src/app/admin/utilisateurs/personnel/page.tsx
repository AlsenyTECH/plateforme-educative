"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inviteAccount } from "@/lib/invite";

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
}

export default function PersonnelPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", sessionData.session.user.id)
      .single();

    if (!profile?.school_id) {
      setError("Aucune ecole rattachee a ce compte.");
      setLoading(false);
      return;
    }
    setSchoolId(profile.school_id);

    const { data } = await supabase
      .from("staff_members")
      .select("id, first_name, last_name, position, email, phone, profile_id")
      .eq("school_id", profile.school_id);
    setStaff(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("staff_members")
      .insert({ school_id: schoolId, first_name: firstName, last_name: lastName, position, email: email || null, phone: phone || null })
      .select("id")
      .single();

    setSaving(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Erreur");
      return;
    }

    setLastCreatedId(data.id);
    setFirstName("");
    setLastName("");
    setPosition("");
    setEmail("");
    setPhone("");
    await loadData();
  }

  async function handleInvite(staffId: string) {
    if (!inviteEmail.trim()) return;
    setInvitePending(true);
    setError(null);
    try {
      const link = await inviteAccount("staff_member", staffId, inviteEmail.trim());
      setInviteLinks((prev) => ({ ...prev, [staffId]: link }));
      setInvitingId(null);
      setInviteEmail("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'invitation");
    } finally {
      setInvitePending(false);
    }
  }

  async function handlePhoto(staffId: string, file: File) {
    if (!schoolId) return;
    try {
      const path = await uploadPhoto(schoolId, "staff", staffId, file);
      await supabase.from("staff_members").update({ photo_path: path }).eq("id", staffId);
      setLastCreatedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload photo");
    }
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  const inputClass =
    "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin/utilisateurs" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Personnel administratif</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-1 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-900 dark:text-zinc-50">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs text-zinc-500">{s.position}</p>
                </div>
                {s.profile_id ? (
                  <span className="text-xs text-green-700 dark:text-green-400">Compte actif</span>
                ) : invitingId === s.id ? null : (
                  <button
                    onClick={() => {
                      setInvitingId(s.id);
                      setInviteEmail(s.email ?? "");
                    }}
                    className="text-xs underline"
                  >
                    Inviter
                  </button>
                )}
              </div>

              {invitingId === s.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <input
                    type="email"
                    required
                    placeholder="Email de connexion"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    onClick={() => void handleInvite(s.id)}
                    disabled={invitePending}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {invitePending ? "..." : "Envoyer l'invitation"}
                  </button>
                  <button onClick={() => setInvitingId(null)} className="text-xs underline">
                    Annuler
                  </button>
                </div>
              )}

              {inviteLinks[s.id] && (
                <div className="mt-2 rounded bg-green-50 p-2 text-xs dark:bg-green-950">
                  <p className="mb-1 text-green-800 dark:text-green-200">
                    Compte créé. Envoie ce lien à {s.first_name} (WhatsApp, SMS...) pour qu&apos;il/elle définisse son mot de passe :
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-white px-2 py-1 dark:bg-zinc-900">{inviteLinks[s.id]}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteLinks[s.id] ?? "")}
                      className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {staff.length === 0 && <li className="text-zinc-500">Aucun membre du personnel.</li>}
        </ul>

        {lastCreatedId && (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="mb-2 text-green-800 dark:text-green-200">Membre créé. Ajouter une photo ?</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhoto(lastCreatedId, file);
              }}
              className="text-sm"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Nouveau membre du personnel</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            <input required placeholder="Fonction (ex. Surveillant général)" value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Création..." : "Créer"}
          </button>
        </form>
      </div>
    </main>
  );
}
