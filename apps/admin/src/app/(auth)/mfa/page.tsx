import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/server/context";
import { createAuthClient } from "@/lib/server/supabase";
import { safeNext } from "@/lib/safe-redirect";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Segundo fator" };

/**
 * Segundo fator obrigatorio. Com o aplicativo ja cadastrado, pede o codigo; sem
 * ele, mostra o QR para cadastrar (cada recarga cria um fator novo e apaga o
 * que ficou sem confirmar).
 */
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const ctx = await getAdminContext();
  if (ctx.stage === "anonymous") redirect(ctx.hasSession ? `/session/end?reason=${ctx.reason ?? "invalid"}` : "/login");
  if (ctx.stage === "ok") redirect("/");
  const next = safeNext((await searchParams).next);

  const supabase = await createAuthClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.all.find((f) => f.factor_type === "totp" && f.status === "verified");
  if (verified) return <MfaForm mode="verify" factorId={verified.id} next={next} />;

  for (const stale of factors?.all.filter((f) => f.factor_type === "totp" && f.status !== "verified") ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Painel ${ctx.admin.email}` });
  if (error || !data) {
    return <p role="alert" className="text-sm text-destructive">Não foi possível preparar o aplicativo autenticador. Recarregue a página.</p>;
  }
  return (
    <MfaForm mode="enroll" factorId={data.id} next={next} qrCode={data.totp.qr_code} secret={data.totp.secret} />
  );
}
