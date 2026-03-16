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

  console.log("Auth user:", user);
  console.log("Auth user error:", userError);

  if (userError || !user?.id) {
    return null;
  }

  const { data, error, status, statusText } = await supabase
    .from("user_database")
    .select(
      "id, first_name, last_name, email_id, role, is_active, auth_user_id"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("Profile query status:", status, statusText);
  console.log("Profile query data:", data);
  console.log("Profile query error:", error);
  console.log("Logged in auth user id:", user.id);

  if (error) {
    console.error("Error fetching user profile:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  if (!data) {
    console.warn("No matching user profile found for auth user id:", user.id);
    return null;
  }

  return data as UserProfile;
}