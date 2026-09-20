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
interface ClassRow {
  id: string;
  name: string;
  level_id: string;
  academic_year_id: string;
}
interface Subject {
  id: string;
  name: string;
}
interface Coefficient {
  id: string;
  subject_id: string;
  level_id: string;
  coefficient: number;
}
interface Fee {
  id: string;
  level_id: string | null;
  fee_type: string;
  amount: number;
}

const FEE_TYPES = [
  ["inscription", "Frais d'inscription", true],
  ["mensualite", "Mensualité", true],
  ["cantine", "Cantine", false],
  ["transport", "Transport", false],
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
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [coefficients, setCoefficients] = useState<Coefficient[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [legalNumber, setLegalNumber] = useState("");

  const [levelName, setLevelName] = useState("");
  const [yearLabel, setYearLabel] = useState("");

  const [className, setClassName] = useState("");
  const [classLevelId, setClassLevelId] = useState("");
  const [classYearId, setClassYearId] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [coefSubject, setCoefSubject] = useState("");
  const [coefLevel, setCoefLevel] = useState("");
  const [coefValue, setCoefValue] = useState("1");

  const [feeType, setFeeType] = useState<(typeof FEE_TYPES)[number][0]>("mensualite");
  const [feeLevelId, setFeeLevelId] = useState("");
  const [feeAmount, setFeeAmount] = useState("");

  const feeUsesLevel = FEE_TYPES.find(([k]) => k === feeType)?.[2] ?? false;

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

    const [schoolRes, levelsRes, yearsRes, classesRes, subjectsRes, coefRes, feesRes] = await Promise.all([
      supabase.from("schools").select("id, name, legal_name, legal_registration_number, logo_path").eq("id", profile.school_id).single(),
      supabase.from("levels").select("id, name, order_index").eq("school_id", profile.school_id).order("order_index"),
      supabase.from("academic_years").select("id, label, active").eq("school_id", profile.school_id).order("label", { ascending: false }),
      supabase.from("classes").select("id, name, level_id, academic_year_id").eq("school_id", profile.school_id),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
      supabase.from("subject_coefficients").select("id, subject_id, level_id, coefficient").eq("school_id", profile.school_id),
      supabase.from("fee_structures").select("id, level_id, fee_type, amount").eq("school_id", profile.school_id),
    ]);

    if (schoolRes.data) {
      setSchool(schoolRes.data);
      setLegalName(schoolRes.data.legal_name ?? "");
      setLegalNumber(schoolRes.data.legal_registration_number ?? "");
      setLogoUrl(await getPhotoUrl(schoolRes.data.logo_path));
    }
    const levelsData = levelsRes.data ?? [];
    const yearsData = yearsRes.data ?? [];
    setLevels(levelsData);
    setYears(yearsData);
    setClasses(classesRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setCoefficients(coefRes.data ?? []);
    setFees(feesRes.data ?? []);

    const activeYear = yearsData.find((y) => y.active);
    if (activeYear && !classYearId) setClassYearId(activeYear.id);

    setLoading(false);
  }, [router, classYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function startEditClass(c: ClassRow) {
    setEditingClassId(c.id);
    setClassName(c.name);
    setClassLevelId(c.level_id);
    setClassYearId(c.academic_year_id);
  }

  async function submitClass(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !className.trim() || !classLevelId || !classYearId) return;

    if (editingClassId) {
      const { error: err } = await supabase
        .from("classes")
        .update({ name: className, level_id: classLevelId, academic_year_id: classYearId })
        .eq("id", editingClassId);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase
        .from("classes")
        .insert({ school_id: school.id, name: className, level_id: classLevelId, academic_year_id: classYearId });
      if (err) setError(err.message);
    }

    setEditingClassId(null);
    setClassName("");
    await loadData();
  }

  async function deleteClass(id: string) {
    const { error: err } = await supabase.from("classes").delete().eq("id", id);
    if (err) setError(err.message);
    else await loadData();
  }

  async function addCoefficient(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !coefSubject || !coefLevel) return;
    const value = Number(coefValue);
    if (value < 1 || value > 10) {
      setError("Le coefficient doit être entre 1 et 10.");
      return;
    }
    const { error: err } = await supabase
      .from("subject_coefficients")
      .insert({ school_id: school.id, subject_id: coefSubject, level_id: coefLevel, coefficient: value });
    if (err) setError(err.message);
    else await loadData();
  }

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !feeAmount) return;
    if (feeUsesLevel && !feeLevelId) {
      setError("Choisis un niveau pour ce type de frais.");
      return;
    }
    const { error: err } = await supabase
      .from("fee_structures")
      .insert({ school_id: school.id, fee_type: feeType, level_id: feeUsesLevel ? feeLevelId : null, amount: Number(feeAmount) });
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
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Niveaux</h2>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <span key={l.id} className="rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {l.name}
              </span>
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

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Années scolaires</h2>
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

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Classes</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1">
                <span>
                  {c.name} — {levels.find((l) => l.id === c.level_id)?.name} ({years.find((y) => y.id === c.academic_year_id)?.label})
                </span>
                <span className="flex gap-2 text-xs">
                  <button onClick={() => startEditClass(c)} className="underline">
                    Modifier
                  </button>
                  <button onClick={() => deleteClass(c.id)} className="text-red-600 underline dark:text-red-400">
                    Supprimer
                  </button>
                </span>
              </li>
            ))}
            {classes.length === 0 && <li className="text-zinc-500">Aucune classe.</li>}
          </ul>
          <form onSubmit={submitClass} className="flex flex-wrap gap-2">
            <input required placeholder="Nom (ex. Seconde A)" value={className} onChange={(e) => setClassName(e.target.value)} className={inputClass} />
            <select required value={classLevelId} onChange={(e) => setClassLevelId(e.target.value)} className={inputClass}>
              <option value="">Niveau...</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select required value={classYearId} onChange={(e) => setClassYearId(e.target.value)} className={inputClass}>
              <option value="">Année scolaire...</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
            <button type="submit" className={btnClass}>
              {editingClassId ? "Enregistrer" : "Créer"}
            </button>
            {editingClassId && (
              <button
                type="button"
                onClick={() => {
                  setEditingClassId(null);
                  setClassName("");
                }}
                className="text-xs underline"
              >
                Annuler
              </button>
            )}
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Coefficients par matière et niveau</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {coefficients.map((c) => (
              <li key={c.id}>
                {subjects.find((s) => s.id === c.subject_id)?.name ?? "?"} — {levels.find((l) => l.id === c.level_id)?.name} : coefficient {c.coefficient}
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
            <select required value={coefLevel} onChange={(e) => setCoefLevel(e.target.value)} className={inputClass}>
              <option value="">Niveau...</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input type="number" min={1} max={10} value={coefValue} onChange={(e) => setCoefValue(e.target.value)} className={`w-20 ${inputClass}`} />
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
                {FEE_TYPES.find(([k]) => k === f.fee_type)?.[1] ?? f.fee_type}
                {f.level_id ? ` — ${levels.find((l) => l.id === f.level_id)?.name}` : " — toute l'école"} : {f.amount} FCFA
              </li>
            ))}
            {fees.length === 0 && <li className="text-zinc-500">Aucun frais défini.</li>}
          </ul>
          <form onSubmit={addFee} className="flex flex-wrap gap-2">
            <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
              {FEE_TYPES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {feeUsesLevel && (
              <select required value={feeLevelId} onChange={(e) => setFeeLevelId(e.target.value)} className={inputClass}>
                <option value="">Niveau...</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
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
