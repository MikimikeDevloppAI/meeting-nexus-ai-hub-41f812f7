
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

// Get Supabase URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that we have the required environment variables
if (!supabaseUrl) {
  console.error("Missing VITE_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_ANON_KEY environment variable");
}

// Create and export the Supabase client with fallback to empty strings to prevent runtime crashes
// The actual functionality won't work until proper credentials are provided
export const supabase = createClient<Database>(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

// Export a function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};
