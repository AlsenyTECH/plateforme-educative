"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Level {
  id: string;
  name: string;
  order_index: number;
}

export default function NiveauxDrawer({
  schoolId,
  levels,
  onClose,
  onLevelCreated,
}: {
  schoolId: string;
  levels: Level[];
  onClose: () => void;
  onLevelCreated: () => void;
}) {
  const [search, setSearch] = useState("");
  const [newLevelName, setNewLevelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = levels.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLevelName.trim()) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from("levels")
      .insert({ school_id: schoolId, name: newLevelName.trim(), order_index: levels.length + 1 });

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNewLevelName("");
    onLevelCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl dark:bg-zinc-950 sm:w-96">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Niveaux</h2>
          <button onClick={onClose} className="text-sm text-zinc-500 underline">
            Fermer
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {levels.length > 8 && (
          <input
            placeholder="Rechercher un niveau..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        )}

        <div className="flex flex-col gap-1">
          {filtered.map((l) => (
            <a
              key={l.id}
              href={`/admin/ecole/niveaux/${l.id}`}
              className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              {l.name} →
            </a>
          ))}
          {filtered.length === 0 && <p className="text-sm text-zinc-500">Aucun niveau{search ? " trouvé" : ""}.</p>}
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Créer un niveau</label>
          <div className="flex gap-2">
            <input
              placeholder="ex. Terminale S2"
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
              className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
