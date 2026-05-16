import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let supabaseClient: SupabaseClient | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  supabaseClient ??= createClient(supabaseUrl, supabasePublishableKey, {
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

  return supabaseClient;
}
