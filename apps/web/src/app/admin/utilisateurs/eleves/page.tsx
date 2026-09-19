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
  niveau_vise: string | null;
  status: string;
}
interface ClassRow {
  level: string;
}
interface GuardianResult {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

type TutorMode = "pere" | "mere" | "search" | "new" | "none";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const btnClass =
  "rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export default function ElevesPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; name: string } | null>(null);

  // Élève
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [niveauVise, setNiveauVise] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");

  // Père / Mère
  const [pere, setPere] = useState({ first_name: "", last_name: "", phone: "", address: "", email: "", profession: "", status: "disponible" });
  const [mere, setMere] = useState({ first_name: "", last_name: "", phone: "", address: "", email: "", profession: "", status: "disponible" });

  // Tuteur
  const [tutorMode, setTutorMode] = useState<TutorMode>("none");
  const [tutorRole, setTutorRole] = useState("responsable_principal");
  const [tutorRelationship, setTutorRelationship] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<GuardianResult[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [newTutor, setNewTutor] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  const canUsePere = pere.first_name.trim() && pere.last_name.trim() && pere.phone.trim();
  const canUseMere = mere.first_name.trim() && mere.last_name.trim() && mere.phone.trim();

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

    const [studentsRes, classesRes] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, matricule, niveau_vise, status").eq("school_id", profile.school_id),
      supabase.from("classes").select("level").eq("school_id", profile.school_id),
    ]);

    setStudents(studentsRes.data ?? []);
    setLevels(Array.from(new Set((classesRes.data ?? []).map((c: ClassRow) => c.level))));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Recherche debouncée (mode B)
  useEffect(() => {
    if (tutorMode !== "search" || searchTerm.trim().length < 2 || !schoolId) {
      // Vide les resultats perimes quand la recherche n'est plus active :
      // comportement voulu, pas un effet de bord accidentel.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("guardians")
        .select("id, first_name, last_name, phone")
        .eq("school_id", schoolId)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(10);
      setSearchResults(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, tutorMode, schoolId]);

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
      p_nationality: nationality || null,
      p_address: address || null,
      p_national_id_number: nationalId || null,
      p_niveau_vise: niveauVise || null,
      p_previous_school: previousSchool || null,
      p_pere_first_name: pere.first_name || null,
      p_pere_last_name: pere.last_name || null,
      p_pere_phone: pere.phone || null,
      p_pere_address: pere.address || null,
      p_pere_email: pere.email || null,
      p_pere_profession: pere.profession || null,
      p_pere_status: pere.status,
      p_mere_first_name: mere.first_name || null,
      p_mere_last_name: mere.last_name || null,
      p_mere_phone: mere.phone || null,
      p_mere_address: mere.address || null,
      p_mere_email: mere.email || null,
      p_mere_profession: mere.profession || null,
      p_mere_status: mere.status,
    });

    if (rpcError || !data) {
      setSaving(false);
      setError(rpcError?.message ?? "Erreur creation eleve");
      return;
    }

    const result = data as { student_id: string; pere_id: string | null; mere_id: string | null };

    if (tutorMode !== "none") {
      const params = {
        p_student_id: result.student_id,
        p_school_id: schoolId,
        p_role: tutorRole,
        p_relationship: tutorMode === "pere" ? "Père" : tutorMode === "mere" ? "Mère" : tutorRelationship || null,
        p_guardian_id: tutorMode === "search" ? selectedGuardianId : null,
        p_parent_id: tutorMode === "pere" ? result.pere_id : tutorMode === "mere" ? result.mere_id : null,
        p_new_first_name: tutorMode === "new" ? newTutor.first_name : null,
        p_new_last_name: tutorMode === "new" ? newTutor.last_name : null,
        p_new_phone: tutorMode === "new" ? newTutor.phone : null,
        p_new_email: tutorMode === "new" ? newTutor.email : null,
      };
      const { error: guardianError } = await supabase.rpc("attach_guardian", params);
      if (guardianError) {
        setSaving(false);
        setError(`Élève créé, mais erreur sur le tuteur : ${guardianError.message}`);
        return;
      }
    }

    if (medicalNotes.trim()) {
      await supabase.from("student_medical_profiles").upsert({ student_id: result.student_id, notes: medicalNotes });
    }

    setSaving(false);
    setLastCreated({ id: result.student_id, name: `${firstName} ${lastName}` });

    setFirstName("");
    setLastName("");
    setBirthDate("");
    setBirthPlace("");
    setNationality("");
    setAddress("");
    setNationalId("");
    setNiveauVise("");
    setPreviousSchool("");
    setMedicalNotes("");
    setPere({ first_name: "", last_name: "", phone: "", address: "", email: "", profession: "", status: "disponible" });
    setMere({ first_name: "", last_name: "", phone: "", address: "", email: "", profession: "", status: "disponible" });
    setTutorMode("none");
    setNewTutor({ first_name: "", last_name: "", phone: "", email: "" });
    await loadData();
  }

  async function handlePhoto(studentId: string, file: File) {
    if (!schoolId) return;
    try {
      const path = await uploadPhoto(schoolId, "students", studentId, file);
      await supabase.from("students").update({ photo_path: path }).eq("id", studentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload photo");
    }
  }

  async function handleDocuments(studentId: string, files: FileList) {
    if (!schoolId) return;
    try {
      for (const file of Array.from(files)) {
        const path = await uploadPhoto(schoolId, "documents", `${studentId}-${crypto.randomUUID()}`, file);
        await supabase.from("documents").insert({
          school_id: schoolId,
          entity_type: "student",
          entity_id: studentId,
          document_type: file.name,
          storage_path: path,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload document");
    }
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

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
                {s.niveau_vise ? ` (${s.niveau_vise})` : ""}
              </a>
              <span className="text-xs text-zinc-500">{s.status}</span>
            </li>
          ))}
          {students.length === 0 && <li className="text-zinc-500">Aucun élève.</li>}
        </ul>

        {lastCreated && (
          <div className="flex flex-col gap-2 rounded border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="text-green-800 dark:text-green-200">{lastCreated.name} créé(e). Photo et documents (optionnels) :</p>
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhoto(lastCreated.id, f); }} className="text-sm" />
            <input type="file" multiple onChange={(e) => { if (e.target.files) void handleDocuments(lastCreated.id, e.target.files); }} className="text-sm" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Nouvel élève</h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            <input required type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
            <input required placeholder="Lieu de naissance" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={inputClass} />
            <select required value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
              <option value="">Sexe...</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
            <input placeholder="Nationalité" value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass} />
            <input placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            <input placeholder="N° identifiant national / extrait de naissance" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className={inputClass} />
            <input required list="levels" placeholder="Niveau visé" value={niveauVise} onChange={(e) => setNiveauVise(e.target.value)} className={inputClass} />
            <datalist id="levels">
              {levels.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <input placeholder="École précédente" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className={inputClass} />
          </div>
          <textarea
            placeholder="Allergies / infos médicales (visible uniquement par la direction et l'infirmerie, pas dans le dossier scolaire)"
            value={medicalNotes}
            onChange={(e) => setMedicalNotes(e.target.value)}
            rows={2}
            className={inputClass}
          />

          <hr className="border-zinc-200 dark:border-zinc-800" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Père</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input placeholder="Prénom" value={pere.first_name} onChange={(e) => setPere({ ...pere, first_name: e.target.value })} className={inputClass} />
            <input placeholder="Nom" value={pere.last_name} onChange={(e) => setPere({ ...pere, last_name: e.target.value })} className={inputClass} />
            <input placeholder="Téléphone" value={pere.phone} onChange={(e) => setPere({ ...pere, phone: e.target.value })} className={inputClass} />
            <input placeholder="Email" value={pere.email} onChange={(e) => setPere({ ...pere, email: e.target.value })} className={inputClass} />
            <input placeholder="Profession" value={pere.profession} onChange={(e) => setPere({ ...pere, profession: e.target.value })} className={inputClass} />
            <select value={pere.status} onChange={(e) => setPere({ ...pere, status: e.target.value })} className={inputClass}>
              <option value="disponible">Disponible</option>
              <option value="decede">Décédé</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mère</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input placeholder="Prénom" value={mere.first_name} onChange={(e) => setMere({ ...mere, first_name: e.target.value })} className={inputClass} />
            <input placeholder="Nom" value={mere.last_name} onChange={(e) => setMere({ ...mere, last_name: e.target.value })} className={inputClass} />
            <input placeholder="Téléphone" value={mere.phone} onChange={(e) => setMere({ ...mere, phone: e.target.value })} className={inputClass} />
            <input placeholder="Email" value={mere.email} onChange={(e) => setMere({ ...mere, email: e.target.value })} className={inputClass} />
            <input placeholder="Profession" value={mere.profession} onChange={(e) => setMere({ ...mere, profession: e.target.value })} className={inputClass} />
            <select value={mere.status} onChange={(e) => setMere({ ...mere, status: e.target.value })} className={inputClass}>
              <option value="disponible">Disponible</option>
              <option value="decede">Décédé</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tuteur (optionnel, ajoutable plus tard)</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={tutorMode === "none"} onChange={() => setTutorMode("none")} /> Aucun pour l&apos;instant
            </label>
            <label className={`flex items-center gap-1 ${!canUsePere ? "opacity-40" : ""}`}>
              <input type="radio" disabled={!canUsePere} checked={tutorMode === "pere"} onChange={() => setTutorMode("pere")} /> Le père
            </label>
            <label className={`flex items-center gap-1 ${!canUseMere ? "opacity-40" : ""}`}>
              <input type="radio" disabled={!canUseMere} checked={tutorMode === "mere"} onChange={() => setTutorMode("mere")} /> La mère
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={tutorMode === "search"} onChange={() => setTutorMode("search")} /> Tuteur existant
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={tutorMode === "new"} onChange={() => setTutorMode("new")} /> Nouveau tuteur
            </label>
          </div>

          {tutorMode === "search" && (
            <div className="flex flex-col gap-2">
              <input
                placeholder="Rechercher par nom ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={inputClass}
              />
              <div className="flex flex-col gap-1">
                {searchResults.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 rounded border border-zinc-200 p-2 text-sm dark:border-zinc-800">
                    <input type="radio" name="guardian" checked={selectedGuardianId === g.id} onChange={() => setSelectedGuardianId(g.id)} />
                    {g.first_name} {g.last_name} — {g.phone}
                  </label>
                ))}
                {searchTerm.length >= 2 && searchResults.length === 0 && <p className="text-xs text-zinc-500">Aucun résultat.</p>}
              </div>
            </div>
          )}

          {tutorMode === "new" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input required placeholder="Prénom" value={newTutor.first_name} onChange={(e) => setNewTutor({ ...newTutor, first_name: e.target.value })} className={inputClass} />
              <input required placeholder="Nom" value={newTutor.last_name} onChange={(e) => setNewTutor({ ...newTutor, last_name: e.target.value })} className={inputClass} />
              <input required placeholder="Téléphone" value={newTutor.phone} onChange={(e) => setNewTutor({ ...newTutor, phone: e.target.value })} className={inputClass} />
              <input placeholder="Email" value={newTutor.email} onChange={(e) => setNewTutor({ ...newTutor, email: e.target.value })} className={inputClass} />
              <input placeholder="Lien de parenté (ex. Oncle, Tuteur légal)" value={tutorRelationship} onChange={(e) => setTutorRelationship(e.target.value)} className={inputClass} />
            </div>
          )}

          {tutorMode !== "none" && (
            <select value={tutorRole} onChange={(e) => setTutorRole(e.target.value)} className={inputClass}>
              <option value="responsable_principal">Responsable principal</option>
              <option value="contact_secondaire">Contact secondaire</option>
            </select>
          )}

          <button type="submit" disabled={saving} className={`self-start ${btnClass}`}>
            {saving ? "Création..." : "Créer l'élève"}
          </button>
        </form>
      </div>
    </main>
  );
}
