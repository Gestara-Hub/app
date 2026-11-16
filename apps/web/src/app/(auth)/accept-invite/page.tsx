import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { PublicAuthShell } from "@/components/shared/public-auth-shell";
import { Button } from "@/components/ui/button";
import { validateInvitationTokenAction } from "@/services/users/actions";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = {
  title: "Convite para a equipe | GestaraHub",
  description: "Aceite o convite para fazer parte da equipe no GestaraHub.",
};

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

/** Mesmo visual de /login e /reset-password (PublicAuthShell). */
function Notice({
  tone,
  icon,
  children,
}: {
  tone: "danger" | "warning" | "success";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const color = {
    danger: "border-destructive/30 bg-destructive/10",
    warning: "border-amber-500/30 bg-amber-500/10",
    success: "border-emerald-500/30 bg-emerald-500/10",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm text-foreground ${color}`}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  const result = await validateInvitationTokenAction(params.token);

  if (result.status === "invalid") {
    return (
      <PublicAuthShell title="Convite inválido" subtitle="Este link não existe ou foi cancelado.">
        <div className="space-y-5">
          <Notice tone="danger" icon={<AlertCircle className="size-5 text-destructive" />}>
            Use o link completo que veio no e-mail do convite.
          </Notice>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      </PublicAuthShell>
    );
  }

  if (result.status === "expired") {
    return (
      <PublicAuthShell title="Convite vencido" subtitle="O convite vale por 7 dias.">
        <div className="space-y-5">
          <Notice tone="warning" icon={<Clock className="size-5 text-amber-600 dark:text-amber-400" />}>
            O convite para <strong>{result.email}</strong> venceu. Peça a quem convidou para enviar outro.
          </Notice>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      </PublicAuthShell>
    );
  }

  if (result.status === "accepted") {
    return (
      <PublicAuthShell title="Convite já aceito" subtitle="Sua senha já está definida.">
        <div className="space-y-5">
          <Notice tone="success" icon={<CheckCircle2 className="size-5 text-emerald-600" />}>
            O convite para <strong>{result.email}</strong> já foi aceito. Entre com seu e-mail e sua senha.
          </Notice>
          <Button asChild className="w-full">
            <Link href="/login">Entrar</Link>
          </Button>
        </div>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell title="Defina sua senha" subtitle={`Você recebeu um convite para a equipe de ${result.organizationName}.`}>
      <AcceptInviteForm
        token={result.token}
        name={result.name}
        email={result.email}
        organizationName={result.organizationName}
        profile={result.profile}
      />
    </PublicAuthShell>
  );
}
