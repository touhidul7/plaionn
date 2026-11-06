import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

// Proxy refreshes cookies for read-only Server Components. Actions/handlers write them directly.
export async function createSupabaseServerClient(writable = true) {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        if (!writable) return;
        for (const { name, value, options } of items) cookieStore.set(name, value, options);
      },
    },
  });
}

