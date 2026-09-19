// Suivi de statut d'une demande d'admission par jeton (pole 01), sans compte.
// Recherche ciblee par acces_token via service_role : ne renvoie que les
// champs utiles au candidat, jamais la liste complete de la table (cf.
// migration 0003, admissions n'a pas de policy select publique).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { access_token } = await req.json();
    if (!access_token) {
      return new Response(JSON.stringify({ error: "access_token requis" }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: admission, error } = await serviceClient
      .from("admissions")
      .select(
        "candidate_first_name, candidate_last_name, desired_level, status, decision_note, submitted_at, schools(name)",
      )
      .eq("access_token", access_token)
      .maybeSingle();

    if (error) throw error;

    if (!admission) {
      return new Response(JSON.stringify({ error: "Demande introuvable" }), { status: 404, headers: jsonHeaders });
    }

    return new Response(JSON.stringify(admission), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
