import { supabase } from "@/lib/supabase/client";

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}