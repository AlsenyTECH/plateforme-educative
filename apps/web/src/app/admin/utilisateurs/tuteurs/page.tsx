"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Guardian {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  profession: string | null;
}
interface Link {
  guardian_id: string;
  relationship: string | null;
  students: { first_name: string; last_name: string } | null;
}

export default function TuteursPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");

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

    const { data: guardiansData } = await supabase
      .from("guardians")
      .select("id, first_name, last_name, phone, email, profession")
      .eq("school_id", profile.school_id);
    setGuardians(guardiansData ?? []);

    if (guardiansData && guardiansData.length > 0) {
      const { data: linksData } = await supabase
        .from("student_guardians")
        .select("guardian_id, relationship, students(first_name, last_name)")
        .in("guardian_id", guardiansData.map((g) => g.id));
      setLinks((linksData as unknown as Link[]) ?? []);
    }

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

    const { error: insertError } = await supabase
      .from("guardians")
      .insert({ school_id: schoolId, first_name: firstName, last_name: lastName, phone, profession: profession || null });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setFirstName("");
    setLastName("");
    setPhone("");
    setProfession("");
    await loadData();
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tuteurs</h1>
        <p className="text-xs text-zinc-500">
          En général créés directement depuis la fiche d&apos;un élève — ce formulaire sert pour un tuteur sans élève
          associé pour le moment.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-1 text-sm">
          {guardians.map((g) => {
            const kids = links.filter((l) => l.guardian_id === g.id);
            return (
              <li key={g.id} className="rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-zinc-900 dark:text-zinc-50">
                  {g.first_name} {g.last_name} — {g.phone}
                </p>
                <p className="text-xs text-zinc-500">
                  {kids.length > 0
                    ? kids.map((k) => `${k.students?.first_name} ${k.students?.last_name} (${k.relationship})`).join(", ")
                    : "Aucun élève lié"}
                </p>
              </li>
            );
          })}
          {guardians.length === 0 && <li className="text-zinc-500">Aucun tuteur.</li>}
        </ul>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Nouveau tuteur</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            <input required placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            <input placeholder="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} className={inputClass} />
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
