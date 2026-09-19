import { supabase } from "./supabase";

export async function uploadPhoto(
  schoolId: string,
  category: string,
  entityId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${schoolId}/${category}/${entityId}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("uploads").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
