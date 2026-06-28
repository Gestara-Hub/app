"use client";

import { useFormStatus } from "react-dom";
import { signIn } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function LoginForm({ from }: { from: string }) {
  return (
    <form action={signIn} className="space-y-4">
      <input type="hidden" name="from" value={from} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue="marcelo@cortenobre.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          defaultValue="123456"
          autoComplete="current-password"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
