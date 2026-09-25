"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NiveauxDrawer from "./NiveauxDrawer";

interface Level {
  id: string;
  name: string;
  order_index: number;
}

interface StepStatus {
  id: string;
  order: number;
  title: string;
  description: string;
  href?: string;
  openDrawer?: boolean;
  done: boolean;
  essential: boolean;
  blocking: boolean;
}

export default function ConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    setSchoolId(profile.school_id);

    const [schoolRes, yearsRes, levelsRes, subjectsRes, coefRes, classesRes, servicesRes] = await Promise.all([
      supabase.from("schools").select("name, legal_name, legal_registration_number").eq("id", profile.school_id).single(),
      supabase.from("academic_years").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id),
      supabase.from("levels").select("id, name, order_index").eq("school_id", profile.school_id).order("order_index"),
      supabase.from("subjects").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id),
      supabase.from("subject_coefficients").select("level_id").eq("school_id", profile.school_id),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id),
    ]);

    const school = schoolRes.data;
    setSchoolName(school?.name ?? "");

    const identiteDone = Boolean(school?.legal_name) && Boolean(school?.legal_registration_number);
    const anneeDone = (yearsRes.count ?? 0) > 0;
    const levelsData = levelsRes.data ?? [];
    setLevels(levelsData);
    const niveauxDone = levelsData.length > 0;
    const matieresDone = (subjectsRes.count ?? 0) > 0;
    const coveredLevelIds = new Set((coefRes.data ?? []).map((c) => c.level_id));
    const coefficientsDone = niveauxDone && levelsData.every((l) => coveredLevelIds.has(l.id));
    const classesDone = (classesRes.count ?? 0) > 0;
    const contenuNiveauxDone = matieresDone && coefficientsDone && classesDone;
    const servicesDone = (servicesRes.count ?? 0) > 0;

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
        openDrawer: true,
        done: niveauxDone,
        essential: true,
        blocking: true,
      },
      {
        id: "contenu-niveaux",
        order: 4,
        title: "Matières, coefficients et classes par niveau",
        description: "Pour chaque niveau : matières, coefficients, quantum horaire, classes et frais (inscription, mensualité).",
        openDrawer: true,
        done: contenuNiveauxDone,
        essential: true,
        blocking: true,
      },
      {
        id: "services",
        order: 5,
        title: "Services",
        description: "Cantine, transport et autres services optionnels hors scolarité, avec leur propre tarif.",
        href: "/admin/services",
        done: servicesDone,
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
          {essentialSteps.map((step) => (
            <StepCard key={step.id} step={step} unlocked={unlocked.get(step.id) ?? false} onOpenDrawer={() => setDrawerOpen(true)} />
          ))}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Pour aller plus loin</h2>
          <div className="flex flex-col gap-2">
            {otherSteps.map((step) => (
              <StepCard key={step.id} step={step} unlocked onOpenDrawer={() => setDrawerOpen(true)} />
            ))}
          </div>
        </div>
      </div>

      {drawerOpen && schoolId && (
        <NiveauxDrawer
          schoolId={schoolId}
          levels={levels}
          onClose={() => setDrawerOpen(false)}
          onLevelCreated={() => void loadData()}
        />
      )}
    </main>
  );
}

function StepCard({
  step,
  unlocked,
  onOpenDrawer,
}: {
  step: StepStatus;
  unlocked: boolean;
  onOpenDrawer: () => void;
}) {
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
  if (step.openDrawer) {
    return (
      <button onClick={onOpenDrawer} className="block w-full text-left">
        {content}
      </button>
    );
  }
  return (
    <a href={step.href} className="block">
      {content}
    </a>
  );
}
