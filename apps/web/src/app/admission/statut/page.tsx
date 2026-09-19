"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AdmissionStatus {
  candidate_first_name: string;
  candidate_last_name: string;
  desired_level: string | null;
  status: "pending" | "accepted" | "rejected";
  decision_note: string | null;
  submitted_at: string;
  schools: { name: string } | null;
}

const STATUS_LABELS: Record<AdmissionStatus["status"], string> = {
  pending: "En attente",
  accepted: "Acceptée",
  rejected: "Refusée",
};

function StatusChecker() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [result, setResult] = useState<AdmissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkStatus(tokenToCheck: string) {
    setLoading(true);
    setError(null);
    setResult(null);

    const { data, error: fnError } = await supabase.functions.invoke("check-admission-status", {
      body: { access_token: tokenToCheck },
    });

    setLoading(false);

    if (fnError || !data || data.error) {
      setError(data?.error ?? fnError?.message ?? "Demande introuvable");
      return;
    }

    setResult(data);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Suivi de ma demande</h1>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Lien / jeton reçu après l&apos;envoi de ta demande
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <button
          onClick={() => checkStatus(token)}
          disabled={loading || !token}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Vérification..." : "Vérifier le statut"}
        </button>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {result && (
          <div className="flex flex-col gap-1 rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="text-zinc-900 dark:text-zinc-50">
              {result.candidate_first_name} {result.candidate_last_name}
              {result.schools?.name ? ` — ${result.schools.name}` : ""}
            </p>
            {result.desired_level && <p className="text-zinc-600 dark:text-zinc-400">{result.desired_level}</p>}
            <p className="font-medium text-zinc-900 dark:text-zinc-50">Statut : {STATUS_LABELS[result.status]}</p>
            {result.decision_note && <p className="text-zinc-600 dark:text-zinc-400">{result.decision_note}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdmissionStatusPage() {
  return (
    <Suspense>
      <StatusChecker />
    </Suspense>
  );
}
