"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ListItemCard } from "@/components/shared/list-item-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@gestarahub/core/format";
import type { Plano } from "@gestarahub/contracts";
import { useCan } from "@/features/auth";
import { usePlans } from "../hooks/use-billing";
import { PlanForm } from "./plan-form";

export function PlansView() {
  const { data: plans, isLoading } = usePlans({ status: "active" });
  const can = useCan();
  const canManage = can("billing:manage");
  const [editing, setEditing] = useState<Plano | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Plano) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Planos"
        description="Planos de mensalidade usados pelas turmas."
      >
        {canManage ? (
          <Button onClick={openNew}>
            <Plus className="size-4" />
            Novo plano
          </Button>
        ) : null}
      </PageHeader>

      <div className="space-y-2">
        {isLoading ? (
          [0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))
        ) : (plans ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado.
          </p>
        ) : (
          (plans ?? []).map((p) => (
            <ListItemCard key={p.id} disableHover>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(p.priceCents)} / mês
                  </p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Editar plano"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
              </div>
            </ListItemCard>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>Nome e valor mensal do plano.</DialogDescription>
          </DialogHeader>
          <PlanForm
            key={editing?.id ?? "novo"}
            plan={editing ?? undefined}
            formId="plan-form"
            onSuccess={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
