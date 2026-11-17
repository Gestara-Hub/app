"use client";

import { RequiredMark } from "@/components/form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userProfileLabel } from "@/lib/labels";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from "@/lib/password-rules";
import { GoogleDivider, GoogleSignInButton } from "@/features/auth";
import type { UserProfile } from "@gestarahub/contracts";
import { acceptInvitationAction } from "@/services/users/actions";
import { startNavigationProgress } from "@/lib/unsaved-changes";

const acceptInviteSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

interface AcceptInviteFormProps {
  token: string;
  name: string;
  email: string;
  organizationName: string;
  profile: UserProfile;
}

export function AcceptInviteForm({
  token,
  name,
  email,
  organizationName,
  profile,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: AcceptInviteFormValues) => {
    setSubmitting(true);
    try {
      const res = await acceptInvitationAction({
        token,
        password: values.password,
      });

      if (!res.ok) {
        toast.error(res.message || "Não foi possível aceitar o convite.");
        setSubmitting(false);
        return;
      }

      toast.success("Conta pronta. Você já está na equipe.");
      startNavigationProgress({ immediate: true });
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Ocorreu um erro inesperado ao aceitar o convite.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quem foi convidado e com qual acesso */}
      <dl className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Espaço</dt>
          <dd className="min-w-0 break-words text-right font-medium text-foreground">{organizationName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Nome</dt>
          <dd className="min-w-0 break-words text-right text-foreground">{name}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="min-w-0 break-all text-right text-foreground">{email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
          <dt className="text-muted-foreground">Acesso</dt>
          <dd>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 font-semibold text-primary">
              {userProfileLabel(profile)}
            </Badge>
          </dd>
        </div>
      </dl>

      {/* Com a conta Google do e-mail convidado, sem criar senha. */}
      <GoogleSignInButton invite={token} placement="invite" />
      <GoogleDivider label="ou crie uma senha" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">
            <span>
              Nova senha
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">
            <span>
              Confirmar nova senha
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button type="submit" disabled={submitting} className="w-full gap-2">
          {submitting ? "Salvando..." : "Entrar no sistema"}
          {submitting ? null : <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>
    </div>
  );
}
