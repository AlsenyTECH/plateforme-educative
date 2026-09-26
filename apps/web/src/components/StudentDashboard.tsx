"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  status: string;
  note: string | null;
}
interface TimetableEntry {
  id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}
interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}
interface Subject {
  id: string;
  name: string;
}

const DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const STATUS_LABELS: Record<string, string> = {
  absent: "Absent",
  retard: "Retard",
  excusee: "Excusée",
};

export default function StudentDashboard({ studentId, schoolId }: { studentId: string; schoolId: string }) {
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState<string | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("class_id, classes(name), academic_years!inner(active)")
      .eq("student_id", studentId)
      .eq("status", "active")
      .eq("academic_years.active", true)
      .maybeSingle();

    const classId = enrollment?.class_id ?? null;
    setClassName((enrollment as unknown as { classes: { name: string } | null })?.classes?.name ?? null);

    const [gradesRes, absencesRes, timetableRes, announcementsRes, subjectsRes] = await Promise.all([
      supabase
        .from("grades")
        .select("id, subject_id, label, score, max_score, graded_at")
        .eq("student_id", studentId)
        .order("graded_at", { ascending: false }),
      supabase
        .from("absences")
        .select("id, date, status, note")
        .eq("student_id", studentId)
        .order("date", { ascending: false }),
      classId
        ? supabase
            .from("timetable_entries")
            .select("id, subject_id, day_of_week, start_time, end_time, room")
            .eq("class_id", classId)
            .order("day_of_week")
            .order("start_time")
        : Promise.resolve({ data: [] }),
      supabase.from("announcements").select("id, title, body, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId),
    ]);

    setGrades(gradesRes.data ?? []);
    setAbsences(absencesRes.data ?? []);
    setTimetable((timetableRes as { data: TimetableEntry[] | null }).data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setLoading(false);
  }, [studentId, schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  if (loading) return <p className="text-sm text-zinc-500">Chargement...</p>;

  const average = grades.length ? grades.reduce((sum, g) => sum + (g.score / g.max_score) * 20, 0) / grades.length : null;
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "?";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Notes {className ? `— ${className}` : ""}</h2>
        {average !== null && (
          <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Moyenne générale : {average.toFixed(1)}/20</p>
        )}
        <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {grades.map((g) => (
            <li key={g.id} className="flex justify-between">
              <span>
                {subjectName(g.subject_id)} — {g.label}
              </span>
              <span>
                {g.score}/{g.max_score} · {g.graded_at.slice(0, 10)}
              </span>
            </li>
          ))}
          {grades.length === 0 && <li className="text-zinc-500">Aucune note pour le moment.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Absences</h2>
        <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {absences.map((a) => (
            <li key={a.id}>
              {a.date} — {STATUS_LABELS[a.status] ?? a.status}
              {a.note ? ` (${a.note})` : ""}
            </li>
          ))}
          {absences.length === 0 && <li className="text-zinc-500">Aucune absence enregistrée.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Emploi du temps</h2>
        {!className && <p className="text-sm text-zinc-500">Pas encore inscrit dans une classe.</p>}
        <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {timetable.map((t) => (
            <li key={t.id}>
              {DAYS[t.day_of_week]} {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)} — {subjectName(t.subject_id)}
              {t.room ? ` (${t.room})` : ""}
            </li>
          ))}
          {className && timetable.length === 0 && <li className="text-zinc-500">Aucun cours programmé.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Annonces</h2>
        <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {announcements.map((a) => (
            <li key={a.id}>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{a.title}</p>
              <p>{a.body}</p>
            </li>
          ))}
          {announcements.length === 0 && <li className="text-zinc-500">Aucune annonce.</li>}
        </ul>
      </section>
    </div>
  );
}
