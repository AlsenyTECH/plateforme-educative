"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}
interface Subject {
  id: string;
  name: string;
}

export default function EnseignantsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<{ teacher_id: string; subject_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

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

    const [teachersRes, subjectsRes] = await Promise.all([
      supabase.from("teachers").select("id, first_name, last_name, email, phone").eq("school_id", profile.school_id),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
    ]);

    setTeachers(teachersRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);

    if (teachersRes.data && teachersRes.data.length > 0) {
      const { data: tsData } = await supabase
        .from("teacher_subjects")
        .select("teacher_id, subject_id")
        .in("teacher_id", teachersRes.data.map((t) => t.id));
      setTeacherSubjects(tsData ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || selectedSubjects.length === 0) return;
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("teachers")
      .insert({ school_id: schoolId, first_name: firstName, last_name: lastName, email: email || null, phone: phone || null })
      .select("id")
      .single();

    if (insertError || !data) {
      setSaving(false);
      setError(insertError?.message ?? "Erreur");
      return;
    }

    const { error: linkError } = await supabase
      .from("teacher_subjects")
      .insert(selectedSubjects.map((subject_id) => ({ teacher_id: data.id, subject_id })));

    setSaving(false);

    if (linkError) {
      setError(linkError.message);
      return;
    }

    setLastCreatedId(data.id);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSelectedSubjects([]);
    await loadData();
  }

  async function handlePhoto(teacherId: string, file: File) {
    if (!schoolId) return;
    try {
      const path = await uploadPhoto(schoolId, "teachers", teacherId, file);
      await supabase.from("teachers").update({ photo_path: path }).eq("id", teacherId);
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Enseignants</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-1 text-sm">
          {teachers.map((t) => (
            <li key={t.id} className="rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-zinc-900 dark:text-zinc-50">
                {t.first_name} {t.last_name}
              </p>
              <p className="text-xs text-zinc-500">
                {teacherSubjects.filter((ts) => ts.teacher_id === t.id).map((ts) => subjects.find((s) => s.id === ts.subject_id)?.name).join(", ") || "Aucune matière"}
              </p>
            </li>
          ))}
          {teachers.length === 0 && <li className="text-zinc-500">Aucun enseignant.</li>}
        </ul>

        {lastCreatedId && (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="mb-2 text-green-800 dark:text-green-200">Enseignant créé. Ajouter une photo ?</p>
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
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Nouvel enseignant</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300">Matières enseignées</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(s.id)}
                  onChange={(e) =>
                    setSelectedSubjects((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                  }
                />
                {s.name}
              </label>
            ))}
            {subjects.length === 0 && <p className="text-sm text-zinc-500">Crée d&apos;abord des matières dans les réglages école.</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Création..." : "Créer l'enseignant"}
          </button>
        </form>
      </div>
    </main>
  );
}
