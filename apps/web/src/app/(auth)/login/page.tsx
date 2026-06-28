import { Scissors } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const target = from && from.startsWith("/") ? from : "/";

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scissors className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Corte Nobre</h1>
          <p className="text-sm text-muted-foreground">
            Acesse o painel de gestão
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Login mockado — qualquer credencial entra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm from={target} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
