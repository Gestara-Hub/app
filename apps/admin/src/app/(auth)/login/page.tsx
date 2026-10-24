import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/server/context";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const REASONS: Record<string, string> = {
  expired: "Sua sessão passou de 8 horas. Entre de novo.",
  invalid: "Sua sessão não é mais válida. Entre de novo.",
  not_admin: "Esta conta não tem acesso ao painel.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  await redirectIfSignedIn();
  const { next, reason } = await searchParams;
  return <LoginForm next={next ?? ""} notice={reason ? REASONS[reason] : undefined} />;
}
