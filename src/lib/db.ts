import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)");
}

// Server-side client (service role) — used by the worker only. Never ship this key to the browser.
export const db = createClient(url, key, { auth: { persistSession: false } });
