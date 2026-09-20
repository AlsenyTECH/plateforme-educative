"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // detectSessionInUrl traite le lien de confirmation avant ce montage,
    // mais on laisse un court instant a supabase-js pour finir de poser la
    // session avant de decider s'il faut renvoyer vers /login.
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (existingProfile) {
        router.push("/admin");
        return;
      }

      setChecking(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [router]);

  function handleSchoolNameChange(value: string) {
    setSchoolName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("Session expiree, reconnecte-toi.");
      setLoading(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke("create-school", {
      body: { school_name: schoolName, slug, first_name: firstName, last_name: lastName },
    });

    setLoading(false);

    if (fnError || !data?.school_id) {
      setError(fnError?.message ?? "Erreur lors de la creation de l'ecole");
      return;
    }

    router.push("/admin/configuration");
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Verification...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Creer votre ecole</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Vous serez administrateur de cette ecole une fois creee.
        </p>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nom de l&apos;ecole
          <input
            required
            value={schoolName}
            onChange={(e) => handleSchoolNameChange(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Identifiant (slug)
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            className="rounded border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Prenom
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Nom
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Creation..." : "Creer mon ecole"}
        </button>
      </form>
    </main>
  );
}
