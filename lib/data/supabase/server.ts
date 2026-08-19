import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { withClockSkewRetry } from "./clock-skew-fetch";
import type { Database } from "./database.types";

export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    // Wrapped rather than passed by reference: Next replaces the global `fetch`
    // per request, and this keeps whichever one is current at call time.
    global: { fetch: withClockSkewRetry((input, init) => fetch(input, init)) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}
