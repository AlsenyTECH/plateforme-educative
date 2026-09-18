// Genere la paire de cles Ed25519 d'une ecole (une fois, a l'onboarding).
// La cle privee ne quitte jamais cette fonction : elle est ecrite dans
// school_signing_keys (table verrouillee, cf. migration 0002) et n'est
// jamais renvoyee dans la reponse HTTP.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { toPgBytea } from "../_shared/token.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { school_id } = await req.json();
    if (!school_id) {
      return new Response(JSON.stringify({ error: "school_id requis" }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Client scope au JWT de l'appelant : respecte RLS, sert uniquement a
    // verifier son role avant de toucher a quoi que ce soit de sensible.
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Non authentifie" }), { status: 401, headers: jsonHeaders });
    }

    const { data: profile } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || profile.school_id !== school_id || !["admin", "direction"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Non autorise pour cette ecole" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // Client service_role : seul habilite a lire/ecrire school_signing_keys,
    // qui a RLS activee sans aucune policy (cf. migration 0002).
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await serviceClient
      .from("school_signing_keys")
      .select("school_id")
      .eq("school_id", school_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Cette ecole a deja une paire de cles ; pas d'ecrasement silencieux." }),
        { status: 409, headers: jsonHeaders },
      );
    }

    const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;

    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

    const { error: insertError } = await serviceClient
      .from("school_signing_keys")
      .insert({ school_id, private_key: toPgBytea(privatePkcs8) });
    if (insertError) throw insertError;

    const { error: updateError } = await serviceClient
      .from("schools")
      .update({ card_public_key: toPgBytea(publicRaw) })
      .eq("id", school_id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
