import "server-only";
import { headers } from "next/headers";

export async function requestInfo(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (h.get("x-real-ip")?.trim() ?? "127.0.0.1");
  return { ip, userAgent: h.get("user-agent") };
}
