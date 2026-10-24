"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: FormState = {};

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signInAction, INITIAL);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar no painel</CardTitle>
        <CardDescription>Use seu e-mail e sua senha. Depois, o código do aplicativo autenticador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next} />
          {notice ? (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required className="text-base md:text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="text-base md:text-sm" />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Continuar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
