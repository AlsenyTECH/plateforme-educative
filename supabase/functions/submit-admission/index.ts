// Depot d'une demande d'admission gratuite (pole 01), accessible sans compte
// depuis la vitrine publique d'une ecole. Ecrit toujours via service_role :
// la table admissions n'a aucune policy RLS ouverte a anon (cf. migration
// 0003), pour empecher qu'un visiteur puisse lister les demandes des autres.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const {
      school_id,
      candidate_first_name,
      candidate_last_name,
      candidate_birth_date,
      desired_level,
      guardian_first_name,
      guardian_last_name,
      guardian_email,
      guardian_phone,
      // Honeypot : un champ que seul un bot remplit generalement, jamais
      // affiche a un visiteur humain dans le formulaire.
      website,
    } = body;

    if (website) {
      // Semble etre un bot : on repond succes sans rien ecrire, pour ne pas
      // lui reveler que sa soumission a ete detectee.
      return new Response(JSON.stringify({ access_token: crypto.randomUUID() }), { headers: jsonHeaders });
    }

    if (
      !school_id ||
      !candidate_first_name ||
      !candidate_last_name ||
      !guardian_first_name ||
      !guardian_last_name ||
      !guardian_email
    ) {
      return new Response(JSON.stringify({ error: "Champs obligatoires manquants" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!EMAIL_PATTERN.test(guardian_email)) {
      return new Response(JSON.stringify({ error: "Email invalide" }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: school } = await serviceClient
      .from("schools")
      .select("id, status")
      .eq("id", school_id)
      .maybeSingle();

    if (!school || !["trial", "active"].includes(school.status)) {
      return new Response(JSON.stringify({ error: "Ecole introuvable ou indisponible" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data: admission, error: insertError } = await serviceClient
      .from("admissions")
      .insert({
        school_id,
        candidate_first_name,
        candidate_last_name,
        candidate_birth_date: candidate_birth_date || null,
        desired_level: desired_level || null,
        guardian_first_name,
        guardian_last_name,
        guardian_email,
        guardian_phone: guardian_phone || null,
      })
      .select("access_token")
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ access_token: admission.access_token }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
