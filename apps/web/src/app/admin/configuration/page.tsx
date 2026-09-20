"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface StepStatus {
  id: string;
  order: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
  essential: boolean;
  blocking: boolean;
}

export default function ConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  const [steps, setSteps] = useState<StepStatus[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

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
      setError("Aucune école rattachée à ce compte.");
      setLoading(false);
      return;
    }
    const schoolId = profile.school_id;

    const [schoolRes, yearsRes, levelsRes, subjectsRes, coefRes, classesRes, feesRes, teachersRes, staffRes, studentsRes] =
      await Promise.all([
        supabase.from("schools").select("name, legal_name, legal_registration_number").eq("id", schoolId).single(),
        supabase.from("academic_years").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("levels").select("id").eq("school_id", schoolId),
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("subject_coefficients").select("level_id").eq("school_id", schoolId),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("fee_structures").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      ]);

    const school = schoolRes.data;
    setSchoolName(school?.name ?? "");

    const identiteDone = Boolean(school?.legal_name) && Boolean(school?.legal_registration_number);
    const anneeDone = (yearsRes.count ?? 0) > 0;
    const levels = levelsRes.data ?? [];
    const niveauxDone = levels.length > 0;
    const matieresDone = (subjectsRes.count ?? 0) > 0;
    const coveredLevelIds = new Set((coefRes.data ?? []).map((c) => c.level_id));
    const coefficientsDone = niveauxDone && levels.every((l) => coveredLevelIds.has(l.id));
    const classesDone = (classesRes.count ?? 0) > 0;
    const fraisDone = (feesRes.count ?? 0) > 0;
    const enseignantsDone = (teachersRes.count ?? 0) > 0;
    const personnelDone = (staffRes.count ?? 0) > 0;
    const elevesDone = (studentsRes.count ?? 0) > 0;

    setSteps([
      {
        id: "identite",
        order: 1,
        title: "Identité de l'école",
        description: "Raison sociale, numéro d'autorisation, logo.",
        href: "/admin/ecole#identite",
        done: identiteDone,
        essential: true,
        blocking: true,
      },
      {
        id: "annee-scolaire",
        order: 2,
        title: "Année scolaire",
        description: "Créer et activer l'année scolaire en cours.",
        href: "/admin/ecole#annee-scolaire",
        done: anneeDone,
        essential: true,
        blocking: true,
      },
      {
        id: "niveaux",
        order: 3,
        title: "Niveaux",
        description: "Les niveaux enseignés dans l'établissement (ex. 6e, Terminale).",
        href: "/admin/ecole#niveaux",
        done: niveauxDone,
        essential: true,
        blocking: true,
      },
      {
        id: "matieres",
        order: 4,
        title: "Matières",
        description: "Les matières enseignées.",
        href: "/admin/ecole#matieres",
        done: matieresDone,
        essential: true,
        blocking: true,
      },
      {
        id: "coefficients",
        order: 5,
        title: "Coefficients",
        description: "Coefficient de chaque matière par niveau (obligatoire mais ne bloque pas la suite).",
        href: "/admin/ecole#coefficients",
        done: coefficientsDone,
        essential: true,
        blocking: false,
      },
      {
        id: "classes",
        order: 6,
        title: "Classes",
        description: "Les classes de l'établissement pour l'année en cours.",
        href: "/admin/ecole#classes",
        done: classesDone,
        essential: true,
        blocking: true,
      },
      {
        id: "frais",
        order: 7,
        title: "Frais",
        description: "Inscription, mensualité, cantine, transport.",
        href: "/admin/ecole#frais",
        done: fraisDone,
        essential: false,
        blocking: false,
      },
      {
        id: "enseignants",
        order: 8,
        title: "Enseignants",
        description: "Créer les enseignants et leur affecter leurs matières.",
        href: "/admin/utilisateurs/enseignants",
        done: enseignantsDone,
        essential: false,
        blocking: false,
      },
      {
        id: "personnel",
        order: 9,
        title: "Personnel administratif",
        description: "Surveillants, direction des études, etc.",
        href: "/admin/utilisateurs/personnel",
        done: personnelDone,
        essential: false,
        blocking: false,
      },
      {
        id: "eleves",
        order: 10,
        title: "Élèves",
        description: "Inscrire les élèves et leurs tuteurs.",
        href: "/admin/utilisateurs/eleves",
        done: elevesDone,
        essential: false,
        blocking: false,
      },
    ]);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;
  if (error) return <p className="p-8 text-red-600 dark:text-red-400">{error}</p>;

  const essentialSteps = steps.filter((s) => s.essential);
  const essentialDone = essentialSteps.filter((s) => s.done).length;
  const otherSteps = steps.filter((s) => !s.essential);

  // Une étape "blocking" n'est accessible que si toutes les étapes bloquantes précédentes sont faites.
  // Une étape non-bloquante (coefficients) ne fait pas partie de la chaîne : elle est accessible dès
  // que son propre prérequis est rempli, sans empêcher l'étape suivante d'être atteinte.
  let chainOk = true;
  const unlocked = new Map<string, boolean>();
  for (const step of essentialSteps) {
    unlocked.set(step.id, chainOk);
    if (step.blocking) chainOk = chainOk && step.done;
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour au tableau de bord
        </a>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Configuration — {schoolName}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {essentialDone}/{essentialSteps.length} étapes essentielles complétées
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${(essentialDone / essentialSteps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {essentialSteps.map((step) => {
            const isUnlocked = unlocked.get(step.id) ?? false;
            return (
              <StepCard key={step.id} step={step} unlocked={isUnlocked} />
            );
          })}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Pour aller plus loin</h2>
          <div className="flex flex-col gap-2">
            {otherSteps.map((step) => (
              <StepCard key={step.id} step={step} unlocked />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function StepCard({ step, unlocked }: { step: StepStatus; unlocked: boolean }) {
  const content = (
    <div
      className={`flex items-center justify-between rounded-lg border p-4 ${
        step.done
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : unlocked
            ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            : "border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {step.order}. {step.title}
          {!step.essential && <span className="ml-2 text-xs font-normal text-zinc-500">(optionnel)</span>}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
      </div>
      <span className="ml-4 shrink-0 text-sm">
        {step.done ? (
          <span className="text-green-700 dark:text-green-400">✓ Fait</span>
        ) : unlocked ? (
          <span className="text-zinc-500 underline">Configurer</span>
        ) : (
          <span className="text-zinc-400">Verrouillé</span>
        )}
      </span>
    </div>
  );

  if (!unlocked) return content;
  return (
    <a href={step.href} className="block">
      {content}
    </a>
  );
}
