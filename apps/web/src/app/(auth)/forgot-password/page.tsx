import type { Metadata } from "next";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha | GestaraHub" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <PublicAuthShell title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma nova.">
      <ForgotPasswordForm initialEmail={email} />
    </PublicAuthShell>
  );
}
