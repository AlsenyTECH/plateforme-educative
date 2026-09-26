"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Assignment {
  class_id: string;
  subject_id: string;
}
interface ClassRow {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
}
interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
}
interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string;
}
interface Announcement {
  id: string;
  title: string;
  body: string;
}

const DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function ProfesseurPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, first_name, last_name")
      .eq("id", sessionData.session.user.id)
      .single();

    if (!profile?.school_id) {
      setError("Aucune école rattachée à ce compte.");
      setLoading(false);
      return;
    }
    setName(`${profile.first_name} ${profile.last_name}`);

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", sessionData.session.user.id)
      .maybeSingle();

    if (!teacher) {
      setError("Aucune fiche enseignant n'est reliée à ce compte. Contacte l'administration de l'école.");
      setLoading(false);
      return;
    }

    const [assignmentsRes, timetableRes, announcementsRes, subjectsRes, classesRes] = await Promise.all([
      supabase.from("teacher_assignments").select("class_id, subject_id").eq("teacher_id", teacher.id),
      supabase
        .from("timetable_entries")
        .select("id, class_id, subject_id, day_of_week, start_time, end_time, room")
        .eq("teacher_id", teacher.id)
        .order("day_of_week")
        .order("start_time"),
      supabase.from("announcements").select("id, title, body").eq("school_id", profile.school_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
      supabase.from("classes").select("id, name").eq("school_id", profile.school_id),
    ]);

    const assignmentsData = assignmentsRes.data ?? [];
    setAssignments(assignmentsData);
    setTimetable(timetableRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setClasses(classesRes.data ?? []);

    const classIds = Array.from(new Set(assignmentsData.map((a) => a.class_id)));
    if (classIds.length > 0) {
      const { data: enrolled } = await supabase
        .from("enrollments")
        .select("class_id, students(id, first_name, last_name)")
        .in("class_id", classIds)
        .eq("status", "active");

      interface EnrollRow {
        class_id: string;
        students: { id: string; first_name: string; last_name: string } | null;
      }

      const studentRows = ((enrolled ?? []) as unknown as EnrollRow[])
        .filter((e) => e.students !== null)
        .map((e) => ({ id: e.students!.id, first_name: e.students!.first_name, last_name: e.students!.last_name, class_id: e.class_id }));
      setStudents(studentRows);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? "?";
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "?";
  const myClassIds = Array.from(new Set(assignments.map((a) => a.class_id)));

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Bonjour {name}</h1>
          <button onClick={handleLogout} className="text-sm text-zinc-500 underline">
            Se déconnecter
          </button>
        </header>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Mes classes et matières</h2>
          <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {assignments.map((a, i) => (
              <li key={i}>
                {className(a.class_id)} — {subjectName(a.subject_id)}
              </li>
            ))}
            {assignments.length === 0 && <li className="text-zinc-500">Aucune affectation pour le moment.</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Mon emploi du temps</h2>
          <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {timetable.map((t) => (
              <li key={t.id}>
                {DAYS[t.day_of_week]} {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)} — {className(t.class_id)} ({subjectName(t.subject_id)})
                {t.room ? ` · ${t.room}` : ""}
              </li>
            ))}
            {timetable.length === 0 && <li className="text-zinc-500">Aucun cours programmé.</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Mes élèves</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Clique sur un élève pour saisir ses notes ou absences.
          </p>
          <div className="flex flex-col gap-3">
            {myClassIds.map((classId) => (
              <div key={classId}>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{className(classId)}</p>
                <ul className="ml-2 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {students
                    .filter((s) => s.class_id === classId)
                    .map((s) => (
                      <li key={s.id}>
                        <a href={`/admin/eleves/${s.id}`} className="underline">
                          {s.first_name} {s.last_name}
                        </a>
                      </li>
                    ))}
                  {students.filter((s) => s.class_id === classId).length === 0 && (
                    <li className="text-zinc-500">Aucun élève inscrit.</li>
                  )}
                </ul>
              </div>
            ))}
            {myClassIds.length === 0 && <p className="text-sm text-zinc-500">Aucune classe assignée.</p>}
          </div>
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
    </main>
  );
}
