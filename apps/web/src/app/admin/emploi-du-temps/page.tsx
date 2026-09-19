"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ClassRow {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
}
interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}
interface Assignment {
  teacher_id: string;
  class_id: string;
  subject_id: string;
}
interface Entry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}

const DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function TimetablePage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

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

    const [classesRes, subjectsRes, teachersRes, entriesRes] = await Promise.all([
      supabase.from("classes").select("id, name").eq("school_id", profile.school_id),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
      supabase.from("teachers").select("id, first_name, last_name").eq("school_id", profile.school_id),
      supabase
        .from("timetable_entries")
        .select("id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room")
        .eq("school_id", profile.school_id)
        .order("day_of_week")
        .order("start_time"),
    ]);

    setClasses(classesRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setTeachers(teachersRes.data ?? []);
    setEntries(entriesRes.data ?? []);

    if (teachersRes.data && teachersRes.data.length > 0) {
      const { data: assignmentsData } = await supabase
        .from("teacher_assignments")
        .select("teacher_id, class_id, subject_id")
        .in("teacher_id", teachersRes.data.map((t) => t.id));
      setAssignments(assignmentsData ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !classId || !subjectId) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("timetable_entries").insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId || null,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
      room: room || null,
    });

    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Conflit : ce créneau est déjà pris pour cette classe ou ce professeur."
          : insertError.message,
      );
      return;
    }
    await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  const inputClass =
    "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Emploi du temps</h1>
        <p className="text-xs text-zinc-500">
          Saisie manuelle avec détection de conflit basique (classe ou professeur déjà occupé sur le créneau). La
          génération automatique est un chantier séparé.
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <select required value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
            <option value="">Classe...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
            <option value="">Matière...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputClass}>
            <option value="">Prof (optionnel)...</option>
            {teachers
              .filter(
                (t) =>
                  !classId ||
                  !subjectId ||
                  assignments.some((a) => a.teacher_id === t.id && a.class_id === classId && a.subject_id === subjectId),
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={inputClass}>
            {DAYS.slice(1).map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          <input placeholder="Salle" value={room} onChange={(e) => setRoom(e.target.value)} className={`w-20 ${inputClass}`} />
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "..." : "Ajouter"}
          </button>
        </form>

        {DAYS.slice(1).map((dayName, i) => {
          const dayEntries = entries.filter((e) => e.day_of_week === i + 1);
          if (dayEntries.length === 0) return null;
          return (
            <div key={dayName}>
              <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">{dayName}</h2>
              <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                {dayEntries.map((e) => (
                  <li key={e.id}>
                    {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)} · {classes.find((c) => c.id === e.class_id)?.name} ·{" "}
                    {subjects.find((s) => s.id === e.subject_id)?.name}
                    {e.teacher_id && (() => {
                      const t = teachers.find((tc) => tc.id === e.teacher_id);
                      return t ? ` · ${t.first_name} ${t.last_name}` : "";
                    })()}
                    {e.room ? ` · salle ${e.room}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
