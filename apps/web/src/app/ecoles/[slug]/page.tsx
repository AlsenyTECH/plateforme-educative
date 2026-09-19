import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AdmissionForm } from "./admission-form";

interface School {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

async function getSchool(slug: string): Promise<School | null> {
  const { data } = await supabase
    .from("schools")
    .select("id, name, description, address, contact_email, contact_phone")
    .eq("slug", slug)
    .maybeSingle();

  return data;
}

export default async function SchoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchool(slug);

  if (!school) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{school.name}</h1>
          {school.description && <p className="text-zinc-600 dark:text-zinc-400">{school.description}</p>}
          <dl className="mt-2 flex flex-col gap-1 text-sm text-zinc-500">
            {school.address && <div>{school.address}</div>}
            {school.contact_email && <div>{school.contact_email}</div>}
            {school.contact_phone && <div>{school.contact_phone}</div>}
          </dl>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">Demande d&apos;admission</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Cette première demande est gratuite. L&apos;école te recontactera pour la suite du dossier.
          </p>
          <AdmissionForm schoolId={school.id} />
        </section>
      </div>
    </main>
  );
}
