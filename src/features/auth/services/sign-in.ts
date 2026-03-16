import { supabase } from "@/lib/supabase/client";

type SignInParams = {
  email: string;
  password: string;
};

export async function signIn({ email, password }: SignInParams) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}