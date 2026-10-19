import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null si no hay credenciales: la app funciona entonces en modo local (navegador). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
