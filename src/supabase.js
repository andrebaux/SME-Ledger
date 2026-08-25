import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- Auth ---

export async function signUpWithPassword(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

// --- Per-user ledger data ---

export async function loadData(userId) {
  const { data, error } = await supabase
    .from("ledger_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Load error", error);
    return null;
  }
  return data ? data.data : null;
}

export async function saveData(userId, payload) {
  const { error } = await supabase
    .from("ledger_data")
    .upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() });
  if (error) console.error("Save error", error);
}
