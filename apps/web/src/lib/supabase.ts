import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent etre definies (voir .env.local).",
  );
}

// Client cote navigateur : utilise la cle publique, respecte RLS pour
// chaque requete. Jamais la service_role key ici.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
