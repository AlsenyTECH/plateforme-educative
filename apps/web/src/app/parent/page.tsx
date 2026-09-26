"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudentDashboard from "@/components/StudentDashboard";

interface Child {
  student_id: string;
  school_id: string;
  first_name: string;
  last_name: string;
}

export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", sessionData.session.user.id)
      .single();
    setName(profile ? `${profile.first_name} ${profile.last_name}` : "");

    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("profile_id", sessionData.session.user.id)
      .maybeSingle();

    if (!guardian) {
      setError("Aucune fiche tuteur n'est reliée à ce compte. Contacte l'administration de l'école.");
      setLoading(false);
      return;
    }

    const { data: links } = await supabase
      .from("student_guardians")
      .select("students(id, school_id, first_name, last_name)")
      .eq("guardian_id", guardian.id);

    interface LinkRow {
      students: { id: string; school_id: string; first_name: string; last_name: string } | null;
    }

    const kids = ((links ?? []) as unknown as LinkRow[])
      .map((l) => l.students)
      .filter((s): s is NonNullable<LinkRow["students"]> => s !== null)
      .map((s) => ({ student_id: s.id, school_id: s.school_id, first_name: s.first_name, last_name: s.last_name }));

    setChildren(kids);
    setSelectedStudentId((prev) => prev ?? kids[0]?.student_id ?? null);
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

  const selectedChild = children.find((c) => c.student_id === selectedStudentId);

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

        {children.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.student_id}
                onClick={() => setSelectedStudentId(c.student_id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  c.student_id === selectedStudentId
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                }`}
              >
                {c.first_name} {c.last_name}
              </button>
            ))}
          </div>
        )}

        {children.length === 0 && !error && (
          <p className="text-sm text-zinc-500">Aucun enfant relié à ce compte pour le moment.</p>
        )}

        {selectedChild && <StudentDashboard studentId={selectedChild.student_id} schoolId={selectedChild.school_id} />}
      </div>
    </main>
  );
}
