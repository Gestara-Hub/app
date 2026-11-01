"use client";

import { useTeamWords } from "@/features/settings";
import { useRetainedValue } from "@/lib/use-retained-value";
import { useAfterDialogClose } from "@/lib/use-dialog-presence";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ChevronDown, Copy, Fingerprint, Lock, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/toast";
import { DialogBody } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { userInitials } from "@/lib/session";
import {
  auditActionLabel,
  auditEntityTypeLabel,
  userProfileLabel,
} from "@/lib/labels";
import { formatDateTime } from "@gestarahub/core/format";
import type { AuditLogEntry } from "@gestarahub/contracts";
import { useModel } from "@/features/auth";
import { AuditEntityIcon, auditActionClass, auditTargetHref } from "../audit-meta";

// Chip discreto (rótulo neutro).
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

interface AuditLogDetailDialogProps {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Registro aberto em drawer a direita (01/11/2026, como os outros detalhes):
 * autor, acao, alvo (com atalho para a tela dele quando existe), alteracoes e
 * os detalhes tecnicos recolhidos, com o JSON para copiar la dentro.
 */
export function AuditLogDetailDialog({
  entry: entryProp,
  open,
  onOpenChange,
}: AuditLogDetailDialogProps) {
  const team = useTeamWords();
  const model = useModel();
  const entry = useRetainedValue(entryProp);
  const [showTech, setShowTech] = useState(false);

  // Recolhe os detalhes técnicos depois de fechar (próxima abertura começa resumida).
  useAfterDialogClose(open, () => setShowTech(false));

  if (!entry) return null;

  const hasChanges = Boolean(entry.changes && entry.changes.length > 0);
  const targetHref = auditTargetHref(entry.target.type, entry.target.id);
  const targetLabel = auditEntityTypeLabel(entry.target.type, model, team.title);

  // Exporta o registro bruto (para anexar em um processo formal de auditoria).
  async function copyRecord() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      toast.success("Registro copiado (JSON).");
    } catch {
      toast.error("Não foi possível copiar o registro.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md"
      >
        {/* Hero: autor + ação + quando. */}
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <div className="flex items-start gap-3">
            <Avatar className="size-11">
              <AvatarFallback className="bg-secondary text-sm font-semibold">
                {userInitials(entry.actor.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-left text-base">
                <span className="min-w-0 break-words">{entry.actor.name}</span>
                <Chip>{entry.source ? "Automático" : userProfileLabel(entry.actor.profile, team.title)}</Chip>
                {entry.failed ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="size-3" />
                    Falhou
                  </span>
                ) : null}
                {entry.security ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-3" />
                    Sensível
                  </span>
                ) : null}
              </SheetTitle>
              <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-2 text-left text-sm">
                <span className={auditActionClass(entry.action)}>{auditActionLabel(entry.action)}</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <AuditEntityIcon type={entry.target.type} />
                  {targetLabel}
                </span>
              </SheetDescription>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(entry.timestamp)}
              </p>
              {entry.errorReference ? (
                // O mesmo codigo do registro de erros: leva o suporte direto ao erro.
                <p className="mt-1 text-xs text-muted-foreground">
                  Código do erro: <span className="font-mono font-medium text-foreground select-all">{entry.errorReference}</span>
                </p>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <DialogBody className="space-y-4">
          {/* O que aconteceu, por extenso. */}
          <p className="text-sm text-foreground">{entry.summary}</p>

          {/* Alvo, com o atalho para a tela dele quando existe. */}
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Alvo</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 break-words font-medium">{entry.target.label}</span>
              {entry.target.profile ? <Chip>{userProfileLabel(entry.target.profile, team.title)}</Chip> : null}
              {targetHref ? (
                <Link href={targetHref} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Abrir {targetLabel.toLowerCase()}
                  <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>

          {/* Alterações (foco visual); sem campos registrados, nada aparece. */}
          {hasChanges ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Alterações</p>
              <div className="overflow-hidden rounded-lg border text-sm">
                {entry.changes!.map((c, i) => (
                  <div key={c.field} className={cn("flex items-baseline justify-between gap-3 p-2.5", i > 0 && "border-t")}>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-right">
                      <span className="text-muted-foreground line-through">{c.before}</span>
                      <span className="mx-1.5 text-muted-foreground" aria-hidden>
                        →
                      </span>
                      <span className="font-semibold">{c.after}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Detalhes técnicos (recolhido por padrão), com o JSON para copiar. */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowTech((v) => !v)}
              aria-expanded={showTech}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Fingerprint className="size-4" />
              Detalhes técnicos
              <ChevronDown className={cn("size-4 transition-transform", showTech && "rotate-180")} />
            </button>

            {showTech ? (
              <div className="mt-3 space-y-3">
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">ID do registro</dt>
                  <dd className="text-right font-mono break-all select-all">{entry.id}</dd>
                  <dt className="text-muted-foreground">Data/hora (ISO)</dt>
                  <dd className="text-right font-mono break-all select-all">{entry.timestamp}</dd>
                  <dt className="text-muted-foreground">{entry.source ? "Origem" : "ID do autor"}</dt>
                  <dd className="text-right font-mono break-all select-all">{entry.source ?? entry.actor.userId}</dd>
                  {entry.target.id ? (
                    <>
                      <dt className="text-muted-foreground">ID do alvo</dt>
                      <dd className="text-right font-mono break-all select-all">{entry.target.id}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Organização</dt>
                  <dd className="text-right font-mono break-all select-all">{entry.organizationId}</dd>
                  <dt className="text-muted-foreground">Unidade</dt>
                  <dd className="text-right font-mono break-all select-all">{entry.unitId}</dd>
                </dl>
                <Button type="button" variant="outline" onClick={copyRecord} className="gap-1.5">
                  <Copy className="size-4" />
                  Copiar registro (JSON)
                </Button>
              </div>
            ) : null}
          </div>

          {/* Nota de imutabilidade */}
          <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <Lock className="size-3 shrink-0" />
            Registro imutável: não pode ser editado nem removido.
          </p>
        </DialogBody>

        <div className="flex shrink-0 justify-end border-t border-border/40 bg-background p-6 pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
