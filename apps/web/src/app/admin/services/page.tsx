"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: "cantine" | "transport" | null;
  amount: number;
  billing_frequency: "unique" | "mensuel";
  active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  cantine: "Cantine",
  transport: "Transport",
};

const FREQUENCY_LABELS: Record<string, string> = {
  unique: "Paiement unique",
  mensuel: "Mensuel",
};

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const btnClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export default function ServicesPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"" | "cantine" | "transport">("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"unique" | "mensuel">("mensuel");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    const { data } = await supabase
      .from("services")
      .select("id, name, description, category, amount, billing_frequency, active")
      .eq("school_id", profile.school_id)
      .order("name");
    setServices(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setCategory("");
    setAmount("");
    setFrequency("mensuel");
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description ?? "");
    setCategory(s.category ?? "");
    setAmount(String(s.amount));
    setFrequency(s.billing_frequency);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !name.trim() || !amount) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      amount: Number(amount),
      billing_frequency: frequency,
    };

    const { error: err } = editingId
      ? await supabase.from("services").update(payload).eq("id", editingId)
      : await supabase.from("services").insert({ school_id: schoolId, ...payload });

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    resetForm();
    await loadData();
  }

  async function toggleActive(s: Service) {
    const { error: err } = await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    if (err) setError(err.message);
    else await loadData();
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Services</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cantine, transport, et tout autre service hors scolarité proposé par l&apos;école. S&apos;applique à
            l&apos;ensemble des élèves inscrits (indépendant du niveau/classe), sur inscription optionnelle par élève.
          </p>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-2">
          {services.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                s.active
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  : "border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div>
                <p className="text-zinc-900 dark:text-zinc-50">
                  {s.name}
                  {s.category && <span className="ml-2 text-xs text-zinc-500">({CATEGORY_LABELS[s.category]})</span>}
                  {!s.active && <span className="ml-2 text-xs text-red-600 dark:text-red-400">Inactif</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {s.amount} FCFA — {FREQUENCY_LABELS[s.billing_frequency]}
                  {s.description ? ` — ${s.description}` : ""}
                </p>
              </div>
              <span className="flex gap-2 text-xs">
                <button onClick={() => startEdit(s)} className="underline">
                  Modifier
                </button>
                <button onClick={() => toggleActive(s)} className="underline">
                  {s.active ? "Désactiver" : "Réactiver"}
                </button>
              </span>
            </li>
          ))}
          {services.length === 0 && <li className="text-sm text-zinc-500">Aucun service défini.</li>}
        </ul>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{editingId ? "Modifier le service" : "Nouveau service"}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input required placeholder="Nom (ex. Cantine, Étude surveillée)" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={inputClass}>
              <option value="">Catégorie : générique</option>
              <option value="cantine">Cantine</option>
              <option value="transport">Transport</option>
            </select>
            <input required type="number" min={0} placeholder="Montant (FCFA)" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className={inputClass}>
              <option value="mensuel">Mensuel</option>
              <option value="unique">Paiement unique</option>
            </select>
            <input
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`sm:col-span-2 ${inputClass}`}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className={`self-start ${btnClass}`}>
              {saving ? "..." : editingId ? "Enregistrer" : "Créer"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs underline">
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
