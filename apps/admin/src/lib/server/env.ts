import "server-only";
import { z } from "zod";

const DEFAULT_LOCAL_URL = "http://127.0.0.1:55321";
// Chave anonima publica do Supabase local (a mesma do app dos clientes).
const DEFAULT_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  PLATFORM_DATABASE_URL: z.string().min(10, "PLATFORM_DATABASE_URL ausente (rode pnpm admin:setup)."),
  ADMIN_SESSION_SECRET: z.string().min(32, "ADMIN_SESSION_SECRET precisa de 32+ caracteres."),
  ADMIN_ENV_LABEL: z.enum(["local", "staging", "production"]).default("local"),
  // Opcionais: sem e-mail o painel funciona e so registra no log; sem segredo a rotina diaria recusa.
  MAILERSEND_API_KEY: z.string().optional(),
  MAILERSEND_FROM_EMAIL: z.string().email().optional(),
  MAILERSEND_FROM_NAME: z.string().optional(),
  WEB_APP_URL: z.string().url().default("http://localhost:3200"),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  // So o modulo auth-admin usa esta chave (convidar, reiniciar 2FA). Sem ela o convite fica desligado.
  ADMIN_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ADMIN_PUBLIC_URL: z.string().url().default("http://localhost:3201"),
});

export type AdminEnv = z.infer<typeof schema>;

let cached: AdminEnv | undefined;

export function getEnv(): AdminEnv {
  if (cached) return cached;
  const isProd = process.env.NODE_ENV === "production";
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || (isProd ? "" : DEFAULT_LOCAL_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isProd ? "" : DEFAULT_LOCAL_ANON_KEY),
    PLATFORM_DATABASE_URL: process.env.PLATFORM_DATABASE_URL,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    ADMIN_ENV_LABEL: process.env.ADMIN_ENV_LABEL || undefined,
    MAILERSEND_API_KEY: process.env.MAILERSEND_API_KEY || undefined,
    MAILERSEND_FROM_EMAIL: process.env.MAILERSEND_FROM_EMAIL || undefined,
    MAILERSEND_FROM_NAME: process.env.MAILERSEND_FROM_NAME || undefined,
    WEB_APP_URL: process.env.WEB_APP_URL || undefined,
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    ADMIN_SERVICE_ROLE_KEY: process.env.ADMIN_SERVICE_ROLE_KEY || undefined,
    ADMIN_PUBLIC_URL: process.env.ADMIN_PUBLIC_URL || undefined,
  });
  if (!parsed.success) {
    // Diz so o nome da variavel e o motivo; nunca o valor.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração do painel incompleta: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
