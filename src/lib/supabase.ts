
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

// Create a dummy client that won't throw errors when env vars are missing
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that won't throw errors when methods are called
    // This prevents runtime errors but won't actually work
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        signInWithPassword: () => Promise.resolve({ error: new Error("Supabase not configured") }),
        signUp: () => Promise.resolve({ error: new Error("Supabase not configured") }),
        signOut: () => Promise.resolve({}),
        onAuthStateChange: () => ({ 
          data: { 
            subscription: { 
              unsubscribe: () => {} 
            } 
          } 
        }),
      },
      from: () => ({
        select: () => ({ 
          eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }) }),
          single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") })
        }),
        insert: () => Promise.resolve({ error: new Error("Supabase not configured") }),
        update: () => ({ eq: () => Promise.resolve({ error: new Error("Supabase not configured") }) }),
      }),
    };
  }

  // If environment variables are available, create a real client
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
};

// Export the client
export const supabase = createSupabaseClient() as ReturnType<typeof createClient<Database>>;

// Export a function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Helper functions for document management with vector embeddings
 */

// These are now implemented in src/integrations/supabase/client.ts
// This file now only handles environment variable configuration and fallbacks
