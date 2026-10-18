"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/form";
import { cn } from "@/lib/utils";
import { usersService } from "@/services/usersService";
import { settingsService } from "@/services/settingsService";
import { signIn } from "@/app/(auth)/actions";
import { signupSchema, type SignupValues } from "../signup-schema";

function SubmitButton({ pending, className }: { pending: boolean; className?: string }) {
  return (
    <Button type="submit" disabled={pending} className={cn("gap-2 font-semibold", className)}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Criando sua conta…
        </>
      ) : (
        <>
          Criar conta grátis
          <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}

/** "Já tem conta? Entrar" */
export function SignupLoginLink({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Já tem conta?{" "}
      <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
        Entrar
      </Link>
    </p>
  );
}

interface SignupFormProps {
  /** Prefixo dos ids dos campos. */
  idPrefix: string;
  className?: string;
}

/**
 * Formulario do cadastro rapido (nome e e-mail): valida com Zod, mostra o erro
 * em cada campo e, no mock, entra na conta de demonstracao e segue para /setup.
 */
export function SignupForm({ idPrefix, className }: SignupFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = form.handleSubmit(({ name, email }) => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        // Mock: entra na conta de demonstracao com o nome e o e-mail informados.
        const switchList = await usersService.listForSwitch();
        const targetOption =
          switchList.find((opt) => opt.user.name === "Ana Ribeiro" || opt.user.profile === "owner") ??
          switchList[0];

        if (!targetOption) {
          setSubmitError("Não foi possível criar a conta. Tente novamente.");
          return;
        }

        await settingsService.setActiveTenant(targetOption.organizationId);
        try {
          await usersService.update(targetOption.user.id, { name, email });
        } catch {
          // Ignora se nao puder alterar no mock
        }

        // Direciona para a configuracao inicial do espaco
        await signIn({ ...targetOption.user, name, email }, "/setup");
      } catch (err) {
        console.error("Erro ao cadastrar:", err);
        setSubmitError("Não foi possível criar a conta. Tente novamente.");
      }
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className={cn("space-y-4", className)}>
        <div className="space-y-4">
          <InputText<SignupValues>
            name="name"
            id={`${idPrefix}-name`}
            label="Nome"
            placeholder="Informe seu nome"
            autoComplete="name"
            required
            disabled={isPending}
          />
          <InputText<SignupValues>
            name="email"
            id={`${idPrefix}-email`}
            type="email"
            label="E-mail"
            placeholder="Informe seu e-mail"
            autoComplete="email"
            required
            disabled={isPending}
          />
          <SubmitButton pending={isPending} className="w-full" />
        </div>

        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Ao criar a conta, você aceita os{" "}
          <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      </form>
    </FormProvider>
  );
}
