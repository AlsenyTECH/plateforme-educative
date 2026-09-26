import { supabase } from "./supabase";

export type InviteEntityType = "teacher" | "staff_member" | "guardian" | "student";

export async function inviteAccount(entityType: InviteEntityType, entityId: string, email: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("invite-account", {
    body: {
      entity_type: entityType,
      entity_id: entityId,
      email,
      redirect_origin: window.location.origin,
    },
  });

  if (error || !data?.action_link) {
    throw new Error(data?.error ?? error?.message ?? "Erreur lors de l'invitation");
  }

  return data.action_link as string;
}
