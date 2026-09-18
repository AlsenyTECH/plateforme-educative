// Emet une carte scolaire pour un eleve : signe le payload avec la cle privee
// de l'ecole et renvoie le token a encoder dans le QR imprime. Si l'eleve a
// deja une carte active, elle est revoquee avant que la nouvelle ne soit creee
// (une seule carte active a la fois, cf. l'index unique de la migration 0002).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodePayload, encodeToken, toPgBytea, fromPgBytea } from "../_shared/token.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { student_id, reason } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: "student_id requis" }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Client scope au JWT de l'appelant : la lecture de l'eleve passe par RLS,
    // donc un admin ne peut deja pas cibler l'eleve d'une autre ecole ici.
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Non authentifie" }), { status: 401, headers: jsonHeaders });
    }

    const { data: student, error: studentError } = await callerClient
      .from("students")
      .select("id, school_id")
      .eq("id", student_id)
      .single();
    if (studentError || !student) {
      return new Response(JSON.stringify({ error: "Eleve introuvable ou non accessible" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data: profile } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || profile.school_id !== student.school_id || !["admin", "direction"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Non autorise a emettre une carte pour cet eleve" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // Client service_role : seul habilite a lire la cle privee de l'ecole.
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: keyRow, error: keyError } = await serviceClient
      .from("school_signing_keys")
      .select("private_key")
      .eq("school_id", student.school_id)
      .single();
    if (keyError || !keyRow) {
      return new Response(
        JSON.stringify({ error: "Cette ecole n'a pas encore de cle de signature (voir issue-school-keys)" }),
        { status: 409, headers: jsonHeaders },
      );
    }

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      fromPgBytea(keyRow.private_key as string),
      { name: "Ed25519" },
      false,
      ["sign"],
    );

    // NB : revocation puis insertion sont deux appels sequentiels, pas une
    // transaction SQL unique. Si l'insertion echoue apres la revocation,
    // l'eleve se retrouve temporairement sans carte active (recuperable en
    // relancant) plutot que d'avoir deux cartes valides en meme temps.
    // Compromis MVP accepte ; a durcir avec une fonction RPC transactionnelle
    // si ca devient genant en pratique.
    const { data: previousCard } = await serviceClient
      .from("cards")
      .select("id, card_version")
      .eq("student_id", student_id)
      .eq("status", "active")
      .maybeSingle();

    if (previousCard) {
      const { error: revokeError } = await serviceClient
        .from("cards")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_reason: reason ?? "reemission",
        })
        .eq("id", previousCard.id);
      if (revokeError) throw revokeError;
    }

    const nextVersion = previousCard ? previousCard.card_version + 1 : 1;
    const cardId = crypto.randomUUID();
    const issuedAt = new Date();

    const payloadBytes = encodePayload({
      cardId,
      studentId: student_id,
      schoolId: student.school_id,
      issuedAt,
      cardVersion: nextVersion,
    });

    const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, payloadBytes));

    const { error: insertError } = await serviceClient.from("cards").insert({
      id: cardId,
      school_id: student.school_id,
      student_id,
      card_version: nextVersion,
      issued_at: issuedAt.toISOString(),
      signature: toPgBytea(signature),
    });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ card_id: cardId, token: encodeToken(payloadBytes, signature) }), {
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), { status: 500, headers: jsonHeaders });
  }
});
