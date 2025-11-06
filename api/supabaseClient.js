// api/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// ✅ Initialize Supabase client with your env vars
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
