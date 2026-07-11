"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  auditActionLabel,
  auditEntityTypeLabel,
  userProfileLabel,
} from "@/lib/labels";
import { formatDateTime } from "@gestarahub/core/format";
import type { AuditLogEntry } from "@gestarahub/contracts";

// Linha rotulo/valor. `mono` para identificadores/timestamps (rastreabilidade).
function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={
          mono
            ? "select-all text-right font-mono text-xs break-all"
            : "text-right font-medium"
        }
      >
        {children}
      </span>
    </div>
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
  // Afordância de scroll: mostra fade+chevron quando há conteúdo além da dobra.
  const [scroll, setScroll] = useState({ atTop: true, atBottom: true });

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScroll({
      atTop: el.scrollTop <= 1,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
    });
  }, []);

  // Recalcula ao abrir/trocar de registro (conteúdo muda de altura).
  useEffect(() => {
    if (!entry || !open) return;
    const id = requestAnimationFrame(updateScroll);
    return () => cancelAnimationFrame(id);
  }, [entry, open, updateScroll]);

  if (!entry) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Registro de auditoria
            {entry.security ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                <ShieldAlert className="size-3" />
                Sensível
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock className="size-3" />
            Registro imutável — não pode ser editado nem removido.
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0">
          {/* Fade superior: sinaliza conteúdo acima da dobra. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background to-transparent transition-opacity ${
              scroll.atTop ? "opacity-0" : "opacity-100"
            }`}
          />
          <div
            ref={scrollRef}
            onScroll={updateScroll}
            className="h-full space-y-4 overflow-y-auto py-1 pr-1"
          >
          {/* Hero: a frase do evento + quando. */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium leading-snug">{entry.summary}</p>
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {formatDateTime(entry.timestamp)}
            </p>
          </div>

          {/* Quem */}
          <div className="divide-y">
            <Row label="Autor">{entry.actor.name}</Row>
            <Row label="Perfil">{userProfileLabel(entry.actor.profile)}</Row>
            <Row label="ID do autor" mono>
              {entry.actor.userId}
            </Row>
          </div>

          {/* O quê */}
          <div className="divide-y border-t pt-1">
            <Row label="Ação">{auditActionLabel(entry.action)}</Row>
            <Row label="Tipo">{auditEntityTypeLabel(entry.target.type)}</Row>
            <Row label="Alvo">{entry.target.label}</Row>
            {entry.target.profile ? (
              <Row label="Perfil do alvo">
                {userProfileLabel(entry.target.profile)}
              </Row>
            ) : null}
            {entry.target.id ? (
              <Row label="ID do alvo" mono>
                {entry.target.id}
              </Row>
            ) : null}
          </div>

          {/* Alterações (antes -> depois) */}
          {entry.changes && entry.changes.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Alterações
              </p>
              <div className="overflow-hidden rounded-md border">
                {entry.changes.map((c, i) => (
                  <div
                    key={c.field}
                    className={
                      i > 0
                        ? "flex items-start justify-between gap-3 border-t p-2.5 text-sm"
                        : "flex items-start justify-between gap-3 p-2.5 text-sm"
                    }
                  >
                    <span className="shrink-0 font-medium">{c.label}</span>
                    <span className="text-right">
                      <span className="text-muted-foreground line-through">
                        {c.before}
                      </span>
                      <span className="mx-1 text-muted-foreground" aria-hidden>
                        →
                      </span>
                      <span className="font-medium">{c.after}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Rastreabilidade do registro */}
          <div className="divide-y border-t pt-1">
            <Row label="ID do registro" mono>
              {entry.id}
            </Row>
            <Row label="Data/hora (ISO)" mono>
              {entry.timestamp}
            </Row>
            <Row label="Organização" mono>
              {entry.organizationId}
            </Row>
            <Row label="Unidade" mono>
              {entry.unitId}
            </Row>
          </div>
          </div>
          {/* Fade inferior + chevron: sinaliza conteúdo abaixo da dobra. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-8 items-end justify-center bg-gradient-to-t from-background to-transparent transition-opacity ${
              scroll.atBottom ? "opacity-0" : "opacity-100"
            }`}
          >
            <ChevronDown className="size-4 animate-bounce text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={copyRecord}>
            <Copy className="size-4" />
            Copiar registro (JSON)
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
