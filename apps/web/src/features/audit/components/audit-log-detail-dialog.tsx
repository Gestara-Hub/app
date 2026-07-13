"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Fingerprint, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function AuditLogDetailDialog({
  entry,
  open,
  onOpenChange,
}: AuditLogDetailDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTech, setShowTech] = useState(false);
  // Afordância de scroll: fade+chevron quando há conteúdo além da dobra.
  const [scroll, setScroll] = useState({ atTop: true, atBottom: true });

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScroll({
      atTop: el.scrollTop <= 1,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
    });
  }, []);

  // Recalcula ao abrir/trocar registro ou ao expandir os detalhes técnicos.
  useEffect(() => {
    if (!entry || !open) return;
    const id = requestAnimationFrame(updateScroll);
    return () => cancelAnimationFrame(id);
  }, [entry, open, showTech, updateScroll]);

  // Fecha e recolhe os detalhes técnicos (próxima abertura começa resumida).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setShowTech(false);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  if (!entry) return null;

  const hasChanges = Boolean(entry.changes && entry.changes.length > 0);

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Hero: autor + ação + quando. */}
        <DialogHeader className="gap-0 space-y-0 border-b p-5 pr-12">
          <div className="flex items-start gap-3">
            <Avatar className="size-11">
              <AvatarFallback className="bg-secondary text-sm font-semibold">
                {userInitials(entry.actor.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-left text-base">
                <span className="truncate">{entry.actor.name}</span>
                <Chip>{userProfileLabel(entry.actor.profile)}</Chip>
                {entry.security ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                    <ShieldAlert className="size-3" />
                    Sensível
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="mt-1 text-left text-sm text-foreground">
                {auditActionLabel(entry.action)} ·{" "}
                {auditEntityTypeLabel(entry.target.type)}
              </DialogDescription>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(entry.timestamp)}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo rolável */}
        <div className="relative min-h-0">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background to-transparent transition-opacity",
              scroll.atTop ? "opacity-0" : "opacity-100",
            )}
          />
          <div
            ref={scrollRef}
            onScroll={updateScroll}
            className="h-full space-y-4 overflow-y-auto p-5"
          >
            {/* Alvo */}
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Alvo
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{entry.target.label}</span>
                {entry.target.profile ? (
                  <Chip>{userProfileLabel(entry.target.profile)}</Chip>
                ) : null}
              </div>
            </div>

            {/* Alterações (foco visual) */}
            {hasChanges ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Alterações
                </p>
                <div className="overflow-hidden rounded-lg border text-sm">
                  {entry.changes!.map((c, i) => (
                    <div
                      key={c.field}
                      className={cn(
                        "flex items-baseline justify-between gap-3 p-2.5",
                        i > 0 && "border-t",
                      )}
                    >
                      <span className="font-medium">{c.label}</span>
                      <span className="text-right">
                        <span className="text-muted-foreground line-through">
                          {c.before}
                        </span>
                        <span className="mx-1.5 text-muted-foreground" aria-hidden>
                          →
                        </span>
                        <span className="font-semibold">{c.after}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem alterações de campo registradas.
              </p>
            )}

            {/* Detalhes técnicos (recolhido por padrão) */}
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowTech((v) => !v)}
                aria-expanded={showTech}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Fingerprint className="size-4" />
                Detalhes técnicos
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    showTech && "rotate-180",
                  )}
                />
              </button>

              {showTech ? (
                <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">ID do registro</dt>
                  <dd className="text-right font-mono break-all select-all">
                    {entry.id}
                  </dd>
                  <dt className="text-muted-foreground">Data/hora (ISO)</dt>
                  <dd className="text-right font-mono break-all select-all">
                    {entry.timestamp}
                  </dd>
                  <dt className="text-muted-foreground">ID do autor</dt>
                  <dd className="text-right font-mono break-all select-all">
                    {entry.actor.userId}
                  </dd>
                  {entry.target.id ? (
                    <>
                      <dt className="text-muted-foreground">ID do alvo</dt>
                      <dd className="text-right font-mono break-all select-all">
                        {entry.target.id}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Organização</dt>
                  <dd className="text-right font-mono break-all select-all">
                    {entry.organizationId}
                  </dd>
                  <dt className="text-muted-foreground">Unidade</dt>
                  <dd className="text-right font-mono break-all select-all">
                    {entry.unitId}
                  </dd>
                </dl>
              ) : null}
            </div>

            {/* Nota de imutabilidade */}
            <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <Lock className="size-3 shrink-0" />
              Registro imutável — não pode ser editado nem removido.
            </p>
          </div>

          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-8 items-end justify-center bg-gradient-to-t from-background to-transparent transition-opacity",
              scroll.atBottom ? "opacity-0" : "opacity-100",
            )}
          >
            <ChevronDown className="size-4 animate-bounce text-muted-foreground" />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={copyRecord}>
            <Copy className="size-4" />
            Copiar registro (JSON)
          </Button>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
