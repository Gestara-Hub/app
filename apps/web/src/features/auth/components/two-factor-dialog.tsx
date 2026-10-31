"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, Download, KeyRound, Loader2, Mail, Smartphone } from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCountdown } from "@/hooks/use-countdown";
import {
  confirmTotpEnrollmentAction,
  disableTwoFactorAction,
  enableEmailTwoFactorAction,
  forgetAllTrustedDevicesAction,
  forgetTrustedDeviceAction,
  getTwoFactorStatusAction,
  listTrustedDevicesAction,
  regenerateRecoveryCodesAction,
  removeTwoFactorMethodAction,
  sendSecurityEmailCodeAction,
  startTotpEnrollmentAction,
  type TrustedDeviceItem,
} from "@/app/(auth)/two-factor-actions";

type Status = { app: boolean; email: boolean; maskedEmail: string; recoveryLeft: number };

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "google" }
  | { kind: "demo" }
  | { kind: "overview" }
  | { kind: "enroll-app"; factorId: string; qrCode: string; secret: string }
  | { kind: "enroll-email" }
  | { kind: "disable"; method: "app" | "email" | "recovery" }
  /** Remove `method` e mantem o outro: confirma com o codigo do que fica. */
  | { kind: "remove"; method: "app" | "email" }
  | { kind: "regenerate"; method: "app" | "email" }
  | { kind: "recovery-codes"; codes: string[] };

