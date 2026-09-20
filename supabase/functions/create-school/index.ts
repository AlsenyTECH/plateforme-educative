// Onboarding en self-service : un utilisateur authentifie (email confirme)
// cree son ecole et devient automatiquement son admin. Remplace le seed SQL
// utilise jusqu'ici pour les tests (supabase/seed/dev-seed.sql).
//
// Regles imposees ici plutot que par des policies RLS ouvertes, parce
// qu'elles sont plus faciles a auditer et a faire evoluer dans du code que
// dans des expressions de policy :
//   - un compte ne peut creer qu'une seule ecole (s'il a deja un profil, refuse)
//   - le slug doit etre unique et suit un format simple (minuscules, chiffres, tirets)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Liste standard pre-remplie a la creation (etape "Niveaux" du wizard,
// confirmable/completable par l'admin ensuite) - evite de partir d'un
// referentiel vide.
const STANDARD_LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { school_name, slug, first_name, last_name } = await req.json();

    if (!school_name || !slug || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: "school_name, slug, first_name et last_name sont requis" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!SLUG_PATTERN.test(slug)) {
      return new Response(
        JSON.stringify({ error: "Le slug ne peut contenir que des minuscules, chiffres et tirets" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Non authentifie" }), { status: 401, headers: jsonHeaders });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "Ce compte a deja un profil (une seule ecole par compte pour l'instant)" }),
        { status: 409, headers: jsonHeaders },
      );
    }

    const { data: newSchool, error: schoolError } = await serviceClient
      .from("schools")
      .insert({ name: school_name, slug, plan: "standard", status: "trial" })
      .select("id")
      .single();

    if (schoolError) {
      if (schoolError.code === "23505") {
        return new Response(JSON.stringify({ error: "Ce nom (slug) est deja pris" }), {
          status: 409,
          headers: jsonHeaders,
        });
      }
      throw schoolError;
    }

    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: authData.user.id,
      school_id: newSchool.id,
      role: "admin",
      first_name,
      last_name,
    });

    if (profileError) {
      // Ecole creee mais profil rate : on nettoie pour ne pas laisser une
      // ecole orpheline sans aucun admin.
      await serviceClient.from("schools").delete().eq("id", newSchool.id);
      throw profileError;
    }

    // Pre-remplissage des niveaux standards. Non bloquant si ca echoue :
    // l'admin peut toujours les creer manuellement a l'etape "Niveaux" du wizard.
    await serviceClient.from("levels").insert(
      STANDARD_LEVELS.map((name, index) => ({ school_id: newSchool.id, name, order_index: index + 1 })),
    );

    return new Response(JSON.stringify({ school_id: newSchool.id }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
