"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function AdmissionForm({ schoolId }: { schoolId: string }) {
  const [candidateFirstName, setCandidateFirstName] = useState("");
  const [candidateLastName, setCandidateLastName] = useState("");
  const [candidateBirthDate, setCandidateBirthDate] = useState("");
  const [desiredLevel, setDesiredLevel] = useState("");
  const [guardianFirstName, setGuardianFirstName] = useState("");
  const [guardianLastName, setGuardianLastName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("submit-admission", {
      body: {
        school_id: schoolId,
        candidate_first_name: candidateFirstName,
        candidate_last_name: candidateLastName,
        candidate_birth_date: candidateBirthDate || undefined,
        desired_level: desiredLevel || undefined,
        guardian_first_name: guardianFirstName,
        guardian_last_name: guardianLastName,
        guardian_email: guardianEmail,
        guardian_phone: guardianPhone || undefined,
        // Honeypot : champ jamais rempli par un visiteur humain (masque via CSS)
        website: "",
      },
    });

    setLoading(false);

    if (fnError || !data?.access_token) {
      setError(fnError?.message ?? "Erreur lors de l'envoi de la demande");
      return;
    }

    setAccessToken(data.access_token);
  }

  if (accessToken) {
    return (
      <div className="rounded border border-green-300 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-950">
        <p className="text-green-800 dark:text-green-200">Demande envoyée avec succès.</p>
        <p className="mt-2 text-green-700 dark:text-green-300">
          Garde ce lien pour suivre l&apos;avancement de ta demande :
        </p>
        <a
          href={`/admission/statut?token=${accessToken}`}
          className="mt-1 block break-all font-mono text-xs text-green-700 underline dark:text-green-300"
        >
          {typeof window !== "undefined" ? window.location.origin : ""}/admission/statut?token={accessToken}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Prénom du candidat
          <input
            required
            value={candidateFirstName}
            onChange={(e) => setCandidateFirstName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nom du candidat
          <input
            required
            value={candidateLastName}
            onChange={(e) => setCandidateLastName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Date de naissance
          <input
            type="date"
            value={candidateBirthDate}
            onChange={(e) => setCandidateBirthDate(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Niveau souhaité
          <input
            value={desiredLevel}
            onChange={(e) => setDesiredLevel(e.target.value)}
            placeholder="ex. Seconde STEG"
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Prénom du parent/tuteur
          <input
            required
            value={guardianFirstName}
            onChange={(e) => setGuardianFirstName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nom du parent/tuteur
          <input
            required
            value={guardianLastName}
            onChange={(e) => setGuardianLastName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Email
          <input
            type="email"
            required
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Téléphone
          <input
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Envoi..." : "Envoyer la demande d'admission"}
      </button>
    </form>
  );
}
