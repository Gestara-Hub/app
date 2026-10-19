import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = headerStore.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

export interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Checks whether an action exceeds the rate limit.
 * Uses atomic sliding window stored in Postgres.
 * Returns true if allowed, false if limit exceeded.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: options.key,
      p_max_points: options.maxRequests,
      p_window_seconds: options.windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] Erro ao verificar rate limit:", error);
      // Fail-open in case of transient DB error so users are not locked out
      return true;
    }

    return Boolean(data);
  } catch (err) {
    console.error("[rate-limit] Falha inesperada ao checar rate limit:", err);
    return true;
  }
}

/**
 * Resets the rate limit counter for a key (e.g. after successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc("reset_rate_limit", { p_key: key });
  } catch (err) {
    console.error("[rate-limit] Falha ao resetar rate limit:", err);
  }
}
