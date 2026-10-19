import { createSupabaseAdminClient } from "./admin";
import { createSupabaseServerClient } from "./server";

/**
 * Returns a Supabase client configured for the current tenant context.
 * In authenticated requests (cookies present), returns the SSR client so RLS applies using auth.uid().
 * In background or script contexts where cookies are not available, falls back to the admin client.
 */
export async function getClientForTenant() {
  try {
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    if (user) {
      return serverClient;
    }
  } catch {
    // Non-cookie environment (e.g. background tasks, seed or direct scripts)
  }
  return createSupabaseAdminClient();
}
