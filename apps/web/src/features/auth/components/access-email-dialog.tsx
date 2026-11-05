"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getAccessEmailStatusAction,
  requestAccessEmailChangeAction,
  type AccessEmailStatus,
} from "@/app/(auth)/email-change-actions";

type Field = "newEmail" | "password";

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span aria-hidden className="ml-0.5 text-destructive">
        *
      </span>
    </Label>
  );
}

/**
 * "E-mail de acesso" no menu da conta (05/11/2026): a propria pessoa troca o
 * e-mail com que entra. Pede a senha atual; o e-mail novo recebe um link e a
 * troca so vale ao confirmar.
 */
function AccessEmailForm({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<AccessEmailStatus | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; field?: Field } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void getAccessEmailStatusAction().then((result) => {
      if (alive) setStatus(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!newEmail.trim()) return setError({ message: "Informe o novo e-mail.", field: "newEmail" });
    if (!password) return setError({ message: "Informe sua senha atual.", field: "password" });
    startTransition(async () => {
      const result = await requestAccessEmailChangeAction({ newEmail, password });
      if (result.ok) {
        setSentTo(result.newEmail);
        setPassword("");
        return;
      }
      setError({ message: result.message, field: result.field });
    });
  };

  if (!status) {
    return (
      <DialogBody className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Carregando" />
      </DialogBody>
    );
  }
  if (!status.ok) {
    return (
      <DialogBody>
        <p className="text-sm text-muted-foreground">{status.message}</p>
      </DialogBody>
    );
  }

  const current = (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">E-mail de acesso atual</p>
      <p className="break-words text-sm font-medium text-foreground">{status.email}</p>
    </div>
  );

  if (!status.canChange) {
    return (
      <DialogBody className="space-y-4">
        {current}
        <p className="text-sm text-muted-foreground">
          {status.reason === "google"
            ? "Você entra pelo Google: o e-mail de acesso é o da sua conta Google."
            : "Na demonstração o e-mail de acesso não muda."}
        </p>
      </DialogBody>
    );
  }

  if (sentTo) {
    return (
      <>
        <DialogBody className="space-y-4">
          {current}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-foreground">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="min-w-0 break-words">
              Enviamos um link para <strong className="font-medium">{sentTo}</strong>. A troca só vale depois que você
              confirmar. O link vale por 1 hora.
            </p>
          </div>
        </DialogBody>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 bg-background p-6 pt-4">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogBody className="space-y-4">
        {current}
        <div className="space-y-1.5">
          <RequiredLabel htmlFor="access-new-email">Novo e-mail</RequiredLabel>
          <Input
            id="access-new-email"
            type="email"
            autoComplete="email"
            placeholder="Informe o novo e-mail"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "newEmail" || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <RequiredLabel htmlFor="access-password">Senha atual</RequiredLabel>
          <Input
            id="access-password"
            type="password"
            autoComplete="current-password"
            placeholder="Confirme com sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "password" || undefined}
          />
          <p className="text-xs text-muted-foreground">
            Mandamos um link para o novo e-mail. O atual recebe um aviso quando a troca for feita.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        ) : null}
      </DialogBody>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 bg-background p-6 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar confirmação"}
        </Button>
      </div>
    </form>
  );
}

export function AccessEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">E-mail de acesso</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">O e-mail com que você entra no sistema.</SheetDescription>
        </SheetHeader>
        {open ? <AccessEmailForm onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}
