"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Client } from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { NewExtraChargeDialog } from "@/features/turmas";
import { StudentGradesDialog } from "@/features/grades";
import { StudentMeasurementsDialog } from "@/features/measurements";
import { SendMessageDialog } from "@/features/communication";
import { useUpdateClient } from "../hooks/use-clients";
import { ClientsList } from "./clients-list";
import { ClientFormDrawer } from "./client-form-drawer";
import { InactivateClientDialog } from "./inactivate-client-dialog";
import { StudentGraduationDialog } from "./student-graduation-dialog";
import { StudentRecordsDialog } from "./student-records-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ClientsView() {
  const isClasses = useModel() === "classes";
  const [inactivating, setInactivating] = useState<Client | null>(null);
  const [drawerState, setDrawerState] = useState<{ open: boolean; client?: Client }>({ open: false });
  // Dois modais: Graduação (raro) e Registros de aula (toda aula).
  const [graduationClient, setGraduationClient] = useState<Client | null>(null);
  const [recordsClient, setRecordsClient] = useState<Client | null>(null);
  // Boletim "Notas" (modalidades com avaliacoes).
  const [gradesClient, setGradesClient] = useState<Client | null>(null);
  // Testes e medidas (modalidades com medidas).
  const [measurementsClient, setMeasurementsClient] = useState<Client | null>(null);
  // Cobranca avulsa com o aluno fixo.
  const [chargeClient, setChargeClient] = useState<Client | null>(null);
  // Mensagem no WhatsApp com o aluno fixo (o aluno fica ate o fim da animacao).
  const [messageState, setMessageState] = useState<{ open: boolean; client?: Client }>({ open: false });

  const updateMut = useUpdateClient();
  const can = useCan();
  const canManage = can("clients:manage");
  const canCharge = isClasses && can("billing:manage");
  const canMessage = can("communication:view");

  const openCreate = () => setDrawerState({ open: true });
  const openEdit = (client: Client) => setDrawerState({ open: true, client });

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  async function reactivate(client: Client) {
    if (
      !(await confirmAction({
        title: `Reativar ${isClasses ? "aluno" : "cliente"}?`,
        description: `“${client.name}” volta a aparecer em ${isClasses ? "novas matrículas" : "novos agendamentos"}.`,
        confirmLabel: "Reativar",
      }))
    ) {
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: client.id,
        payload: { status: "active" },
      });
      toast.success(isClasses ? "Aluno reativado." : "Cliente reativado.");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          isClasses
            ? "Não foi possível reativar o aluno."
            : "Não foi possível reativar o cliente.",
        ),
      );
    }
  }

  return (
    <>
      {confirmDialog}
      <PageHeader
        title={isClasses ? "Alunos" : "Clientes"}
        description={
          isClasses
            ? "Cadastro, evolução técnica e histórico de alunos."
            : "Cadastro e histórico de clientes."
        }
      >
        {canManage ? (
          <Button onClick={openCreate} data-onboarding-cta="clients">
            <Plus className="size-4" />
            {isClasses ? "Novo aluno" : "Novo cliente"}
          </Button>
        ) : null}
      </PageHeader>

      <ClientsList
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEdit}
        onSendMessage={canMessage ? (client) => setMessageState({ open: true, client }) : undefined}
        onOpenGraduation={isClasses && can("progression:manage") ? setGraduationClient : undefined}
        onOpenRecords={isClasses && can("progression:manage") ? setRecordsClient : undefined}
        onOpenGrades={isClasses ? setGradesClient : undefined}
        onOpenMeasurements={isClasses ? setMeasurementsClient : undefined}
        onNewCharge={canCharge ? setChargeClient : undefined}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      {isClasses ? (
        <>
          <StudentGraduationDialog
            client={graduationClient}
            open={Boolean(graduationClient)}
            onOpenChange={(open) => {
              if (!open) setGraduationClient(null);
            }}
          />
          <NewExtraChargeDialog
            open={Boolean(chargeClient)}
            onOpenChange={(open) => {
              if (!open) setChargeClient(null);
            }}
            student={chargeClient}
          />
          <StudentGradesDialog
            client={gradesClient}
            open={Boolean(gradesClient)}
            onOpenChange={(open) => {
              if (!open) setGradesClient(null);
            }}
          />
          <StudentMeasurementsDialog
            client={measurementsClient}
            open={Boolean(measurementsClient)}
            onOpenChange={(open) => {
              if (!open) setMeasurementsClient(null);
            }}
          />
          <StudentRecordsDialog
            client={recordsClient}
            open={Boolean(recordsClient)}
            onOpenChange={(open) => {
              if (!open) setRecordsClient(null);
            }}
          />
        </>
      ) : null}

      <SendMessageDialog
        open={messageState.open}
        onOpenChange={(open) => {
          if (!open) setMessageState((state) => ({ ...state, open: false }));
        }}
        recipient={
          messageState.client
            ? { id: messageState.client.id, name: messageState.client.name, phone: messageState.client.phone }
            : undefined
        }
      />

      <InactivateClientDialog
        client={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />

      <ClientFormDrawer
        open={drawerState.open}
        onOpenChange={(open) => !open && setDrawerState({ open: false })}
        client={drawerState.client}
      />
    </>
  );
}
