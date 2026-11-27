"use client";

import { useState } from "react";
import { ExternalLink, KeyRound, ShieldAlert } from "lucide-react";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { RequiredMark } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogBody, useReportDialogSaving } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { focusField } from "@/lib/form-errors";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useReplaceSubaccountKey } from "../hooks/use-online-payments";
import { ASAAS_LOGIN_URL } from "./account-readiness-card";

/**
 * Chave da conta de recebimento sem valer (27/11/2026, doc product/19 "Chave de
 * API da subconta"): o Pix e o link param. O GestaraHub troca a chave; se o dono
 * precisar antes, gera uma no Asaas da propria conta e cadastra aqui (ultimo
 * recurso). O servidor confere que a chave e da mesma conta.
 */
export function ApiKeyInvalidCard({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-destructive/40" data-testid="api-key-invalid">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5 shrink-0" aria-hidden />
            Recebimento online parado
          </CardTitle>
          <CardDescription>
            A chave da sua conta no Asaas deixou de valer. O Pix e o link de pagamento estão parados e já estamos
            resolvendo. Enquanto isso, registre os pagamentos à mão.
          </CardDescription>
        </div>
        {canManage ? (
          <Button variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
            <KeyRound className="size-4" />
            Cadastrar chave nova
          </Button>
        ) : null}
      </CardHeader>
      {canManage ? (
        <CardContent className="text-sm text-muted-foreground">
          Precisa antes? Gere uma chave nova no Asaas e cadastre aqui.
        </CardContent>
      ) : null}
      <ReplaceKeyDrawer open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function ReplaceKeyForm({ onClose }: { onClose: () => void }) {
  const replace = useReplaceSubaccountKey();
  useReportDialogSaving(replace.isPending);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setError("Cole a chave gerada no Asaas.");
      focusField("subaccount-new-key");
      return;
    }
    try {
      await replace.mutateAsync(key);
      toast.success("Chave cadastrada. O recebimento online voltou.");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível cadastrar a chave."));
      focusField("subaccount-new-key");
    }
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
        <SheetTitle className="text-lg font-semibold text-foreground">Cadastrar chave nova</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">Da sua conta de recebimento no Asaas.</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Entre no Asaas com o e-mail da conta de recebimento.</li>
            <li>No menu do perfil, no canto de cima à direita, abra Integrações e a aba Chaves de API.</li>
            <li>Clique em &quot;Gerar chave de API&quot;, dê o nome GestaraHub e copie a chave inteira. Ela aparece uma vez só.</li>
            <li>Cole aqui embaixo e salve.</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            A chave aparece como Desabilitada? Habilite de novo na mesma tela: o recebimento volta sozinho, sem cadastrar
            nada aqui.
          </p>
          <Button asChild variant="outline">
            <a href={ASAAS_LOGIN_URL} target="_blank" rel="noopener noreferrer">
              Abrir o Asaas
              <ExternalLink className="size-4" />
            </a>
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="subaccount-new-key">
              <span>
                Chave de API
                <RequiredMark />
              </span>
            </Label>
            <Input
              id="subaccount-new-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              placeholder="Cole a chave que começa com $aact_"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "subaccount-new-key-error" : undefined}
              disabled={replace.isPending}
              className="text-base md:text-sm"
            />
            {error ? (
              <p id="subaccount-new-key-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Conferimos no Asaas se a chave é desta conta antes de salvar.</p>
            )}
          </div>
        </DialogBody>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={replace.isPending}>
              Cancelar
            </Button>
          </SheetClose>
          <Button type="submit" disabled={replace.isPending}>
            {replace.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </>
  );
}

function ReplaceKeyDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {present ? <ReplaceKeyForm onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}
