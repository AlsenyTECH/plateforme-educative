"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "staff" | "parents";
  created_at: string;
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("all");
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

    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, audience, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("announcements")
      .insert({ school_id: schoolId, title, body, audience });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setBody("");
    await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Annonces</h1>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <input
            required
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <textarea
            required
            placeholder="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <div className="flex items-center gap-2">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Announcement["audience"])}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="all">Tout le monde</option>
              <option value="staff">Personnel uniquement</option>
              <option value="parents">Parents uniquement</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "..." : "Publier"}
            </button>
          </div>
        </form>

        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{a.title}</p>
                <span className="text-xs text-zinc-500">{a.audience}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{a.body}</p>
            </li>
          ))}
          {items.length === 0 && <p className="text-sm text-zinc-500">Aucune annonce.</p>}
        </ul>
      </div>
    </main>
  );
}
