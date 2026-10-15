"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type { Client, StudentPackageView } from "@gestarahub/contracts";
import { useCan, useModel } from "@/features/auth";
import { NewExtraChargeDialog, SellPackageDialog, useCancelStudentPackage } from "@/features/turmas";
import { StudentGradesDialog } from "@/features/grades";
import { useUpdateClient } from "../hooks/use-clients";
import { ClientsList } from "./clients-list";
import { ClientFormDialog } from "./client-form-dialog";
import { InactivateClientDialog } from "./inactivate-client-dialog";
import { StudentGraduationDialog } from "./student-graduation-dialog";
import { StudentRecordsDialog } from "./student-records-dialog";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";

export function ClientsView() {
  const isClasses = useModel() === "classes";
  const [formState, setFormState] = useState<{
    open: boolean;
    client?: Client;
  }>({ open: false });
  const [inactivating, setInactivating] = useState<Client | null>(null);
  // Dois modais: Graduação (raro) e Registros de aula (toda aula).
  const [graduationClient, setGraduationClient] = useState<Client | null>(null);
  const [recordsClient, setRecordsClient] = useState<Client | null>(null);
  // Boletim "Notas" (modalidades com avaliacoes).
  const [gradesClient, setGradesClient] = useState<Client | null>(null);
  // Cobranca avulsa com o aluno fixo.
  const [chargeClient, setChargeClient] = useState<Client | null>(null);
  // Venda de pacote de aulas com o aluno fixo.
  const [packageClient, setPackageClient] = useState<Client | null>(null);
  const cancelPackageMut = useCancelStudentPackage();

  const updateMut = useUpdateClient();
  const can = useCan();
  const canManage = can("clients:manage");
  const canCharge = isClasses && can("billing:manage");

  const openCreate = () => setFormState({ open: true });
  const openEdit = (client: Client) => setFormState({ open: true, client });

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

  // Desfaz a venda de um pacote sem aula usada (mexe no dinheiro: confirma).
  async function cancelPackage(pkg: StudentPackageView) {
    if (
      !(await confirmAction({
        title: "Cancelar pacote?",
        description: `O pacote ${pkg.name} de ${pkg.studentName} é cancelado. As cobranças em aberto dele também; as pagas ficam.`,
        confirmLabel: "Cancelar pacote",
        cancelLabel: "Voltar",
      }))
    ) {
      return;
    }
    try {
      await cancelPackageMut.mutateAsync(pkg.id);
      toast.success("Pacote cancelado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível cancelar o pacote."));
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
        onOpenGraduation={isClasses ? setGraduationClient : undefined}
        onOpenRecords={isClasses ? setRecordsClient : undefined}
        onOpenGrades={isClasses ? setGradesClient : undefined}
        onNewCharge={canCharge ? setChargeClient : undefined}
        onSellPackage={canCharge ? setPackageClient : undefined}
        onCancelPackage={canCharge ? (pkg) => void cancelPackage(pkg) : undefined}
        onInactivate={setInactivating}
        onReactivate={reactivate}
      />

      <ClientFormDialog
        open={formState.open}
        onOpenChange={(open) => {
          if (!open) setFormState((state) => ({ ...state, open: false }));
        }}
        client={formState.client}
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
          <SellPackageDialog
            open={Boolean(packageClient)}
            onOpenChange={(open) => {
              if (!open) setPackageClient(null);
            }}
            student={packageClient}
          />
          <StudentGradesDialog
            client={gradesClient}
            open={Boolean(gradesClient)}
            onOpenChange={(open) => {
              if (!open) setGradesClient(null);
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

      <InactivateClientDialog
        client={inactivating}
        onOpenChange={(open) => {
          if (!open) setInactivating(null);
        }}
      />
    </>
  );
}
