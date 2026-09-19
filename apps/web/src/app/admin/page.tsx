"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

interface Profile {
  role: string;
  school_id: string | null;
  first_name: string;
  last_name: string;
}

interface School {
  id: string;
  name: string;
  slug: string;
  card_public_key: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface CardResult {
  token: string;
  qrDataUrl: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Admission {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  desired_level: string | null;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_email: string;
  guardian_phone: string | null;
  status: "pending" | "accepted" | "rejected";
  submitted_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [cardResults, setCardResults] = useState<Record<string, CardResult>>({});
  const [issuingFor, setIssuingFor] = useState<string | null>(null);
  const [issuingKeys, setIssuingKeys] = useState(false);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [decidingFor, setDecidingFor] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const userId = sessionData.session.user.id;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, school_id, first_name, last_name")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      router.push("/onboarding");
      return;
    }
    setProfile(profileData);

    if (!profileData.school_id) {
      setError("Ce compte parent n'est rattache a aucune ecole (normal si aucun enfant n'est encore inscrit).");
      setLoading(false);
      return;
    }

    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, slug, card_public_key")
      .eq("id", profileData.school_id)
      .single();

    if (schoolError || !schoolData) {
      setError("Ecole introuvable.");
      setLoading(false);
      return;
    }
    setSchool(schoolData);

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("school_id", profileData.school_id);

    if (studentsError) {
      setError("Impossible de charger les eleves.");
      setLoading(false);
      return;
    }
    setStudents(studentsData ?? []);

    const { data: admissionsData } = await supabase
      .from("admissions")
      .select(
        "id, candidate_first_name, candidate_last_name, desired_level, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, status, submitted_at",
      )
      .eq("school_id", profileData.school_id)
      .order("submitted_at", { ascending: false });
    setAdmissions(admissionsData ?? []);

    const { data: subjectsData } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", profileData.school_id)
      .order("name");
    setSubjects(subjectsData ?? []);

    setLoading(false);
  }, [router]);

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !newSubjectName.trim()) return;
    setSavingSubject(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("subjects")
      .insert({ school_id: school.id, name: newSubjectName.trim() });

    setSavingSubject(false);

    if (insertError) {
      setError(`Erreur ajout matiere : ${insertError.message}`);
      return;
    }

    setNewSubjectName("");
    await loadData();
  }

  async function handleAdmissionDecision(admissionId: string, status: "accepted" | "rejected") {
    setDecidingFor(admissionId);
    setError(null);

    const { error: updateError } = await supabase
      .from("admissions")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", admissionId);

    setDecidingFor(null);

    if (updateError) {
      setError(`Erreur decision admission : ${updateError.message}`);
      return;
    }

    await loadData();
  }

  useEffect(() => {
    // Chargement au montage : le rendu en cascade que la regle signale est le
    // comportement voulu ici (etat "loading" puis donnees), pas un bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleInitKeys() {
    if (!school) return;
    setIssuingKeys(true);
    setError(null);

    const { error: fnError } = await supabase.functions.invoke("issue-school-keys", {
      body: { school_id: school.id },
    });

    setIssuingKeys(false);

    if (fnError) {
      setError(`Erreur cles ecole : ${fnError.message}`);
      return;
    }

    await loadData();
  }

  async function handleIssueCard(studentId: string) {
    setIssuingFor(studentId);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("issue-card", {
      body: { student_id: studentId },
    });

    setIssuingFor(null);

    if (fnError || !data?.token) {
      setError(`Erreur emission carte : ${fnError?.message ?? "reponse invalide"}`);
      return;
    }

    const qrDataUrl = await QRCode.toDataURL(data.token, { width: 220 });
    setCardResults((prev) => ({ ...prev, [studentId]: { token: data.token, qrDataUrl } }));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {school?.name ?? "Administration"}
          </h1>
          {profile && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connecte en tant que {profile.first_name} {profile.last_name} ({profile.role})
            </p>
          )}
          {school && (
            <a href={`/ecoles/${school.slug}`} className="text-sm text-zinc-500 underline" target="_blank">
              Voir la vitrine publique /ecoles/{school.slug}
            </a>
          )}
        </header>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {school && !school.card_public_key && (
          <div className="rounded border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="mb-2 text-sm text-amber-800 dark:text-amber-200">
              Cette ecole n&apos;a pas encore de cle de signature. Aucune carte ne peut etre emise avant ca.
            </p>
            <button
              onClick={handleInitKeys}
              disabled={issuingKeys}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {issuingKeys ? "Generation..." : "Initialiser les cles de l'ecole"}
            </button>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Demandes d&apos;admission</h2>

          {admissions.filter((a) => a.status === "pending").length === 0 && (
            <p className="text-sm text-zinc-500">Aucune demande en attente.</p>
          )}

          {admissions
            .filter((a) => a.status === "pending")
            .map((admission) => (
              <div
                key={admission.id}
                className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-zinc-900 dark:text-zinc-50">
                    {admission.candidate_first_name} {admission.candidate_last_name}
                    {admission.desired_level ? ` — ${admission.desired_level}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Tuteur : {admission.guardian_first_name} {admission.guardian_last_name} ·{" "}
                    {admission.guardian_email}
                    {admission.guardian_phone ? ` · ${admission.guardian_phone}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdmissionDecision(admission.id, "accepted")}
                    disabled={decidingFor === admission.id}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => handleAdmissionDecision(admission.id, "rejected")}
                    disabled={decidingFor === admission.id}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Matières</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {s.name}
              </span>
            ))}
            {subjects.length === 0 && <p className="text-sm text-zinc-500">Aucune matière.</p>}
          </div>
          <form onSubmit={handleAddSubject} className="flex gap-2">
            <input
              placeholder="ex. Mathématiques"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={savingSubject}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingSubject ? "..." : "Ajouter"}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Eleves</h2>

          {students.length === 0 && <p className="text-sm text-zinc-500">Aucun eleve pour le moment.</p>}

          {students.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
            >
              <a href={`/admin/eleves/${student.id}`} className="text-zinc-900 underline dark:text-zinc-50">
                {student.first_name} {student.last_name}
              </a>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleIssueCard(student.id)}
                  disabled={issuingFor === student.id || !school?.card_public_key}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {issuingFor === student.id ? "Emission..." : "Emettre une carte"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {Object.entries(cardResults).map(([studentId, result]) => {
          const student = students.find((s) => s.id === studentId);
          return (
            <div
              key={studentId}
              className="flex flex-col items-center gap-2 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Carte de {student ? `${student.first_name} ${student.last_name}` : studentId}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.qrDataUrl} alt="QR code de la carte scolaire" width={220} height={220} />
              <code className="max-w-full break-all text-xs text-zinc-500">{result.token}</code>
            </div>
          );
        })}
      </div>
    </main>
  );
}
