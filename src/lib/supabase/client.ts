"use client";

import { createClient } from "@supabase/supabase-js";
import { env, validateEnv } from "../utils/env";

validateEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);