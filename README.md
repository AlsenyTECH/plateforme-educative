# Plateforme Éducative

SaaS multi-écoles : gestion scolaire, pédagogie multi-format, carte scolaire connectée (wallet, contrôle d'accès, transport en temps réel).

Cahier des charges complet (12 pôles fonctionnels, sources croisées, décisions actées) : https://claude.ai/artifact/8Fxy8T4JPRjb7yYpvnMZrQ

## Stack

- **Backend & données** — [Supabase](https://supabase.com) (Postgres + Auth + Storage + Realtime + Edge Functions)
- **Web** — [Next.js](https://nextjs.org) (TypeScript) : site vitrine par école, back-office administration, portails web
- **Mobile** — [Expo](https://expo.dev) / React Native (TypeScript) : app élève/parent, professeur, chauffeur, agent de contrôle
- **Cartographie** — Mapbox (suivi live des bus)
- **Multi-tenant** — une base Postgres partagée, isolation par colonne `school_id` + policies Row Level Security

## Structure du dépôt

```
apps/
  web/        Next.js
  mobile/     Expo (React Native)
packages/
  shared/     Types, schémas de validation (zod), constantes partagés entre web et mobile
supabase/
  migrations/ Schéma SQL versionné
  functions/  Edge Functions (signature carte scolaire, webhooks paiement, notifications)
```

C'est un monorepo géré avec les **workspaces npm** (pas de gestionnaire de paquets additionnel à installer).

## Commandes

```bash
npm install          # installe toutes les dépendances du monorepo
npm run dev:web       # lance le site Next.js
npm run dev:mobile    # lance l'app Expo
npm run lint          # lint sur tous les workspaces
npm run typecheck     # vérification TypeScript sur tous les workspaces
npm run test          # tests sur tous les workspaces
```

## Garde-fous (projet développé avec assistance IA)

- TypeScript en mode strict partout (`tsconfig.base.json`)
- Les modules touchant à l'argent (wallet, paiements) et à la sécurité de la carte scolaire (signature Ed25519) sont relus ligne par ligne, jamais générés puis acceptés sans lecture
- Les secrets ne sont jamais commités (`.env.local`, ignoré par git) — voir `.env.example` dans chaque app
