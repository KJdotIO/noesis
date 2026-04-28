import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: {
        getItem: async (key) => {
          const value = await browser.storage.local.get(key);
          return typeof value[key] === "string" ? value[key] : null;
        },
        setItem: async (key, value) => {
          await browser.storage.local.set({ [key]: value });
        },
        removeItem: async (key) => {
          await browser.storage.local.remove(key);
        },
      },
    },
  });
}
