import { z } from "zod";

/**
 * Roles definis au pole 02 (Comptes & Espaces par role) du cahier des charges.
 * Utilise a la fois cote web (Next.js) et mobile (Expo) pour router l'utilisateur
 * vers le bon espace et pour les policies RLS Supabase (colonne `role` sur `profiles`).
 */
export const USER_ROLES = [
  "admin",
  "direction",
  "professeur",
  "eleve",
  "parent",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);
