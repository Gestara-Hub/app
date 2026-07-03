"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ListCard } from "@/components/shared/list-card";
import { ListItemCard } from "@/components/shared/list-item-card";
import {
  ListItemActionsMenu,
  ListItemContextMenu,
  type ListItemAction,
} from "@/components/shared/list-item-actions-menu";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@/lib/api-error";
import { recordStatusLabel } from "@/lib/labels";
import type { RecordStatus } from "@gestarahub/contracts";

/** Forma minima que uma entidade gerenciavel precisa ter. */
export interface ManagedEntity {
  id: string;
  name: string;
  status: RecordStatus;
}

interface MutationLike<TArgs> {
  mutateAsync: (args: TArgs) => Promise<unknown>;
  isPending: boolean;
}
interface QueryLike<T> {
  data?: T[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

export interface EntityManagerLabels {
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  nameRequired: string;
  createButton: string;
  empty: string;
  actionsTitle: string;
  editAriaLabel: string;
  loadError: string;
  createdToast: string;
  updatedToast: string;
  inactivatedToast: string;
  reactivatedToast: string;
  saveError: string;
  inactivateError: string;
  reactivateError: string;
}

type UpdateArgs = { id: string; payload: { name?: string; status?: RecordStatus } };

export interface EntityManagerDialogProps<T extends ManagedEntity> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  labels: EntityManagerLabels;
  useList: () => QueryLike<T>;
  useCreate: () => MutationLike<{ organizationId: string; name: string }>;
  useUpdate: () => MutationLike<UpdateArgs>;
  useInactivate: () => MutationLike<string>;
}

function statusPillClass(isActive: boolean): string {
  return isActive
    ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "border border-border bg-muted/40 text-muted-foreground";
}

function StatusPill({ status }: { status: RecordStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        statusPillClass(status === "active"),
      )}
    >
      {recordStatusLabel(status)}
    </span>
  );
}

// --- Formulario de criacao -------------------------------------------------

function CreateForm({
  organizationId,
  labels,
  createMut,
}: {
  organizationId: string;
  labels: EntityManagerLabels;
  createMut: MutationLike<{ organizationId: string; name: string }>;
}) {
  type Values = { name: string };
  const schema = z.object({ name: z.string().trim().min(1, labels.nameRequired) });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMut.mutateAsync({ organizationId, name: values.name });
      toast.success(labels.createdToast);
      form.reset({ name: "" });
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<Values>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, labels.saveError));
      }
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <InputText<Values>
          name="name"
          label={labels.nameLabel}
          placeholder={labels.namePlaceholder}
          required
          disabled={createMut.isPending}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? "Salvando..." : labels.createButton}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

// --- Linha em edicao (input inline) ----------------------------------------

function RowEditor<T extends ManagedEntity>({
  entity,
  labels,
  updateMut,
  onCancel,
  onSaved,
}: {
  entity: T;
  labels: EntityManagerLabels;
  updateMut: MutationLike<UpdateArgs>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entity.name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = updateMut.isPending;

  // Foca via rAF (apos o restore de foco do menu); senao o context menu rouba.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(labels.nameRequired);
      return;
    }
    if (trimmed === entity.name) {
      onCancel();
      return;
    }
    try {
      await updateMut.mutateAsync({ id: entity.id, payload: { name: trimmed } });
      toast.success(labels.updatedToast);
      onSaved();
    } catch (err) {
      const nameError = getFieldErrors(err)?.find((f) => f.field === "name");
      if (nameError) setError(nameError.message);
      else toast.error(getErrorMessage(err, labels.saveError));
    }
  }

  return (
    <ListItemCard isActive disableHover>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          aria-label={labels.editAriaLabel}
          aria-invalid={Boolean(error)}
          disabled={pending}
          className="h-8 flex-1"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <Button
          type="button"
          size="icon-sm"
          title="Salvar"
          aria-label="Salvar"
          disabled={pending}
          onClick={() => void save()}
        >
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Cancelar"
          aria-label="Cancelar"
          disabled={pending}
          onClick={onCancel}
        >
          <X className="size-4" />
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </ListItemCard>
  );
}

