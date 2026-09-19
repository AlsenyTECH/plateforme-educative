"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Student {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Grade {
  id: string;
  subject_id: string;
  label: string;
  score: number;
  max_score: number;
  graded_at: string;
}

interface Absence {
  id: string;
  date: string;
  status: "absent" | "retard" | "excusee";
  note: string | null;
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);

  const [gradeSubjectId, setGradeSubjectId] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [gradeScore, setGradeScore] = useState("");
  const [gradeMax, setGradeMax] = useState("20");
  const [savingGrade, setSavingGrade] = useState(false);

  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceStatus, setAbsenceStatus] = useState<Absence["status"]>("absent");
  const [savingAbsence, setSavingAbsence] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("id, school_id, first_name, last_name")
      .eq("id", studentId)
      .single();

    if (studentError || !studentData) {
      setError("Eleve introuvable ou non accessible.");
      setLoading(false);
      return;
    }
    setStudent(studentData);

    const { data: subjectsData } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", studentData.school_id)
      .order("name");
    setSubjects(subjectsData ?? []);

    const { data: gradesData } = await supabase
      .from("grades")
      .select("id, subject_id, label, score, max_score, graded_at")
      .eq("student_id", studentId)
      .order("graded_at", { ascending: false });
    setGrades(gradesData ?? []);

    const { data: absencesData } = await supabase
      .from("absences")
      .select("id, date, status, note")
      .eq("student_id", studentId)
      .order("date", { ascending: false });
    setAbsences(absencesData ?? []);

    setLoading(false);
  }, [router, studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleAddGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !gradeSubjectId) return;
    setSavingGrade(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();

    const { error: insertError } = await supabase.from("grades").insert({
      school_id: student.school_id,
      student_id: student.id,
      subject_id: gradeSubjectId,
      teacher_profile_id: sessionData.session?.user.id,
      label: gradeLabel || "Note",
      score: Number(gradeScore),
      max_score: Number(gradeMax) || 20,
    });

    setSavingGrade(false);

    if (insertError) {
      setError(`Erreur ajout note : ${insertError.message}`);
      return;
    }

    setGradeLabel("");
    setGradeScore("");
    await loadData();
  }

  async function handleAddAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !absenceDate) return;
    setSavingAbsence(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();

    const { error: upsertError } = await supabase.from("absences").upsert(
      {
        school_id: student.school_id,
        student_id: student.id,
        date: absenceDate,
        status: absenceStatus,
        reported_by: sessionData.session?.user.id,
      },
      { onConflict: "student_id,date" },
    );

    setSavingAbsence(false);

    if (upsertError) {
      setError(`Erreur ajout absence : ${upsertError.message}`);
      return;
    }

    setAbsenceDate("");
    await loadData();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Chargement...</p>
      </main>
    );
  }

  const average =
    grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / grades.length
      : null;

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {student && (
          <header>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {student.first_name} {student.last_name}
            </h1>
            {average !== null && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Moyenne générale : {average.toFixed(1)}/20</p>
            )}
          </header>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Notes</h2>

          <ul className="flex flex-col gap-1 text-sm">
            {grades.map((g) => (
              <li key={g.id} className="flex justify-between text-zinc-700 dark:text-zinc-300">
                <span>
                  {subjects.find((s) => s.id === g.subject_id)?.name ?? "?"} — {g.label} ({g.graded_at})
                </span>
                <span className="font-mono">
                  {g.score}/{g.max_score}
                </span>
              </li>
            ))}
            {grades.length === 0 && <li className="text-zinc-500">Aucune note.</li>}
          </ul>

          <form onSubmit={handleAddGrade} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <select
              required
              value={gradeSubjectId}
              onChange={(e) => setGradeSubjectId(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Matière...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Intitulé"
              value={gradeLabel}
              onChange={(e) => setGradeLabel(e.target.value)}
              className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <input
              required
              type="number"
              step="0.25"
              placeholder="Note"
              value={gradeScore}
              onChange={(e) => setGradeScore(e.target.value)}
              className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <span className="text-sm text-zinc-500">/</span>
            <input
              type="number"
              value={gradeMax}
              onChange={(e) => setGradeMax(e.target.value)}
              className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={savingGrade || subjects.length === 0}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingGrade ? "..." : "Ajouter"}
            </button>
          </form>
          {subjects.length === 0 && (
            <p className="text-xs text-amber-600">Aucune matière créée pour cette école — ajoute-en une depuis /admin.</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Absences</h2>

          <ul className="flex flex-col gap-1 text-sm">
            {absences.map((a) => (
              <li key={a.id} className="flex justify-between text-zinc-700 dark:text-zinc-300">
                <span>{a.date}</span>
                <span>{a.status}</span>
              </li>
            ))}
            {absences.length === 0 && <li className="text-zinc-500">Aucune absence enregistrée.</li>}
          </ul>

          <form onSubmit={handleAddAbsence} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <input
              required
              type="date"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <select
              value={absenceStatus}
              onChange={(e) => setAbsenceStatus(e.target.value as Absence["status"])}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="absent">Absent</option>
              <option value="retard">Retard</option>
              <option value="excusee">Excusée</option>
            </select>
            <button
              type="submit"
              disabled={savingAbsence}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingAbsence ? "..." : "Enregistrer"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
