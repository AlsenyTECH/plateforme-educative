export default function UtilisateursHub() {
  const items = [
    ["Élèves", "/admin/utilisateurs/eleves", "Fiches élèves, tuteurs, inscriptions"],
    ["Enseignants", "/admin/utilisateurs/enseignants", "Profs et matières enseignées"],
    ["Personnel administratif", "/admin/utilisateurs/personnel", "Surveillants, direction, etc."],
    ["Tuteurs", "/admin/utilisateurs/tuteurs", "Parents et tuteurs, indépendamment d'un compte"],
    ["Permissions", "/admin/utilisateurs/permissions", "Droits d'accès individuels par compte (notes, finances...)"],
  ];

  return (
    <main className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <a href="/admin" className="text-sm text-zinc-500 underline">
          ← Retour
        </a>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Utilisateurs</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map(([label, href, desc]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
              <p className="mt-1 text-sm text-zinc-500">{desc}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
