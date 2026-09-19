"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface StaffProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}
interface Contract {
  id: string;
  profile_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number | null;
}

export default function RhPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileId, setProfileId] = useState("");
  const [contractType, setContractType] = useState("CDI");
  const [startDate, setStartDate] = useState("");
  const [salary, setSalary] = useState("");

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

    const [staffRes, contractsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("school_id", profile.school_id)
        .in("role", ["admin", "direction", "professeur"]),
      supabase.from("staff_contracts").select("id, profile_id, contract_type, start_date, end_date, salary").eq("school_id", profile.school_id),
    ]);

    setStaff(staffRes.data ?? []);
    setContracts(contractsRes.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !profileId || !startDate) return;

    const { error: insertError } = await supabase.from("staff_contracts").insert({
      school_id: schoolId,
      profile_id: profileId,
      contract_type: contractType,
      start_date: startDate,
      salary: salary ? Number(salary) : null,
    });

    if (insertError) setError(insertError.message);
    else {
      setSalary("");
      await loadData();
    }
  }

  if (loading) return <p className="p-8 text-zinc-500">Chargement...</p>;

  const inputClass =
    "rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">RH — Contrats du personnel</h1>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {contracts.map((c) => {
            const person = staff.find((s) => s.id === c.profile_id);
            return (
              <li key={c.id}>
                {person ? `${person.first_name} ${person.last_name}` : c.profile_id} — {c.contract_type} (depuis {c.start_date})
                {c.salary ? ` — ${c.salary} FCFA` : ""}
              </li>
            );
          })}
          {contracts.length === 0 && <li className="text-zinc-500">Aucun contrat.</li>}
        </ul>

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <select required value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputClass}>
            <option value="">Membre du personnel...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} ({s.role})
              </option>
            ))}
          </select>
          <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputClass}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Vacataire">Vacataire</option>
          </select>
          <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          <input placeholder="Salaire (FCFA)" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className={`w-32 ${inputClass}`} />
          <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Ajouter
          </button>
        </form>
      </div>
    </main>
  );
}
