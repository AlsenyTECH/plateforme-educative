"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ROLE_DESTINATIONS: Record<string, string> = {
  professeur: "/professeur",
  eleve: "/eleve",
  parent: "/parent",
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (!profile) {
        router.push("/onboarding");
        return;
      }

      router.push(ROLE_DESTINATIONS[profile.role] ?? "/admin");
    }, 300);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <p className="text-zinc-600 dark:text-zinc-400">Chargement...</p>
    </main>
  );
}
