"use client";

import { RequiredMark } from "@/components/form";
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
  sendAccessEmailCodeAction,
  type AccessEmailStatus,
} from "@/app/(auth)/email-change-actions";
import { focusField } from "@/lib/form-errors";
import { isValidEmail } from "@/lib/email-format";

type Field = "newEmail" | "password" | "code";

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Label htmlFor={htmlFor}>
      <span>
        {children}
        <RequiredMark />
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
  const [code, setCode] = useState("");
  // Quem entra pelo Google: o codigo vai para o e-mail atual.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [sendingCode, startSendingCode] = useTransition();
  const [error, setError] = useState<{ message: string; field?: Field } | null>(null);
  // Erro de um campo: o foco vai para ele (doc 07 §2.10).
  useEffect(() => {
    if (!error?.field) return;
    const ids: Partial<Record<Field, string>> = { newEmail: "access-new-email", code: "access-code", password: "access-password" };
    const id = ids[error.field];
    if (id) focusField(id);
  }, [error]);
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

  const usesCode = status?.ok === true && status.canChange && status.proof === "code";

  const sendCode = () => {
    setError(null);
    startSendingCode(async () => {
      const result = await sendAccessEmailCodeAction();
      if (result.ok) setCodeSentTo(result.maskedEmail);
      else setError({ message: result.message, field: "code" });
    });
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!newEmail.trim()) return setError({ message: "Informe o novo e-mail.", field: "newEmail" });
    if (!isValidEmail(newEmail)) return setError({ message: "Informe um e-mail válido.", field: "newEmail" });
    if (usesCode && code.length !== 6) return setError({ message: "Digite os 6 números do e-mail.", field: "code" });
    if (!usesCode && !password) return setError({ message: "Informe sua senha atual.", field: "password" });
    startTransition(async () => {
      const result = await requestAccessEmailChangeAction(usesCode ? { newEmail, code } : { newEmail, password });
      if (result.ok) {
        setSentTo(result.newEmail);
        setPassword("");
        setCode("");
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
        <p className="text-sm text-muted-foreground">Na demonstração o e-mail de acesso não muda.</p>
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

  // Erro de um campo: logo abaixo dele, como nos outros formularios (FieldShell).
  const fieldError = error?.field ? (
    <p id="access-error" role="alert" className="text-xs text-destructive">
      {error.message}
    </p>
  ) : null;

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
            onChange={(event) => {
              setNewEmail(event.target.value);
              if (error?.field === "newEmail") setError(null);
            }}
            disabled={pending}
            aria-invalid={error?.field === "newEmail" || undefined}
            aria-describedby={error?.field === "newEmail" ? "access-error" : undefined}
          />
          {error?.field === "newEmail" ? fieldError : null}
        </div>
        {usesCode ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <RequiredLabel htmlFor="access-code">Código do e-mail atual</RequiredLabel>
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || pending}
                className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                {sendingCode ? "Enviando..." : codeSentTo ? "Enviar de novo" : "Enviar código"}
              </button>
            </div>
            <Input
              id="access-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error?.field === "code") setError(null);
              }}
              disabled={pending}
              aria-invalid={error?.field === "code" || undefined}
              aria-describedby={error?.field === "code" ? "access-error" : undefined}
              className="font-mono tracking-[0.3em]"
            />
            {error?.field === "code" ? fieldError : null}
            <p className="text-xs text-muted-foreground">
              {codeSentTo
                ? `Enviamos o código para ${codeSentTo}. Vale por 10 minutos.`
                : "Você entra pelo Google: confirme com um código no seu e-mail atual."}{" "}
              Depois, o novo e-mail recebe um link e você cria uma senha ao confirmar.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <RequiredLabel htmlFor="access-password">Senha atual</RequiredLabel>
            <Input
              id="access-password"
              type="password"
              autoComplete="current-password"
              placeholder="Confirme com sua senha"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error?.field === "password") setError(null);
              }}
              disabled={pending}
              aria-invalid={error?.field === "password" || undefined}
              aria-describedby={error?.field === "password" ? "access-error" : undefined}
            />
            {error?.field === "password" ? fieldError : null}
            <p className="text-xs text-muted-foreground">
              Mandamos um link para o novo e-mail. O atual recebe um aviso quando a troca for feita.
            </p>
          </div>
        )}
        {/* Erro sem campo (ex.: falha geral) fica no fim; o de um campo vai embaixo dele. */}
        {error && !error.field ? (
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
