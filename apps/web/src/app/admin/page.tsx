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
      setError("Profil introuvable.");
      setLoading(false);
      return;
    }
    setProfile(profileData);

    if (!profileData.school_id) {
      setError("Ce compte n'est rattache a aucune ecole.");
      setLoading(false);
      return;
    }

    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, card_public_key")
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

    setLoading(false);
  }, [router]);

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
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Eleves</h2>

          {students.length === 0 && <p className="text-sm text-zinc-500">Aucun eleve pour le moment.</p>}

          {students.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-zinc-900 dark:text-zinc-50">
                {student.first_name} {student.last_name}
              </span>

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
