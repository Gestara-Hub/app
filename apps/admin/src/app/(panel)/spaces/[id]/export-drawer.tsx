"use client";

import { Download } from "lucide-react";
import { DrawerBody, DrawerFooter, FormDrawer, useDrawerClose } from "@/components/shared/form-drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Exportar os dados do espaço: a gaveta pede o motivo e baixa o arquivo (envio direto à rota, que registra). */
export function ExportDrawer({ spaceId }: { spaceId: string }) {
  return (
    <FormDrawer
      title="Exportar os dados do espaço"
      description="Arquivo com o cadastro e a operação do espaço (alunos, turmas, cobranças...), sem senhas nem chaves. Para pedidos de acesso ou portabilidade do titular. Fica registrado."
      trigger={
        <Button variant="outline">
          <Download /> Exportar
        </Button>
      }
    >
      <ExportForm spaceId={spaceId} />
    </FormDrawer>
  );
}

function ExportForm({ spaceId }: { spaceId: string }) {
  const close = useDrawerClose();
  return (
    <form action={`/spaces/${spaceId}/export`} method="post" onSubmit={() => window.setTimeout(close, 400)} className="flex min-h-0 flex-1 flex-col">
      <DrawerBody>
        <div className="space-y-1.5">
          <Label htmlFor="export-reason" className="text-sm">
            Motivo (fica registrado)
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          </Label>
          <Textarea id="export-reason" name="reason" rows={3} required minLength={5} maxLength={300} className="text-base md:text-sm" />
        </div>
      </DrawerBody>
      <DrawerFooter submitLabel="Baixar arquivo" pending={false} />
    </form>
  );
}
