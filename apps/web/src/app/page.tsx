import { USER_ROLES } from "@plateforme/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Plateforme Éducative — web
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Placeholder de structure. Espaces à construire pour les rôles :
      </p>
      <ul className="flex gap-2">
        {USER_ROLES.map((role) => (
          <li
            key={role}
            className="rounded-full bg-zinc-200 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {role}
          </li>
        ))}
      </ul>
    </main>
  );
}