// --- Linha em exibicao -----------------------------------------------------

function Row<T extends ManagedEntity>({
  entity,
  labels,
  onEdit,
  onInactivate,
  onReactivate,
}: {
  entity: T;
  labels: EntityManagerLabels;
  onEdit: (e: T) => void;
  onInactivate: (e: T) => void;
  onReactivate: (e: T) => void;
}) {
  const isActive = entity.status === "active";

  const actions: ListItemAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: <Pencil className="size-4" />,
      onSelect: () => onEdit(entity),
    },
    isActive
      ? {
          key: "inactivate",
          label: "Inativar",
          icon: <PowerOff className="size-4" />,
          onSelect: () => onInactivate(entity),
          destructive: true,
        }
      : {
          key: "reactivate",
          label: "Reativar",
          icon: <Power className="size-4" />,
          onSelect: () => onReactivate(entity),
        },
  ];

  const content = (
    <ListItemCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-medium">{entity.name}</p>
          <StatusPill status={entity.status} />
        </div>
        <ListItemActionsMenu actions={actions} title={labels.actionsTitle} />
      </div>
    </ListItemCard>
  );

  return (
    <ListItemContextMenu
      actions={actions}
      // Editar transforma a linha em input; impedir o restore de foco do menu
      // evita que ele roube o foco do input recem-montado.
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {content}
    </ListItemContextMenu>
  );
}

function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  ));
}

function EntityList<T extends ManagedEntity>({
  labels,
  query,
  updateMut,
  inactivateMut,
}: {
  labels: EntityManagerLabels;
  query: QueryLike<T>;
  updateMut: MutationLike<UpdateArgs>;
  inactivateMut: MutationLike<string>;
}) {
  const { data, isPending, isError, refetch } = query;
  const entities = data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);

  async function inactivate(entity: T) {
    try {
      await inactivateMut.mutateAsync(entity.id);
      toast.success(labels.inactivatedToast);
    } catch (error) {
      toast.error(getErrorMessage(error, labels.inactivateError));
    }
  }

  async function reactivate(entity: T) {
    try {
      await updateMut.mutateAsync({ id: entity.id, payload: { status: "active" } });
      toast.success(labels.reactivatedToast);
    } catch (error) {
      toast.error(getErrorMessage(error, labels.reactivateError));
    }
  }

  let items: ReactNode[] = [];
  let emptyState: ReactNode = null;

  if (isPending) {
    items = [<SkeletonRows key="skeleton" />];
  } else if (isError) {
    emptyState = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{labels.loadError}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    );
  } else {
    items = entities.map((entity) =>
      entity.id === editingId ? (
        <RowEditor
          key={entity.id}
          entity={entity}
          labels={labels}
          updateMut={updateMut}
          onCancel={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      ) : (
        <Row
          key={entity.id}
          entity={entity}
          labels={labels}
          onEdit={(e) => setEditingId(e.id)}
          onInactivate={inactivate}
          onReactivate={reactivate}
        />
      ),
    );
    emptyState = (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {labels.empty}
      </p>
    );
  }

  return <ListCard items={items} emptyState={emptyState} />;
}

/**
 * Modal de gestao de um cadastro simples (nome + status): formulario de criacao
 * no topo e a listagem padrao abaixo, com edicao inline na linha e inativar/
 * reativar. Generico — recebe labels e os hooks de dados da feature.
 */
export function EntityManagerDialog<T extends ManagedEntity>({
  open,
  onOpenChange,
  organizationId,
  labels,
  useList,
  useCreate,
  useUpdate,
  useInactivate,
}: EntityManagerDialogProps<T>) {
  const listQuery = useList();
  const createMut = useCreate();
  const updateMut = useUpdate();
  const inactivateMut = useInactivate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <CreateForm
          organizationId={organizationId}
          labels={labels}
          createMut={createMut}
        />

        <div className="min-h-0 flex-1 overflow-y-auto border-t pt-4">
          <EntityList
            labels={labels}
            query={listQuery}
            updateMut={updateMut}
            inactivateMut={inactivateMut}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