/** Campo do codigo de 6 numeros (do aplicativo ou do e-mail). */
function CodeField({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="ml-0.5 text-destructive">*</span>
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="text-center font-mono text-lg tracking-[0.5em] md:text-lg"
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Campo do codigo de recuperacao (8 letras e numeros, com ou sem hifen). */
function RecoveryField({
  id,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Código de recuperação
        <span className="ml-0.5 text-destructive">*</span>
      </Label>
      <Input
        id={id}
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={9}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9))}
        placeholder="ABCD-EFGH"
        className="text-center font-mono text-lg tracking-widest md:text-lg"
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Um método (app, e-mail ou recuperação): estado e, desligado, o botão para usar. */
function MethodRow({
  icon,
  title,
  description,
  on,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  on: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between first:pt-1 last:pb-1">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground mt-0.5">
          {icon}
        </span>
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <Badge variant={on ? "default" : "secondary"}>{on ? "Ligada" : "Desligada"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
    </div>
  );
}

/**
 * "Seguranca" no menu do usuario (doc 17): liga a verificacao em duas etapas
 * com aplicativo autenticador ou codigo por e-mail, mostra os dispositivos
 * lembrados, remove um metodo (com os dois ligados) e desliga tudo. Conta so
 * do Google nao usa: a verificacao fica na
 * conta Google. Desligada, abre na escolha dos dois metodos (tambem pelo aviso
 * de seguranca).
 */
export function TwoFactorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [status, setStatus] = useState<Status>({ app: false, email: false, maskedEmail: "", recoveryLeft: 0 });
  const [devices, setDevices] = useState<TrustedDeviceItem[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sending, startSending] = useTransition();
  const resend = useCountdown();

  const loadDevices = useCallback(async () => {
    const result = await listTrustedDevicesAction();
    if (result.ok) setDevices(result.devices);
  }, []);

  const applyStatus = useCallback(
    async (result: Awaited<ReturnType<typeof getTwoFactorStatusAction>>) => {
      if (!result.ok) return setView({ kind: "error", message: result.message });
      if (result.googleOnly) return setView({ kind: "google" });
      if (result.demo) return setView({ kind: "demo" });
      setStatus({ app: result.app, email: result.email, maskedEmail: result.maskedEmail, recoveryLeft: result.recoveryLeft });
      setView({ kind: "overview" });
      if (result.enabled) await loadDevices();
      else setDevices([]);
    },
    [loadDevices],
  );

  const refresh = useCallback(async () => applyStatus(await getTwoFactorStatusAction()), [applyStatus]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void getTwoFactorStatusAction().then((result) => {
      if (alive) void applyStatus(result);
    });
    return () => {
      alive = false;
      setView({ kind: "loading" });
      setCode("");
      setError(null);
      setSentTo(null);
    };
  }, [open, applyStatus]);

  const go = (next: View) => {
    setCode("");
    setError(null);
    setSentTo(null);
    setView(next);
  };

  const startAppEnrollment = () => {
    startTransition(async () => {
      const result = await startTotpEnrollmentAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      go({ kind: "enroll-app", factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
    });
  };

  const sendEmailCode = (purpose: "enable" | "disable" | "recovery") => {
    setError(null);
    startSending(async () => {
      const result = await sendSecurityEmailCodeAction({ purpose });
      if (result.ok) {
        setSentTo(result.maskedEmail);
        resend.start(result.resendInSeconds);
        return;
      }
      if (result.resendInSeconds) {
        // Ja havia um codigo recente: ele continua valendo.
        setSentTo(status.maskedEmail);
        resend.start(result.resendInSeconds);
        return;
      }
      setError(result.message);
    });
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (view.kind !== "enroll-app" && view.kind !== "enroll-email" && view.kind !== "disable" && view.kind !== "regenerate" && view.kind !== "remove") return;
    setError(null);
    startTransition(async () => {
      const result =
        view.kind === "enroll-app"
          ? await confirmTotpEnrollmentAction({ factorId: view.factorId, code })
          : view.kind === "enroll-email"
            ? await enableEmailTwoFactorAction({ code })
            : view.kind === "regenerate"
              ? await regenerateRecoveryCodesAction({ code, method: view.method })
              : view.kind === "remove"
                ? await removeTwoFactorMethodAction({ code, method: view.method })
                : await disableTwoFactorAction({ code, method: view.method });
      if (!result.ok) {
        setError(result.message);
        setCode("");
        return;
      }
      setCode("");
      const codes: string[] | undefined = "recoveryCodes" in result ? (result.recoveryCodes as string[] | undefined) : undefined;
      if (view.kind === "regenerate") toast.success("Novos códigos de recuperação gerados.");
      else if (view.kind === "remove") {
        toast.success(
          view.method === "app"
            ? "Aplicativo removido. O login pede o código do e-mail."
            : "Código por e-mail removido. O login pede o código do aplicativo.",
        );
      } else toast.success(view.kind === "disable" ? "Verificação em duas etapas desligada." : "Verificação em duas etapas ligada.");
      await refresh();
      // Os codigos aparecem so desta vez: a pessoa precisa guardar antes de fechar.
      if (codes && codes.length > 0) go({ kind: "recovery-codes", codes });
    });
  };

  const forget = (device: TrustedDeviceItem) => {
    startTransition(async () => {
      const result = await forgetTrustedDeviceAction({ id: device.id, current: device.current });
      if (!result.ok) return void toast.error(result.message);
      toast.success("Dispositivo esquecido.");
      await loadDevices();
    });
  };

  const forgetAll = () => {
    startTransition(async () => {
      const result = await forgetAllTrustedDevicesAction();
      if (!result.ok) return void toast.error(result.message);
      toast.success("Dispositivos esquecidos.");
      await loadDevices();
    });
  };

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione os códigos e copie.");
    }
  };

  const downloadCodes = (codes: string[]) => {
    const text = ["Códigos de recuperação do GestaraHub", "Cada código vale uma vez. Guarde em lugar seguro.", "", ...codes, ""].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gestarahub-codigos-de-recuperacao.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Chave copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave e copie.");
    }
  };

  const enabled = status.app || status.email;
  // Com os dois ligados, cada um tem "Remover"; com um so, e o "Desligar".
  const bothOn = status.app && status.email;
  const isForm =
    view.kind === "enroll-app" || view.kind === "enroll-email" || view.kind === "disable" || view.kind === "regenerate" || view.kind === "remove";
  const emailStep =
    view.kind === "enroll-email" ||
    ((view.kind === "disable" || view.kind === "regenerate") && view.method === "email") ||
    (view.kind === "remove" && view.method === "app");
  const emailPurpose = view.kind === "disable" || view.kind === "remove" ? "disable" : view.kind === "regenerate" ? "recovery" : "enable";
  const codeReady = view.kind === "disable" && view.method === "recovery" ? code.replace(/-/g, "").length === 8 : code.length === 6;
  const waitingSend = emailStep && !sentTo;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Segurança</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">Verificação em duas etapas no login.</SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody className="space-y-4">
            {view.kind === "loading" ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
              </div>
            ) : null}

            {view.kind === "error" ? <p className="text-sm text-destructive">{view.message}</p> : null}

            {view.kind === "google" ? (
              <p className="text-sm text-muted-foreground">
                Você entra pelo Google. A verificação em duas etapas fica na sua conta Google.
              </p>
            ) : null}

            {view.kind === "demo" ? (
              <p className="text-sm text-muted-foreground">Na demonstração, a verificação fica desligada.</p>
            ) : null}

            {view.kind === "overview" ? (
              <div className="space-y-4">
                {!enabled ? (
                  <p className="text-sm text-muted-foreground">Escolha como receber o código depois da senha.</p>
                ) : null}
                <div className="divide-y divide-border/60">
                  <MethodRow
                    icon={<Smartphone className="size-4" aria-hidden />}
                    title="Aplicativo autenticador"
                    description={status.app ? "O login pede o código do aplicativo." : "Mais seguro. Código no app do celular."}
                    on={status.app}
                    action={
                      status.app ? (
                        bothOn ? (
                          <Button type="button" variant="outline" onClick={() => go({ kind: "remove", method: "app" })} disabled={pending}>
                            Remover
                          </Button>
                        ) : undefined
                      ) : (
                        <Button type="button" variant="outline" onClick={startAppEnrollment} disabled={pending}>
                          Usar aplicativo
                        </Button>
                      )
                    }
                  />
                  <MethodRow
                    icon={<Mail className="size-4" aria-hidden />}
                    title="Código por e-mail"
                    description={
                      status.email
                        ? `O código vai para ${status.maskedEmail}.`
                        : "Mais simples. Código no seu e-mail."
                    }
                    on={status.email}
                    action={
                      status.email ? (
                        bothOn ? (
                          <Button type="button" variant="outline" onClick={() => go({ kind: "remove", method: "email" })} disabled={pending}>
                            Remover
                          </Button>
                        ) : undefined
                      ) : (
                        <Button type="button" variant="outline" onClick={() => go({ kind: "enroll-email" })} disabled={pending}>
                          Usar e-mail
                        </Button>
                      )
                    }
                  />

                  {enabled ? (
                    <MethodRow
                      icon={<KeyRound className="size-4" aria-hidden />}
                      title="Códigos de recuperação"
                      description={
                        status.recoveryLeft > 0
                          ? `${status.recoveryLeft} ${status.recoveryLeft === 1 ? "código vale" : "códigos valem"}. Servem se você perder o aplicativo ou o e-mail.`
                          : "Você não tem códigos valendo. Gere novos e guarde em lugar seguro."
                      }
                      on={status.recoveryLeft > 0}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => go({ kind: "regenerate", method: status.app ? "app" : "email" })}
                          disabled={pending}
                        >
                          Gerar novos códigos
                        </Button>
                      }
                    />
                  ) : null}
                </div>

                {enabled ? (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Dispositivos lembrados</p>
                      {devices.length > 0 ? (
                        <Button type="button" variant="ghost" onClick={forgetAll} disabled={pending}>
                          Esquecer todos
                        </Button>
                      ) : null}
                    </div>
                    {devices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum dispositivo lembrado.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {devices.map((device) => (
                          <li key={device.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium break-words text-foreground">
                                {device.label}
                                {device.current ? (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">Este dispositivo</span>
                                ) : null}
                              </p>
                              <p className="text-xs text-muted-foreground">{device.lastUsed}</p>
                            </div>
                            <Button type="button" variant="ghost" onClick={() => forget(device)} disabled={pending}>
                              Esquecer
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {view.kind === "enroll-app" ? (
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Abra o Google Authenticator ou outro aplicativo autenticador.</li>
                  <li>Leia o QR code abaixo.</li>
                  <li>Digite o código que aparecer no aplicativo.</li>
                </ol>
                <div className="flex justify-center">
                  {/* QR code em SVG gerado pelo Supabase (data URL). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={view.qrCode} alt="QR code para o aplicativo autenticador" className="size-44 rounded-lg bg-white p-2" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Não consegue ler? Digite esta chave no aplicativo:</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs break-all">
                      {view.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copiar chave"
                      onClick={() => copySecret(view.secret)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <CodeField
                  id="two-factor-enroll-code"
                  label="Código do aplicativo"
                  value={code}
                  onChange={setCode}
                  disabled={pending}
                  error={error}
                />
              </div>
            ) : null}

            {emailStep ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {view.kind === "disable"
                    ? "Para desligar, confirme com um código do e-mail."
                    : view.kind === "remove"
                      ? "Para remover o aplicativo, confirme com um código do e-mail. Depois, o login pede o código do e-mail."
                      : view.kind === "regenerate"
                        ? "Para gerar novos códigos, confirme com um código do e-mail. Os antigos deixam de valer."
                        : `Vamos mandar um código para ${status.maskedEmail}.`}
                </p>
                {sentTo ? (
                  <>
                    <p className="text-sm text-foreground">Enviamos um código para {sentTo}.</p>
                    <CodeField
                      id="two-factor-email-code"
                      label="Código do e-mail"
                      value={code}
                      onChange={setCode}
                      disabled={pending}
                      error={error}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => sendEmailCode(emailPurpose)}
                      disabled={sending || resend.seconds > 0}
                    >
                      {resend.seconds > 0 ? `Reenviar código em ${resend.seconds} s` : "Reenviar código"}
                    </Button>
                  </>
                ) : error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}

            {view.kind === "disable" && view.method === "app" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para desligar, digite um código do aplicativo. Depois disso, o login pede só a senha.
                </p>
                <CodeField
                  id="two-factor-disable-code"
                  label="Código do aplicativo"
                  value={code}
                  onChange={setCode}
                  disabled={pending}
                  error={error}
                />
                <div className="flex flex-col items-start gap-1">
                  {status.email ? (
                    <button
                      type="button"
                      onClick={() => go({ kind: "disable", method: "email" })}
                      className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Receber código por e-mail
                    </button>
                  ) : null}
                  {status.recoveryLeft > 0 ? (
                    <button
                      type="button"
                      onClick={() => go({ kind: "disable", method: "recovery" })}
                      className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Perdi o aplicativo: usar código de recuperação
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {view.kind === "remove" && view.method === "email" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para remover o código por e-mail, digite um código do aplicativo. Depois, o login pede o código do aplicativo.
                </p>
                <CodeField
                  id="two-factor-remove-code"
                  label="Código do aplicativo"
                  value={code}
                  onChange={setCode}
                  disabled={pending}
                  error={error}
                />
              </div>
            ) : null}

            {view.kind === "disable" && view.method === "recovery" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite um dos seus códigos de recuperação. Ele vale uma vez. Depois você pode ligar a verificação de novo com o aparelho novo.
                </p>
                <RecoveryField id="two-factor-recovery-code" value={code} onChange={setCode} disabled={pending} error={error} />
              </div>
            ) : null}

            {view.kind === "regenerate" && view.method === "app" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para gerar novos códigos de recuperação, digite um código do aplicativo. Os antigos deixam de valer.
                </p>
                <CodeField
                  id="two-factor-regenerate-code"
                  label="Código do aplicativo"
                  value={code}
                  onChange={setCode}
                  disabled={pending}
                  error={error}
                />
                {status.email ? (
                  <button
                    type="button"
                    onClick={() => go({ kind: "regenerate", method: "email" })}
                    className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Receber código por e-mail
                  </button>
                ) : null}
              </div>
            ) : null}

            {view.kind === "recovery-codes" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Guarde estes códigos em lugar seguro (gerenciador de senhas ou papel). Cada um vale uma vez e serve se você perder o aplicativo ou o e-mail. Eles não aparecem de novo.
                </p>
                <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-3 font-mono text-sm">
                  {view.codes.map((item) => (
                    <li key={item} className="text-center select-all">
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => copyCodes(view.codes)}>
                    <Copy className="size-4" /> Copiar
                  </Button>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => downloadCodes(view.codes)}>
                    <Download className="size-4" /> Baixar arquivo
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogBody>

          <div className="shrink-0 border-t border-border/40 bg-background p-6 pt-4 flex items-center justify-end gap-2">
            {isForm ? (
              <>
                <Button type="button" variant="outline" disabled={pending} onClick={() => go({ kind: "overview" })}>
                  Cancelar
                </Button>
                {waitingSend ? (
                  <Button
                    type="button"
                    onClick={() => sendEmailCode(emailPurpose)}
                    disabled={sending}
                    className="gap-2"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Enviar código
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant={view.kind === "disable" || view.kind === "remove" ? "destructive" : "default"}
                    disabled={pending || !codeReady}
                  >
                    {pending
                      ? "Conferindo..."
                      : view.kind === "disable"
                        ? "Desligar"
                        : view.kind === "remove"
                          ? "Remover"
                          : view.kind === "regenerate"
                            ? "Gerar códigos"
                            : "Ligar"}
                  </Button>
                )}
              </>
            ) : view.kind === "recovery-codes" ? (
              <Button type="button" onClick={() => go({ kind: "overview" })}>
                Guardei os códigos
              </Button>
            ) : view.kind === "overview" && enabled ? (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => go({ kind: "disable", method: status.app ? "app" : "email" })}
                >
                  Desligar
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
