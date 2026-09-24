"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
interface Subject {
  id: string;
  name: string;
}
interface Coefficient {
  id: string;
  subject_id: string;
  coefficient: number;
  weekly_hours: number | null;
}
interface ClassRow {
  id: string;
  name: string;
  academic_year_id: string;
}
interface Fee {
  id: string;
  fee_type: "inscription" | "mensualite";
  amount: number;
}

const LEVEL_FEE_TYPES = [
  ["inscription", "Frais d'inscription"],
  ["mensualite", "Mensualité"],
] as const;

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const btnClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export default function NiveauDetailPage() {
  const params = useParams<{ id: string }>();
  const levelId = params.id;
  const router = useRouter();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [allLevels, setAllLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [levelSearch, setLevelSearch] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [coefficients, setCoefficients] = useState<Coefficient[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectMode, setSubjectMode] = useState<"existing" | "new">("existing");
  const [subjectSelectId, setSubjectSelectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [coefValue, setCoefValue] = useState("1");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [editingCoefId, setEditingCoefId] = useState<string | null>(null);

  const [className, setClassName] = useState("");
  const [classYearId, setClassYearId] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [feeAmounts, setFeeAmounts] = useState<Record<string, string>>({ inscription: "", mensualite: "" });

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

    const [levelsRes, yearsRes, subjectsRes, coefRes, classesRes, feesRes] = await Promise.all([
      supabase.from("levels").select("id, name, order_index").eq("school_id", profile.school_id).order("order_index"),
      supabase.from("academic_years").select("id, label, active").eq("school_id", profile.school_id).order("label", { ascending: false }),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id).order("name"),
      supabase.from("subject_coefficients").select("id, subject_id, coefficient, weekly_hours").eq("school_id", profile.school_id).eq("level_id", levelId),
      supabase.from("classes").select("id, name, academic_year_id").eq("school_id", profile.school_id).eq("level_id", levelId),
      supabase.from("fee_structures").select("id, fee_type, amount").eq("school_id", profile.school_id).eq("level_id", levelId),
    ]);

    const levelsData = levelsRes.data ?? [];
    setAllLevels(levelsData);
    setLevel(levelsData.find((l) => l.id === levelId) ?? null);

    const yearsData = yearsRes.data ?? [];
    setYears(yearsData);
    setSubjects(subjectsRes.data ?? []);
    setCoefficients(coefRes.data ?? []);
    setClasses(classesRes.data ?? []);
    setFees((feesRes.data ?? []) as Fee[]);

    setFeeAmounts({
      inscription: String(feesRes.data?.find((f) => f.fee_type === "inscription")?.amount ?? ""),
      mensualite: String(feesRes.data?.find((f) => f.fee_type === "mensualite")?.amount ?? ""),
    });

    const activeYear = yearsData.find((y) => y.active);
    setClassYearId((prev) => prev || activeYear?.id || "");

    setLoading(false);
  }, [router, levelId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const availableSubjects = subjects.filter((s) => !coefficients.some((c) => c.subject_id === s.id));

  function resetCoefForm() {
    setEditingCoefId(null);
    setSubjectMode("existing");
    setSubjectSelectId("");
    setNewSubjectName("");
    setCoefValue("1");
    setWeeklyHours("");
  }

  function startEditCoef(c: Coefficient) {
    setEditingCoefId(c.id);
    setCoefValue(String(c.coefficient));
    setWeeklyHours(c.weekly_hours != null ? String(c.weekly_hours) : "");
  }

  async function submitCoefficient(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;

    const value = Number(coefValue);
    if (value < 1 || value > 10) {
      setError("Le coefficient doit être entre 1 et 10.");
      return;
    }
    const hours = weeklyHours.trim() ? Number(weeklyHours) : null;
    if (hours !== null && hours <= 0) {
      setError("Le quantum horaire doit être supérieur à 0.");
      return;
    }

    if (editingCoefId) {
      const { error: err } = await supabase
        .from("subject_coefficients")
        .update({ coefficient: value, weekly_hours: hours })
        .eq("id", editingCoefId);
      if (err) setError(err.message);
    } else {
      let subjectId = subjectSelectId;
      if (subjectMode === "new") {
        if (!newSubjectName.trim()) {
          setError("Nom de la matière requis.");
          return;
        }
        const { data: newSubject, error: subjErr } = await supabase
          .from("subjects")
          .insert({ school_id: schoolId, name: newSubjectName.trim() })
          .select("id")
          .single();
        if (subjErr || !newSubject) {
          setError(subjErr?.message ?? "Erreur création matière");
          return;
        }
        subjectId = newSubject.id;
      }
      if (!subjectId) {
        setError("Choisis une matière.");
        return;
      }
      const { error: err } = await supabase
        .from("subject_coefficients")
        .insert({ school_id: schoolId, subject_id: subjectId, level_id: levelId, coefficient: value, weekly_hours: hours });
      if (err) setError(err.message);
    }

    resetCoefForm();
    await loadData();
  }

  async function deleteCoefficient(id: string) {
    const { error: err } = await supabase.from("subject_coefficients").delete().eq("id", id);
    if (err) setError(err.message);
    else await loadData();
  }

  function startEditClass(c: ClassRow) {
    setEditingClassId(c.id);
    setClassName(c.name);
    setClassYearId(c.academic_year_id);
  }

  async function submitClass(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !className.trim() || !classYearId) return;

    if (editingClassId) {
      const { error: err } = await supabase
        .from("classes")
        .update({ name: className, academic_year_id: classYearId })
        .eq("id", editingClassId);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase
        .from("classes")
        .insert({ school_id: schoolId, name: className, level_id: levelId, academic_year_id: classYearId });
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

  async function saveFee(feeType: "inscription" | "mensualite") {
    if (!schoolId) return;
    const amount = feeAmounts[feeType];
    if (!amount) return;
    const existing = fees.find((f) => f.fee_type === feeType);
    const { error: err } = existing
      ? await supabase.from("fee_structures").update({ amount: Number(amount) }).eq("id", existing.id)
      : await supabase.from("fee_structures").insert({ school_id: schoolId, fee_type: feeType, level_id: levelId, amount: Number(amount) });
    if (err) setError(err.message);
    else await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;
  if (!level) return <p className="p-8 text-red-600 dark:text-red-400">Niveau introuvable.</p>;

  const filteredLevels = allLevels.filter((l) => l.name.toLowerCase().includes(levelSearch.toLowerCase()));

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-4xl gap-6">
        <aside className="hidden w-48 shrink-0 flex-col gap-2 sm:flex">
          <a href="/admin/configuration" className="text-xs text-zinc-500 underline">
            ← Configuration
          </a>
          <a href="/admin/ecole#niveaux" className="text-xs text-zinc-500 underline">
            ← Niveaux
          </a>
          <input
            placeholder="Rechercher..."
            value={levelSearch}
            onChange={(e) => setLevelSearch(e.target.value)}
            className={`${inputClass} mt-2 text-xs`}
          />
          <nav className="flex flex-col gap-1">
            {filteredLevels.map((l) => (
              <a
                key={l.id}
                href={`/admin/ecole/niveaux/${l.id}`}
                className={`rounded px-2 py-1 text-sm ${
                  l.id === levelId
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {l.name}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col gap-6">
          <div>
            <a href="/admin/ecole#niveaux" className="text-sm text-zinc-500 underline sm:hidden">
              ← Niveaux
            </a>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{level.name}</h1>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Matières, coefficients et quantum horaire</h2>
            <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              {coefficients.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1">
                  <span>
                    {subjects.find((s) => s.id === c.subject_id)?.name ?? "?"} — coefficient {c.coefficient}
                    {c.weekly_hours != null ? ` — ${c.weekly_hours} h/semaine` : ""}
                  </span>
                  <span className="flex gap-2 text-xs">
                    <button onClick={() => startEditCoef(c)} className="underline">
                      Modifier
                    </button>
                    <button onClick={() => deleteCoefficient(c.id)} className="text-red-600 underline dark:text-red-400">
                      Retirer
                    </button>
                  </span>
                </li>
              ))}
              {coefficients.length === 0 && <li className="text-zinc-500">Aucune matière pour ce niveau.</li>}
            </ul>
            <form onSubmit={submitCoefficient} className="flex flex-wrap items-center gap-2">
              {!editingCoefId && (
                <>
                  <select
                    value={subjectMode}
                    onChange={(e) => setSubjectMode(e.target.value as "existing" | "new")}
                    className={inputClass}
                  >
                    <option value="existing">Matière existante</option>
                    <option value="new">Nouvelle matière</option>
                  </select>
                  {subjectMode === "existing" ? (
                    <select required value={subjectSelectId} onChange={(e) => setSubjectSelectId(e.target.value)} className={inputClass}>
                      <option value="">Matière...</option>
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      placeholder="Nom de la matière"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </>
              )}
              <input
                type="number"
                min={1}
                max={10}
                value={coefValue}
                onChange={(e) => setCoefValue(e.target.value)}
                placeholder="Coeff."
                className={`w-20 ${inputClass}`}
              />
              <input
                type="number"
                min={0}
                step="0.5"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="h/semaine (optionnel)"
                className={`w-40 ${inputClass}`}
              />
              <button type="submit" className={btnClass}>
                {editingCoefId ? "Enregistrer" : "Ajouter"}
              </button>
              {editingCoefId && (
                <button type="button" onClick={resetCoefForm} className="text-xs underline">
                  Annuler
                </button>
              )}
            </form>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Classes</h2>
            <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              {classes.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1">
                  <span>
                    {c.name} ({years.find((y) => y.id === c.academic_year_id)?.label})
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
              {classes.length === 0 && <li className="text-zinc-500">Aucune classe pour ce niveau.</li>}
            </ul>
            <form onSubmit={submitClass} className="flex flex-wrap gap-2">
              <input required placeholder="Nom (ex. 6e A)" value={className} onChange={(e) => setClassName(e.target.value)} className={inputClass} />
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
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Frais pour ce niveau</h2>
            <div className="flex flex-col gap-2">
              {LEVEL_FEE_TYPES.map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-40 text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                  <input
                    type="number"
                    value={feeAmounts[key] ?? ""}
                    onChange={(e) => setFeeAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Montant (FCFA)"
                    className={`w-40 ${inputClass}`}
                  />
                  <button onClick={() => saveFee(key)} className={btnClass}>
                    Enregistrer
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
