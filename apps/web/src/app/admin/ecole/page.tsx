"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadPhoto, getPhotoUrl } from "@/lib/upload";

interface School {
  id: string;
  name: string;
  legal_name: string | null;
  legal_registration_number: string | null;
  logo_path: string | null;
}
interface Level {
  id: string;
  name: string;
  order_index: number;
}
interface AcademicYear {
  id: string;
  label: string;
  active: boolean;
}
interface Fee {
  id: string;
  level_id: string | null;
  fee_type: string;
  amount: number;
}

const GENERAL_FEE_TYPES = [
  ["cantine", "Cantine"],
  ["transport", "Transport"],
] as const;

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const btnClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export default function EcolePage() {
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [legalNumber, setLegalNumber] = useState("");

  const [levelName, setLevelName] = useState("");
  const [yearLabel, setYearLabel] = useState("");

  const [feeType, setFeeType] = useState<(typeof GENERAL_FEE_TYPES)[number][0]>("cantine");
  const [feeAmount, setFeeAmount] = useState("");

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

    const [schoolRes, levelsRes, yearsRes, feesRes] = await Promise.all([
      supabase.from("schools").select("id, name, legal_name, legal_registration_number, logo_path").eq("id", profile.school_id).single(),
      supabase.from("levels").select("id, name, order_index").eq("school_id", profile.school_id).order("order_index"),
      supabase.from("academic_years").select("id, label, active").eq("school_id", profile.school_id).order("label", { ascending: false }),
      supabase.from("fee_structures").select("id, level_id, fee_type, amount").eq("school_id", profile.school_id).is("level_id", null),
    ]);

    if (schoolRes.data) {
      setSchool(schoolRes.data);
      setLegalName(schoolRes.data.legal_name ?? "");
      setLegalNumber(schoolRes.data.legal_registration_number ?? "");
      setLogoUrl(await getPhotoUrl(schoolRes.data.logo_path));
    }
    setLevels(levelsRes.data ?? []);
    setYears(yearsRes.data ?? []);
    setFees(feesRes.data ?? []);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleSaveLegal(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    const { error: err } = await supabase
      .from("schools")
      .update({ legal_name: legalName || null, legal_registration_number: legalNumber || null })
      .eq("id", school.id);
    if (err) setError(err.message);
    else await loadData();
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !school) return;
    try {
      const path = await uploadPhoto(school.id, "logo", school.id, file);
      const { error: err } = await supabase.from("schools").update({ logo_path: path }).eq("id", school.id);
      if (err) throw err;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload logo");
    }
  }

  async function addYear(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !yearLabel.trim()) return;
    const { error: err } = await supabase.from("academic_years").insert({ school_id: school.id, label: yearLabel, active: years.length === 0 });
    if (err) setError(err.message);
    else {
      setYearLabel("");
      await loadData();
    }
  }

  async function activateYear(yearId: string) {
    if (!school) return;
    await supabase.from("academic_years").update({ active: false }).eq("school_id", school.id);
    await supabase.from("academic_years").update({ active: true }).eq("id", yearId);
    await loadData();
  }

  async function addLevel(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !levelName.trim()) return;
    const { error: err } = await supabase
      .from("levels")
      .insert({ school_id: school.id, name: levelName, order_index: levels.length + 1 });
    if (err) setError(err.message);
    else {
      setLevelName("");
      await loadData();
    }
  }

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !feeAmount) return;
    const existing = fees.find((f) => f.fee_type === feeType);
    const { error: err } = existing
      ? await supabase.from("fee_structures").update({ amount: Number(feeAmount) }).eq("id", existing.id)
      : await supabase.from("fee_structures").insert({ school_id: school.id, fee_type: feeType, level_id: null, amount: Number(feeAmount) });
    if (err) setError(err.message);
    else {
      setFeeAmount("");
      await loadData();
    }
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <a href="/admin/configuration" className="text-sm text-zinc-500 underline">
          ← Retour à la configuration
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Réglages de l&apos;école</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Étape 1 */}
        <section id="identite" className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">1. Identité de l&apos;école</h2>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded object-cover" />}
            <input type="file" accept="image/*" onChange={handleLogoChange} className="text-sm" />
          </div>
          <form onSubmit={handleSaveLegal} className="flex flex-col gap-2">
            <input placeholder="Raison sociale" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} />
            <input placeholder="Numéro d'autorisation" value={legalNumber} onChange={(e) => setLegalNumber(e.target.value)} className={inputClass} />
            <button type="submit" className={`${btnClass} self-start`}>
              Enregistrer
            </button>
          </form>
        </section>

        {/* Étape 2 */}
        <section id="annee-scolaire" className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">2. Année scolaire</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {years.map((y) => (
              <li key={y.id} className="flex items-center justify-between">
                <span>
                  {y.label} {y.active && <span className="text-green-600 dark:text-green-400">(active)</span>}
                </span>
                {!y.active && (
                  <button onClick={() => activateYear(y.id)} className="text-xs underline">
                    Activer
                  </button>
                )}
              </li>
            ))}
            {years.length === 0 && <li className="text-zinc-500">Aucune année scolaire.</li>}
          </ul>
          <form onSubmit={addYear} className="flex gap-2">
            <input placeholder="ex. 2026-2027" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} className={inputClass} />
            <button type="submit" className={btnClass}>
              Créer
            </button>
          </form>
        </section>

        {/* Étape 3 */}
        <section id="niveaux" className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">3. Niveaux</h2>
          <p className="text-sm text-zinc-500">
            Matières, coefficients, quantum horaire, classes et frais par niveau se configurent depuis la page de chaque niveau.
          </p>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <a
                key={l.id}
                href={`/admin/ecole/niveaux/${l.id}`}
                className="rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {l.name} →
              </a>
            ))}
            {levels.length === 0 && <p className="text-sm text-zinc-500">Aucun niveau.</p>}
          </div>
          <form onSubmit={addLevel} className="flex gap-2">
            <input placeholder="ex. Terminale S2" value={levelName} onChange={(e) => setLevelName(e.target.value)} className={inputClass} />
            <button type="submit" className={btnClass}>
              Ajouter
            </button>
          </form>
        </section>

        {/* Étape 4 */}
        <section id="frais" className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">4. Frais généraux</h2>
          <p className="text-sm text-zinc-500">
            Cantine et transport (montant unique pour toute l&apos;école). L&apos;inscription et la mensualité, qui varient par niveau, se règlent depuis la page de chaque niveau.
          </p>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {fees.map((f) => (
              <li key={f.id}>
                {GENERAL_FEE_TYPES.find(([k]) => k === f.fee_type)?.[1] ?? f.fee_type} : {f.amount} FCFA
              </li>
            ))}
            {fees.length === 0 && <li className="text-zinc-500">Aucun frais défini.</li>}
          </ul>
          <form onSubmit={addFee} className="flex flex-wrap gap-2">
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
              {GENERAL_FEE_TYPES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input required type="number" placeholder="Montant (FCFA)" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} className={`w-32 ${inputClass}`} />
            <button type="submit" className={btnClass}>
              Définir
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
