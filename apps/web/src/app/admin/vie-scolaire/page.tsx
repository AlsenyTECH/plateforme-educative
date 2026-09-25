"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}
interface Book {
  id: string;
  title: string;
  author: string | null;
  total_copies: number;
}
interface Route {
  id: string;
  name: string;
}
interface CanteenSub {
  id: string;
  student_id: string;
  formula: string;
  active: boolean;
}
interface TransportSub {
  id: string;
  student_id: string;
  route_id: string;
  active: boolean;
}
interface HealthIncident {
  id: string;
  student_id: string;
  description: string;
  occurred_at: string;
}
interface Service {
  id: string;
  name: string;
  category: "cantine" | "transport" | null;
  active: boolean;
}
interface ServiceSub {
  id: string;
  service_id: string;
  student_id: string;
  active: boolean;
}

export default function VieScolairePage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [canteenSubs, setCanteenSubs] = useState<CanteenSub[]>([]);
  const [transportSubs, setTransportSubs] = useState<TransportSub[]>([]);
  const [incidents, setIncidents] = useState<HealthIncident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSubs, setServiceSubs] = useState<ServiceSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookTitle, setBookTitle] = useState("");
  const [routeName, setRouteName] = useState("");
  const [canteenStudent, setCanteenStudent] = useState("");
  const [canteenFormula, setCanteenFormula] = useState("mensuel");
  const [canteenServiceId, setCanteenServiceId] = useState("");
  const [transportStudent, setTransportStudent] = useState("");
  const [transportRoute, setTransportRoute] = useState("");
  const [transportServiceId, setTransportServiceId] = useState("");
  const [incidentStudent, setIncidentStudent] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [otherServiceStudent, setOtherServiceStudent] = useState("");
  const [otherServiceId, setOtherServiceId] = useState("");

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

    const [studentsRes, booksRes, routesRes, canteenRes, transportRes, incidentsRes, servicesRes, serviceSubsRes] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name").eq("school_id", profile.school_id),
      supabase.from("library_books").select("id, title, author, total_copies").eq("school_id", profile.school_id),
      supabase.from("bus_routes").select("id, name").eq("school_id", profile.school_id),
      supabase.from("canteen_subscriptions").select("id, student_id, formula, active").eq("school_id", profile.school_id),
      supabase.from("transport_subscriptions").select("id, student_id, route_id, active").eq("school_id", profile.school_id),
      supabase
        .from("health_incidents")
        .select("id, student_id, description, occurred_at")
        .eq("school_id", profile.school_id)
        .order("occurred_at", { ascending: false }),
      supabase.from("services").select("id, name, category, active").eq("school_id", profile.school_id),
      supabase.from("service_subscriptions").select("id, service_id, student_id, active").eq("school_id", profile.school_id),
    ]);

    setStudents(studentsRes.data ?? []);
    setBooks(booksRes.data ?? []);
    setRoutes(routesRes.data ?? []);
    setCanteenSubs(canteenRes.data ?? []);
    setTransportSubs(transportRes.data ?? []);
    setIncidents(incidentsRes.data ?? []);
    const servicesData = servicesRes.data ?? [];
    setServices(servicesData);
    setServiceSubs(serviceSubsRes.data ?? []);
    setCanteenServiceId((prev) => prev || servicesData.find((s) => s.category === "cantine")?.id || "");
    setTransportServiceId((prev) => prev || servicesData.find((s) => s.category === "transport")?.id || "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  function studentName(id: string) {
    const s = students.find((x) => x.id === id);
    return s ? `${s.first_name} ${s.last_name}` : id;
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !bookTitle.trim()) return;
    const { error: err } = await supabase.from("library_books").insert({ school_id: schoolId, title: bookTitle });
    if (err) setError(err.message);
    else {
      setBookTitle("");
      await loadData();
    }
  }

  async function addRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !routeName.trim()) return;
    const { error: err } = await supabase.from("bus_routes").insert({ school_id: schoolId, name: routeName });
    if (err) setError(err.message);
    else {
      setRouteName("");
      await loadData();
    }
  }

  async function addCanteenSub(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !canteenStudent) return;
    const { error: err } = await supabase.from("canteen_subscriptions").insert({
      school_id: schoolId,
      student_id: canteenStudent,
      formula: canteenFormula,
      service_id: canteenServiceId || null,
      start_date: new Date().toISOString().slice(0, 10),
    });
    if (err) setError(err.message);
    else await loadData();
  }

  async function addTransportSub(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !transportStudent || !transportRoute) return;
    const { error: err } = await supabase
      .from("transport_subscriptions")
      .insert({ school_id: schoolId, student_id: transportStudent, route_id: transportRoute, service_id: transportServiceId || null });
    if (err) setError(err.message);
    else await loadData();
  }

  async function addOtherServiceSub(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !otherServiceStudent || !otherServiceId) return;
    const { error: err } = await supabase
      .from("service_subscriptions")
      .insert({ school_id: schoolId, student_id: otherServiceStudent, service_id: otherServiceId });
    if (err) setError(err.message);
    else await loadData();
  }

  async function addIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !incidentStudent || !incidentDescription.trim()) return;
    const { error: err } = await supabase
      .from("health_incidents")
      .insert({ school_id: schoolId, student_id: incidentStudent, description: incidentDescription });
    if (err) setError(err.message);
    else {
      setIncidentDescription("");
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
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Vie scolaire</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Cantine</h2>
          {services.filter((s) => s.category === "cantine").length === 0 && (
            <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Aucun service &quot;Cantine&quot; défini. <a href="/admin/services" className="underline">Créer le tarif dans Services</a> avant d&apos;abonner des élèves.
            </p>
          )}
          <ul className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {canteenSubs.map((c) => (
              <li key={c.id}>
                {studentName(c.student_id)} — {c.formula} ({c.active ? "actif" : "inactif"})
              </li>
            ))}
            {canteenSubs.length === 0 && <li className="text-zinc-500">Aucun abonnement.</li>}
          </ul>
          <form onSubmit={addCanteenSub} className="flex flex-wrap gap-2">
            <select required value={canteenStudent} onChange={(e) => setCanteenStudent(e.target.value)} className={inputClass}>
              <option value="">Élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <select value={canteenServiceId} onChange={(e) => setCanteenServiceId(e.target.value)} className={inputClass}>
              <option value="">Service cantine...</option>
              {services
                .filter((s) => s.category === "cantine" && s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <select value={canteenFormula} onChange={(e) => setCanteenFormula(e.target.value)} className={inputClass}>
              <option value="mensuel">Mensuel</option>
              <option value="trimestriel">Trimestriel</option>
            </select>
            <button type="submit" className={btnClass}>
              Abonner
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Transport</h2>
          {services.filter((s) => s.category === "transport").length === 0 && (
            <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Aucun service &quot;Transport&quot; défini. <a href="/admin/services" className="underline">Créer le tarif dans Services</a> avant d&apos;abonner des élèves.
            </p>
          )}
          <ul className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {transportSubs.map((t) => (
              <li key={t.id}>
                {studentName(t.student_id)} — {routes.find((r) => r.id === t.route_id)?.name ?? "?"}
              </li>
            ))}
            {transportSubs.length === 0 && <li className="text-zinc-500">Aucun abonnement.</li>}
          </ul>
          <form onSubmit={addRoute} className="mb-2 flex gap-2">
            <input placeholder="Nouvelle ligne de bus" value={routeName} onChange={(e) => setRouteName(e.target.value)} className={inputClass} />
            <button type="submit" className={btnClass}>
              Créer la ligne
            </button>
          </form>
          <form onSubmit={addTransportSub} className="flex flex-wrap gap-2">
            <select required value={transportStudent} onChange={(e) => setTransportStudent(e.target.value)} className={inputClass}>
              <option value="">Élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <select required value={transportRoute} onChange={(e) => setTransportRoute(e.target.value)} className={inputClass}>
              <option value="">Ligne...</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select value={transportServiceId} onChange={(e) => setTransportServiceId(e.target.value)} className={inputClass}>
              <option value="">Service transport...</option>
              {services
                .filter((s) => s.category === "transport" && s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button type="submit" className={btnClass}>
              Abonner
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Autres services</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Services génériques (hors cantine/transport) — <a href="/admin/services" className="underline">gérer le catalogue et les tarifs</a>.
          </p>
          <ul className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {serviceSubs.map((ss) => (
              <li key={ss.id}>
                {studentName(ss.student_id)} — {services.find((s) => s.id === ss.service_id)?.name ?? "?"} ({ss.active ? "actif" : "inactif"})
              </li>
            ))}
            {serviceSubs.length === 0 && <li className="text-zinc-500">Aucun abonnement.</li>}
          </ul>
          <form onSubmit={addOtherServiceSub} className="flex flex-wrap gap-2">
            <select required value={otherServiceStudent} onChange={(e) => setOtherServiceStudent(e.target.value)} className={inputClass}>
              <option value="">Élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <select required value={otherServiceId} onChange={(e) => setOtherServiceId(e.target.value)} className={inputClass}>
              <option value="">Service...</option>
              {services
                .filter((s) => !s.category && s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button type="submit" className={btnClass}>
              Abonner
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Bibliothèque</h2>
          <ul className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {books.map((b) => (
              <li key={b.id}>
                {b.title} {b.author ? `— ${b.author}` : ""} ({b.total_copies} ex.)
              </li>
            ))}
            {books.length === 0 && <li className="text-zinc-500">Aucun livre.</li>}
          </ul>
          <form onSubmit={addBook} className="flex gap-2">
            <input placeholder="Titre du livre" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} className={inputClass} />
            <button type="submit" className={btnClass}>
              Ajouter
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">Infirmerie</h2>
          <ul className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {incidents.map((i) => (
              <li key={i.id}>
                {i.occurred_at.slice(0, 10)} — {studentName(i.student_id)} : {i.description}
              </li>
            ))}
            {incidents.length === 0 && <li className="text-zinc-500">Aucun incident.</li>}
          </ul>
          <form onSubmit={addIncident} className="flex flex-wrap gap-2">
            <select required value={incidentStudent} onChange={(e) => setIncidentStudent(e.target.value)} className={inputClass}>
              <option value="">Élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Description"
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              className={inputClass}
            />
            <button type="submit" className={btnClass}>
              Enregistrer
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
