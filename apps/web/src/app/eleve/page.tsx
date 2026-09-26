"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudentDashboard from "@/components/StudentDashboard";

export default function ElevePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [name, setName] = useState("");

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
    setSchoolId(profile.school_id);
    setName(`${profile.first_name} ${profile.last_name}`);

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("profile_id", sessionData.session.user.id)
      .maybeSingle();

    if (!student) {
      setError("Aucune fiche élève n'est reliée à ce compte. Contacte l'administration de ton école.");
      setLoading(false);
      return;
    }
    setStudentId(student.id);
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

        {studentId && schoolId && <StudentDashboard studentId={studentId} schoolId={schoolId} />}
      </div>
    </main>
  );
}
