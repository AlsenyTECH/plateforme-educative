"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
}
interface Offer {
  id: string;
  bio: string | null;
  hourly_rate: number | null;
  subject_id: string | null;
  active: boolean;
}
interface Booking {
  id: string;
  offer_id: string;
  student_id: string;
  status: string;
}
interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export default function TutoringPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState("");
  const [rate, setRate] = useState("");
  const [offerSubject, setOfferSubject] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }
    setUserId(sessionData.session.user.id);

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

    const [subjectsRes, offersRes, bookingsRes, studentsRes] = await Promise.all([
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id),
      supabase.from("tutoring_offers").select("id, bio, hourly_rate, subject_id, active").eq("school_id", profile.school_id),
      supabase.from("tutoring_bookings").select("id, offer_id, student_id, status").eq("school_id", profile.school_id),
      supabase.from("students").select("id, first_name, last_name").eq("school_id", profile.school_id),
    ]);

    setSubjects(subjectsRes.data ?? []);
    setOffers(offersRes.data ?? []);
    setBookings(bookingsRes.data ?? []);
    setStudents(studentsRes.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleAddOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !userId) return;

    const { error: insertError } = await supabase.from("tutoring_offers").insert({
      school_id: schoolId,
      tutor_profile_id: userId,
      subject_id: offerSubject || null,
      bio: bio || null,
      hourly_rate: rate ? Number(rate) : null,
    });

    if (insertError) setError(insertError.message);
    else {
      setBio("");
      setRate("");
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tutorat</h1>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Offres de tutorat</h2>
          <ul className="mb-2 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {offers.map((o) => (
              <li key={o.id}>
                {subjects.find((s) => s.id === o.subject_id)?.name ?? "Toutes matières"}
                {o.hourly_rate ? ` — ${o.hourly_rate} FCFA/h` : ""} {o.bio ? `— ${o.bio}` : ""}
              </li>
            ))}
            {offers.length === 0 && <li className="text-zinc-500">Aucune offre.</li>}
          </ul>
          <form onSubmit={handleAddOffer} className="flex flex-wrap gap-2">
            <select value={offerSubject} onChange={(e) => setOfferSubject(e.target.value)} className={inputClass}>
              <option value="">Matière...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} className={inputClass} />
            <input placeholder="Tarif/h" type="number" value={rate} onChange={(e) => setRate(e.target.value)} className={`w-24 ${inputClass}`} />
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              Proposer (en tant que moi)
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Réservations</h2>
          <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {bookings.map((b) => {
              const student = students.find((s) => s.id === b.student_id);
              return (
                <li key={b.id}>
                  {student ? `${student.first_name} ${student.last_name}` : b.student_id} — {b.status}
                </li>
              );
            })}
            {bookings.length === 0 && <li className="text-zinc-500">Aucune réservation.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
