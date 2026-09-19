"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string | null;
  status: string;
}
interface ClassRow {
  id: string;
  name: string;
}
interface Guardian {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export default function ElevesPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [classId, setClassId] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  const [guardianMode, setGuardianMode] = useState<"existing" | "new">("new");
  const [existingGuardianId, setExistingGuardianId] = useState("");
  const [guardianFirstName, setGuardianFirstName] = useState("");
  const [guardianLastName, setGuardianLastName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [relationship, setRelationship] = useState("Père");

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

    const [studentsRes, classesRes, guardiansRes] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, matricule, status").eq("school_id", profile.school_id),
      supabase.from("classes").select("id, name").eq("school_id", profile.school_id),
      supabase.from("guardians").select("id, first_name, last_name, phone").eq("school_id", profile.school_id),
    ]);

    setStudents(studentsRes.data ?? []);
    setClasses(classesRes.data ?? []);
    setGuardians(guardiansRes.data ?? []);
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

    const { data, error: rpcError } = await supabase.rpc("create_student", {
      p_school_id: schoolId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_birth_date: birthDate || null,
      p_birth_place: birthPlace || null,
      p_gender: gender || null,
      p_address: address || null,
      p_class_id: classId || null,
      p_academic_year: academicYear,
      p_guardian_id: guardianMode === "existing" ? existingGuardianId : null,
      p_new_guardian_first_name: guardianMode === "new" ? guardianFirstName : null,
      p_new_guardian_last_name: guardianMode === "new" ? guardianLastName : null,
      p_new_guardian_phone: guardianMode === "new" ? guardianPhone : null,
      p_relationship: relationship,
    });

    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setLastCreatedId(data as string);
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setBirthPlace("");
    setAddress("");
    setGuardianFirstName("");
    setGuardianLastName("");
    setGuardianPhone("");
    await loadData();
  }

  async function handlePhoto(studentId: string, file: File) {
    if (!schoolId) return;
    try {
      const path = await uploadPhoto(schoolId, "students", studentId, file);
      await supabase.from("students").update({ photo_path: path }).eq("id", studentId);
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Élèves</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-1 text-sm">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <a href={`/admin/eleves/${s.id}`} className="text-zinc-900 underline dark:text-zinc-50">
                {s.matricule ? `${s.matricule} — ` : ""}
                {s.first_name} {s.last_name}
              </a>
              <span className="text-xs text-zinc-500">{s.status}</span>
            </li>
          ))}
          {students.length === 0 && <li className="text-zinc-500">Aucun élève.</li>}
        </ul>

        {lastCreatedId && (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="mb-2 text-green-800 dark:text-green-200">Élève créé. Ajouter une photo ?</p>
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Nouvel élève</h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            <input type="date" placeholder="Date de naissance" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
            <input placeholder="Lieu de naissance" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={inputClass} />
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
              <option value="">Sexe...</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
            <input placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            <select required value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              <option value="">Classe...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input placeholder="Année scolaire" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputClass} />
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tuteur</p>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={guardianMode === "new"} onChange={() => setGuardianMode("new")} />
              Nouveau tuteur
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={guardianMode === "existing"} onChange={() => setGuardianMode("existing")} />
              Tuteur existant
            </label>
          </div>

          {guardianMode === "new" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input required placeholder="Prénom du tuteur" value={guardianFirstName} onChange={(e) => setGuardianFirstName(e.target.value)} className={inputClass} />
              <input required placeholder="Nom du tuteur" value={guardianLastName} onChange={(e) => setGuardianLastName(e.target.value)} className={inputClass} />
              <input required placeholder="Téléphone" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <select required value={existingGuardianId} onChange={(e) => setExistingGuardianId(e.target.value)} className={inputClass}>
              <option value="">Choisir un tuteur...</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.first_name} {g.last_name} — {g.phone}
                </option>
              ))}
            </select>
          )}

          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClass}>
            <option value="Père">Père</option>
            <option value="Mère">Mère</option>
            <option value="Tuteur légal">Tuteur légal</option>
            <option value="Autre">Autre</option>
          </select>

          <button
            type="submit"
            disabled={saving}
            className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Création..." : "Créer l'élève"}
          </button>
        </form>
      </div>
    </main>
  );
}
