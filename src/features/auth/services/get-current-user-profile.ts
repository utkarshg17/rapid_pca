import { supabase } from "@/lib/supabase/client";

export type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_id: string | null;
  role: string | null;
  is_active: boolean | null;
  auth_user_id: string | null;
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_database")
    .select(
      "id, first_name, last_name, email_id, role, is_active, auth_user_id"
    )
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    const isNoRowResponse =
      error.code === "PGRST116" ||
      error.details?.includes("0 rows") ||
      error.message?.includes("0 rows");

    if (isNoRowResponse) {
      return null;
    }

    console.warn("Error fetching user profile:", error.message);
    return null;
  }

  if (!data) {
    console.warn("No matching user profile found for auth user id:", user.id);
    return null;
  }

  return data as UserProfile;
}
