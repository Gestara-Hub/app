"use client";

import { useState } from "react";
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import type { Id, PersonDocumentOwnerKind, PersonDocumentView } from "@gestarahub/contracts";
import { documentExpiryText } from "@gestarahub/core/person-documents";
import { formatDate } from "@gestarahub/core/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListItemActionsMenu, ListItemContextMenu, type ListItemAction } from "@/components/shared/list-item-actions-menu";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { formatBytes } from "@/lib/files";
import { logError } from "@/lib/log";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { personDocumentUrl } from "@/services/personDocuments";
import { usePersonDocuments, useRemovePersonDocument } from "../hooks/use-person-documents";
import { PersonDocumentFormDrawer } from "./person-document-form-drawer";
import { DOCUMENT_KIND_ICONS } from "../document-kind-icons";

/** Resumo de uma linha para a sanfona da ficha: "2 documentos · Atestado vence em 12 dias". */
export function documentsSummary(docs: PersonDocumentView[] | undefined): string {
  if (!docs) return "Carregando…";
  if (docs.length === 0) return "Nenhum documento";
  const count = docs.length === 1 ? "1 documento" : `${docs.length} documentos`;
  const alert = docs.find((d) => d.expiry === "expired" || d.expiry === "expiring");
  if (!alert) return count;
  return `${count} · ${alert.label} ${alert.expiry === "expired" ? "vencido" : "vence em breve"}`;
}

/** Abre o arquivo numa aba nova (a janela abre no clique, antes do endereco: sem bloqueio de pop-up). */
async function openDocument(doc: PersonDocumentView) {
  const tab = window.open("", "_blank");
  try {
    const url = await personDocumentUrl(doc);
    if (url && tab) tab.location.href = url;
    else {
      tab?.close();
      toast.error("Arquivo não encontrado.");
    }
  } catch (error) {
    tab?.close();
    logError("[personDocuments] Erro ao abrir o documento:", error);
    toast.error("Não foi possível abrir o documento.");
  }
}

function DocumentKindIcon({ kind }: { kind: PersonDocumentView["kind"] }) {
  const Icon = DOCUMENT_KIND_ICONS[kind] ?? FileText;
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

/** Linha de carregamento do documento que acabou de entrar (ate a lista nova chegar). */
function DocumentRowSkeleton() {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5" aria-label="Carregando o documento novo">
      <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
      <span className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-48" />
      </span>
    </li>
  );
}

function ExpiryBadge({ doc }: { doc: PersonDocumentView }) {
  if (doc.expiry === "expired") {
    return (
      <Badge variant="destructive" className="shrink-0">
        Vencido
      </Badge>
    );
  }
  if (doc.expiry === "expiring") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
      >
        Vence em breve
      </Badge>
    );
  }
  return null;
}

function validityLine(doc: PersonDocumentView): string {
  if (!doc.expiresOn) return "Sem validade";
  const text = documentExpiryText(doc.daysToExpire);
  return doc.expiry === "valid" ? `Válido até ${formatDate(doc.expiresOn)}` : `${text} · ${formatDate(doc.expiresOn)}`;
}

/**
 * Documentos de uma ficha (doc product/28): lista com validade, abrir, editar e
 * tirar. Quem nao gerencia so ve e abre.
 */
export function PersonDocumentsPanel({
  ownerKind,
  ownerId,
  ownerName,
  canManage,
}: {
  ownerKind: PersonDocumentOwnerKind;
  ownerId: Id;
  ownerName: string;
  canManage: boolean;
}) {
  const { data: docs, isPending, isError, dataUpdatedAt } = usePersonDocuments(ownerKind, ownerId);
  // Depois de anexar, editar ou excluir, a lista busca de novo; ate os dados
  // novos chegarem (rede lenta), mostra o carregamento em vez da versao antiga.
  const [awaiting, setAwaiting] = useState<{ mode: "create" | "update" | "remove"; since: number } | null>(null);
  // `since` e a versao da lista no momento de salvar: some quando chega outra.
  const refreshing = awaiting !== null && dataUpdatedAt <= awaiting.since;
  const startAwaiting = (mode: "create" | "update" | "remove") => setAwaiting({ mode, since: dataUpdatedAt });
  const removeMut = useRemovePersonDocument();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const [form, setForm] = useState<{ open: boolean; document?: PersonDocumentView }>({ open: false });

  const remove = async (doc: PersonDocumentView) => {
    const ok = await confirm({
      title: "Excluir documento?",
      description: `${doc.label} sai da ficha de ${ownerName} e o arquivo é apagado.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    removeMut.mutate(doc.id, {
      onSuccess: () => {
        startAwaiting("remove");
        toast.success("Documento excluído.");
      },
      onError: () => toast.error("Não foi possível excluir o documento."),
    });
  };

  const actionsOf = (doc: PersonDocumentView): ListItemAction[] => [
    { key: "open", label: "Abrir", icon: <ExternalLink className="size-4" />, onSelect: () => void openDocument(doc) },
    ...(canManage
      ? [
          {
            key: "edit",
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onSelect: () => setForm({ open: true, document: doc }),
          },
          {
            key: "remove",
            label: "Excluir",
            icon: <Trash2 className="size-4" />,
            destructive: true,
            onSelect: () => void remove(doc),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      {confirmDialog}
      {/* No topo: a lista cresce para baixo sem empurrar o botao. */}
      {canManage ? (
        <Button type="button" variant="outline" onClick={() => setForm({ open: true })}>
          <Plus className="size-4" />
          Adicionar documento
        </Button>
      ) : null}
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os documentos.</p>
      ) : (docs && docs.length > 0) || (refreshing && awaiting?.mode === "create") ? (
        <ul
          className={cn("divide-y rounded-lg border transition-opacity", refreshing && awaiting?.mode !== "create" && "opacity-60")}
          aria-busy={refreshing || undefined}
        >
          {refreshing && awaiting?.mode === "create" ? <DocumentRowSkeleton /> : null}
          {(docs ?? []).map((doc) => (
            <li key={doc.id}>
              <ListItemContextMenu actions={actionsOf(doc)}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void openDocument(doc)}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <DocumentKindIcon kind={doc.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words text-sm font-medium text-foreground">{doc.label}</span>
                        <ExpiryBadge doc={doc} />
                      </span>
                      <span
                        className={cn(
                          "block text-xs",
                          doc.expiry === "expired" ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {validityLine(doc)}
                      </span>
                      <span className="block min-w-0 break-words text-xs text-muted-foreground">
                        {doc.file.name} · {formatBytes(doc.file.sizeBytes)}
                      </span>
                      {doc.notes ? (
                        <span className="mt-1 block min-w-0 break-words text-xs text-muted-foreground">{doc.notes}</span>
                      ) : null}
                    </span>
                  </button>
                  <ListItemActionsMenu
                    actions={actionsOf(doc)}
                    title="Ações do documento"
                    ariaLabel={`Ações de ${doc.label}`}
                    variant="ghost"
                  />
                </div>
              </ListItemContextMenu>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {!canManage
            ? "Nenhum documento na ficha."
            : ownerKind === "client"
              ? "Guarde aqui atestado, termo assinado e autorizações."
              : "Guarde aqui registro profissional, certificados e contrato."}
        </p>
      )}


      <PersonDocumentFormDrawer
        open={form.open}
        onOpenChange={(open) => setForm((prev) => ({ ...prev, open }))}
        ownerKind={ownerKind}
        ownerId={ownerId}
        ownerName={ownerName}
        document={form.document}
        onSaved={startAwaiting}
      />
    </div>
  );
}
