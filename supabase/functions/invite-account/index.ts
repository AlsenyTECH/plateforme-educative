// Cree un vrai compte de connexion pour une entite deja existante
// (teacher/staff_member/guardian/student) qui n'en a pas encore, sans
// dependre de l'envoi d'email (le service email par defaut de Supabase a
// un quota trop bas, et aucun SMTP personnalise n'est configure pour
// l'instant - voir memoire projet). generateLink cree le compte et
// renvoie un lien d'action a partager manuellement (WhatsApp/SMS/en main
// propre) plutot que de compter sur un email qui pourrait ne jamais
// arriver.
//
// Reserve au compte 'admin' (pas 'direction') : coherent avec
// user_permissions dont l'ecriture est deja verrouillee au seul admin -
// inviter un compte, c'est aussi decider quel acces initial il aura.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ENTITY_CONFIG: Record<string, { table: string; role: string }> = {
  teacher: { table: "teachers", role: "professeur" },
  staff_member: { table: "staff_members", role: "personnel" },
  guardian: { table: "guardians", role: "parent" },
  student: { table: "students", role: "eleve" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { entity_type, entity_id, email, redirect_origin } = await req.json();

    const config = ENTITY_CONFIG[entity_type as string];
    if (!config || !entity_id || !email || !redirect_origin) {
      return new Response(
        JSON.stringify({ error: "entity_type, entity_id, email et redirect_origin sont requis" }),
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

    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("school_id, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Seul le compte Admin peut inviter un compte" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const { data: entity, error: entityError } = await serviceClient
      .from(config.table)
      .select("id, school_id, profile_id, first_name, last_name")
      .eq("id", entity_id)
      .eq("school_id", callerProfile.school_id)
      .maybeSingle();

    if (entityError || !entity) {
      return new Response(JSON.stringify({ error: "Fiche introuvable dans cette ecole" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (entity.profile_id) {
      return new Response(JSON.stringify({ error: "Cette fiche a deja un compte" }), {
        status: 409,
        headers: jsonHeaders,
      });
    }

    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${redirect_origin}/definir-mot-de-passe` },
    });

    if (linkError || !linkData.user) {
      return new Response(JSON.stringify({ error: linkError?.message ?? "Erreur creation du compte" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: linkData.user.id,
      school_id: callerProfile.school_id,
      role: config.role,
      first_name: entity.first_name,
      last_name: entity.last_name,
    });

    if (profileError) {
      await serviceClient.auth.admin.deleteUser(linkData.user.id);
      throw profileError;
    }

    const { error: linkEntityError } = await serviceClient
      .from(config.table)
      .update({ profile_id: linkData.user.id })
      .eq("id", entity.id);

    if (linkEntityError) throw linkEntityError;

    return new Response(
      JSON.stringify({ user_id: linkData.user.id, action_link: linkData.properties.action_link }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
