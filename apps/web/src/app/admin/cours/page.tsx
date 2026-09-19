"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  subject_id: string | null;
}

interface Resource {
  id: string;
  course_id: string;
  type: string;
  title: string;
  content: string | null;
  order_index: number;
}

const RESOURCE_TYPES = ["video", "pdf", "image", "audio", "text", "link", "quiz"] as const;

export default function CoursesPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseSubjectId, setCourseSubjectId] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  const [resourceCourseId, setResourceCourseId] = useState("");
  const [resourceType, setResourceType] = useState<(typeof RESOURCE_TYPES)[number]>("link");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceContent, setResourceContent] = useState("");
  const [savingResource, setSavingResource] = useState(false);

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

    const { data: subjectsData } = await supabase.from("subjects").select("id, name").eq("school_id", profile.school_id);
    setSubjects(subjectsData ?? []);

    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, description, is_published, subject_id")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false });
    setCourses(coursesData ?? []);

    if (coursesData && coursesData.length > 0) {
      const { data: resourcesData } = await supabase
        .from("course_resources")
        .select("id, course_id, type, title, content, order_index")
        .in(
          "course_id",
          coursesData.map((c) => c.id),
        )
        .order("order_index");
      setResources(resourcesData ?? []);
    } else {
      setResources([]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !courseTitle.trim()) return;
    setSavingCourse(true);
    setError(null);

    const { error: insertError } = await supabase.from("courses").insert({
      school_id: schoolId,
      title: courseTitle,
      subject_id: courseSubjectId || null,
      is_published: true,
    });

    setSavingCourse(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCourseTitle("");
    await loadData();
  }

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceCourseId || !resourceTitle.trim()) return;
    setSavingResource(true);
    setError(null);

    const { error: insertError } = await supabase.from("course_resources").insert({
      course_id: resourceCourseId,
      type: resourceType,
      title: resourceTitle,
      content: resourceContent || null,
      order_index: resources.filter((r) => r.course_id === resourceCourseId).length,
    });

    setSavingResource(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setResourceTitle("");
    setResourceContent("");
    await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Cours</h1>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form onSubmit={handleAddCourse} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <input
            required
            placeholder="Titre du cours"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <select
            value={courseSubjectId}
            onChange={(e) => setCourseSubjectId(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Matière (optionnel)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingCourse}
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {savingCourse ? "..." : "Créer le cours"}
          </button>
        </form>

        {courses.map((course) => (
          <div key={course.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{course.title}</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {resources
                .filter((r) => r.course_id === course.id)
                .map((r) => (
                  <li key={r.id} className="text-zinc-600 dark:text-zinc-400">
                    [{r.type}] {r.title}
                    {r.content && (
                      <a href={r.content} target="_blank" className="ml-1 underline">
                        lien
                      </a>
                    )}
                  </li>
                ))}
              {resources.filter((r) => r.course_id === course.id).length === 0 && (
                <li className="text-zinc-500">Aucune ressource.</li>
              )}
            </ul>

            <form
              onSubmit={(e) => {
                setResourceCourseId(course.id);
                handleAddResource(e);
              }}
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as (typeof RESOURCE_TYPES)[number])}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Titre de la ressource"
                value={resourceCourseId === course.id ? resourceTitle : ""}
                onChange={(e) => {
                  setResourceCourseId(course.id);
                  setResourceTitle(e.target.value);
                }}
                className="w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                placeholder="URL / contenu"
                value={resourceCourseId === course.id ? resourceContent : ""}
                onChange={(e) => {
                  setResourceCourseId(course.id);
                  setResourceContent(e.target.value);
                }}
                className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={savingResource}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {savingResource ? "..." : "Ajouter"}
              </button>
            </form>
          </div>
        ))}
        {courses.length === 0 && <p className="text-sm text-zinc-500">Aucun cours.</p>}
      </div>
    </main>
  );
}
