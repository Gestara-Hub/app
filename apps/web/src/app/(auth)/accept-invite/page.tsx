import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { validateInvitationTokenAction } from "@/services/usersBackend";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = {
  title: "Convite de Equipe | GestaraHub",
  description: "Aceite o convite para fazer parte da equipe no GestaraHub.",
};

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  const params = await searchParams;
  const token = params.token;

  const result = await validateInvitationTokenAction(token);

  if (result.status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="rounded-2xl border bg-card shadow-xl max-w-md w-full text-center p-6 space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Convite Inválido ou Inexistente</CardTitle>
          <CardDescription className="text-xs">
            Este link de convite não foi localizado ou foi revogado. Certifique-se de que utilizou o link completo enviado por e-mail.
          </CardDescription>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href="/login">Ir para o Login</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (result.status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="rounded-2xl border bg-card shadow-xl max-w-md w-full text-center p-6 space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Convite Expirado</CardTitle>
          <CardDescription className="text-xs">
            O prazo deste convite de 7 dias expirou para <strong>{result.email}</strong>. Entre em contato com o administrador do seu espaço para que ele reenvie o convite.
          </CardDescription>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href="/login">Ir para o Login</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (result.status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="rounded-2xl border bg-card shadow-xl max-w-md w-full text-center p-6 space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Convite Já Aceito</CardTitle>
          <CardDescription className="text-xs">
            O convite para <strong>{result.email}</strong> já foi aceito e a senha já está definida. Você pode acessar diretamente o sistema.
          </CardDescription>
          <div className="pt-2">
            <Button asChild size="sm" className="w-full text-xs font-bold">
              <Link href="/login">Acessar o GestaraHub</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <AcceptInviteForm
        token={result.token}
        name={result.name}
        email={result.email}
        organizationName={result.organizationName}
        profile={result.profile}
      />
    </div>
  );
}
