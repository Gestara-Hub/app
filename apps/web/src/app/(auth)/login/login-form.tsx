"use client";

import { useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import { signIn } from "../actions";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({ from }: { from: string }) {
  const [isPending, startTransition] = useTransition();

  const methods = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      email: "marcelo@cortenobre.com",
      password: "123456",
    },
  });

  const onSubmit = () => {
    startTransition(async () => {
      await signIn(from);
    });
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        <InputText<LoginFormValues>
          name="email"
          type="email"
          label="E-mail"
          placeholder="seu@email.com"
          required
          disabled={isPending}
        />

        <InputText<LoginFormValues>
          name="password"
          type="password"
          label="Senha"
          required
          disabled={isPending}
        />

        <p className="-mt-1 text-xs text-muted-foreground">
          Login mockado — qualquer credencial entra.
        </p>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </FormProvider>
  );
}
