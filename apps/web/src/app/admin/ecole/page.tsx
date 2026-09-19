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
interface ClassRow {
  id: string;
  name: string;
  level: string;
  academic_year: string;
}
interface Subject {
  id: string;
  name: string;
}
interface Coefficient {
  id: string;
  subject_id: string;
  level: string;
  coefficient: number;
}
interface Fee {
  id: string;
  level: string;
  fee_type: string;
  amount: number;
}

const FEE_TYPES = [
  ["inscription", "Frais d'inscription"],
  ["mensualite", "Mensualité"],
  ["cantine", "Cantine"],
  ["transport", "Transport"],
] as const;

export default function EcolePage() {
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [coefficients, setCoefficients] = useState<Coefficient[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [legalNumber, setLegalNumber] = useState("");

  const [className, setClassName] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [classYear, setClassYear] = useState("2026-2027");

  const [coefSubject, setCoefSubject] = useState("");
  const [coefLevel, setCoefLevel] = useState("");
  const [coefValue, setCoefValue] = useState("1");

  const [feeLevel, setFeeLevel] = useState("");
  const [feeType, setFeeType] = useState<(typeof FEE_TYPES)[number][0]>("mensualite");
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

    const [schoolRes, classesRes, subjectsRes, coefRes, feesRes] = await Promise.all([
      supabase.from("schools").select("id, name, legal_name, legal_registration_number, logo_path").eq("id", profile.school_id).single(),
      supabase.from("classes").select("id, name, level, academic_year").eq("school_id", profile.school_id),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
      supabase.from("subject_coefficients").select("id, subject_id, level, coefficient").eq("school_id", profile.school_id),
      supabase.from("fee_structures").select("id, level, fee_type, amount").eq("school_id", profile.school_id),
    ]);

    if (schoolRes.data) {
      setSchool(schoolRes.data);
      setLegalName(schoolRes.data.legal_name ?? "");
      setLegalNumber(schoolRes.data.legal_registration_number ?? "");
      setLogoUrl(await getPhotoUrl(schoolRes.data.logo_path));
    }
    setClasses(classesRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setCoefficients(coefRes.data ?? []);
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

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !className.trim() || !classLevel.trim()) return;
    const { error: err } = await supabase
      .from("classes")
      .insert({ school_id: school.id, name: className, level: classLevel, academic_year: classYear });
    if (err) setError(err.message);
    else {
      setClassName("");
      setClassLevel("");
      await loadData();
    }
  }

  async function addCoefficient(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !coefSubject || !coefLevel.trim()) return;
    const { error: err } = await supabase
      .from("subject_coefficients")
      .insert({ school_id: school.id, subject_id: coefSubject, level: coefLevel, coefficient: Number(coefValue) });
    if (err) setError(err.message);
    else await loadData();
  }

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !feeLevel.trim() || !feeAmount) return;
    const { error: err } = await supabase
      .from("fee_structures")
      .insert({ school_id: school.id, level: feeLevel, fee_type: feeType, amount: Number(feeAmount) });
    if (err) setError(err.message);
    else {
      setFeeAmount("");
      await loadData();
    }
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  const inputClass =
    "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const btnClass =
    "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Réglages de l&apos;école</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Identité de l&apos;école</h2>
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

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Classes</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {classes.map((c) => (
              <li key={c.id}>
                {c.name} — {c.level} ({c.academic_year})
              </li>
            ))}
            {classes.length === 0 && <li className="text-zinc-500">Aucune classe.</li>}
          </ul>
          <form onSubmit={addClass} className="flex flex-wrap gap-2">
            <input required placeholder="Nom (ex. Seconde A)" value={className} onChange={(e) => setClassName(e.target.value)} className={inputClass} />
            <input required placeholder="Niveau (ex. Seconde)" value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={inputClass} />
            <input placeholder="Année scolaire" value={classYear} onChange={(e) => setClassYear(e.target.value)} className={inputClass} />
            <button type="submit" className={btnClass}>
              Créer
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Coefficients par matière et niveau</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {coefficients.map((c) => (
              <li key={c.id}>
                {subjects.find((s) => s.id === c.subject_id)?.name ?? "?"} — {c.level} : coefficient {c.coefficient}
              </li>
            ))}
            {coefficients.length === 0 && <li className="text-zinc-500">Aucun coefficient défini.</li>}
          </ul>
          <form onSubmit={addCoefficient} className="flex flex-wrap gap-2">
            <select required value={coefSubject} onChange={(e) => setCoefSubject(e.target.value)} className={inputClass}>
              <option value="">Matière...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input required placeholder="Niveau" value={coefLevel} onChange={(e) => setCoefLevel(e.target.value)} className={inputClass} />
            <input type="number" step="0.5" value={coefValue} onChange={(e) => setCoefValue(e.target.value)} className={`w-20 ${inputClass}`} />
            <button type="submit" className={btnClass}>
              Définir
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Frais</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {fees.map((f) => (
              <li key={f.id}>
                {f.level} — {FEE_TYPES.find(([k]) => k === f.fee_type)?.[1] ?? f.fee_type} : {f.amount} FCFA
              </li>
            ))}
            {fees.length === 0 && <li className="text-zinc-500">Aucun frais défini.</li>}
          </ul>
          <form onSubmit={addFee} className="flex flex-wrap gap-2">
            <input required placeholder="Niveau" value={feeLevel} onChange={(e) => setFeeLevel(e.target.value)} className={inputClass} />
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
              {FEE_TYPES.map(([k, label]) => (
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
