"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userProfileLabel } from "@/lib/labels";
import { GoogleDivider, GoogleSignInButton } from "@/features/auth";
import type { UserProfile } from "@gestarahub/contracts";
import { acceptInvitationAction } from "@/services/users/actions";

const acceptInviteSchema = z
  .object({
    password: z
      .string()
      .min(6, "A senha deve ter no mínimo 6 caracteres."),
    confirmPassword: z
      .string()
      .min(6, "Confirme sua senha."),
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

      toast.success("Conta configurada com sucesso! Bem-vindo(a) à equipe.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Ocorreu um erro inesperado ao aceitar o convite.");
      setSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border bg-card shadow-xl max-w-md w-full mx-auto">
      <CardHeader className="text-center pb-4 pt-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          <UserCheck className="size-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Bem-vindo(a) à equipe!
        </CardTitle>
        <CardDescription className="text-xs">
          Defina sua senha para começar a acessar o sistema.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Card do Espaço e Perfil Convidado */}
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Organização:</span>
            <span className="font-bold text-foreground">{organizationName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium text-foreground">{name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">E-mail:</span>
            <span className="font-mono text-[11px] text-foreground">{email}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/60">
            <span className="text-muted-foreground">Perfil de Acesso:</span>
            <Badge variant="outline" className="font-semibold text-[11px] bg-primary/5 text-primary border-primary/30">
              {userProfileLabel(profile)}
            </Badge>
          </div>
        </div>

        {/* Com a conta Google do e-mail convidado, sem criar senha. */}
        <GoogleSignInButton invite={token} placement="invite" />
        <GoogleDivider label="ou crie uma senha" />

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">
              Nova Senha (mínimo 6 caracteres) *
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              className="h-9 text-xs"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs">
              Confirme a Nova Senha *
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Digite a senha novamente"
              className="h-9 text-xs"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full font-bold text-xs gap-2 h-10 shadow-sm mt-2"
          >
            {submitting ? (
              <span>Configurando seu acesso...</span>
            ) : (
              <>
                <span>Ativar Conta e Acessar</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          <span>Acesso seguro com autenticação criptografada</span>
        </div>
      </CardContent>
    </Card>
  );
}
