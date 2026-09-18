# Supabase

Backend managé (Postgres + Auth + Storage + Realtime + Edge Functions).

- `migrations/` — schéma SQL versionné (tables, colonnes `school_id`, policies RLS)
- `functions/` — Edge Functions (signature/vérification des tokens de carte scolaire, webhooks Mobile Money, envoi SMS/WhatsApp)

Ce dossier sera initialisé avec `supabase init` et rempli au moment de la conception du modèle de données (prochaine étape après la structure du projet).

Référence : [Cahier des Charges](https://claude.ai/artifact/8Fxy8T4JPRjb7yYpvnMZrQ)
