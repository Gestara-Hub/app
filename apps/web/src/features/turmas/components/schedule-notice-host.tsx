"use client";

import { useEffect, useRef, useState } from "react";
import { plural } from "@gestarahub/core/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCan } from "@/features/auth";
import { ReminderSequenceDialog, useWhatsAppSend, type ReminderGroup } from "@/features/communication";
import { clientsService } from "@/services/clients";
import { turmasService } from "@/services/classes";
import { onScheduleNoticeRequest, type ScheduleNoticeRequest } from "../schedule-notice";

/**
 * Depois de mudar o horario de uma turma: "Avisar os N alunos?" e o envio em
 * sequencia com o modelo "Mudança de horário" e o horario novo no fim (doc
 * product/25). Matriculas ativas; telefone do cadastro do aluno.
 *
 * Montado em toda tela, mas so escuta (11/11/2026): os modelos e a conexao do
 * WhatsApp so carregam quando um aviso e pedido, nao a cada pagina.
 */
export function ScheduleNoticeHost() {
  const can = useCan();
  const canMessage = can("communication:view");
  const [request, setRequest] = useState<{ id: number; value: ScheduleNoticeRequest } | null>(null);

  useEffect(
    () =>
      onScheduleNoticeRequest((value) => {
        if (canMessage) setRequest((current) => ({ id: (current?.id ?? 0) + 1, value }));
      }),
    [canMessage],
  );

  if (!request) return null;
  return <ScheduleNoticeFlow key={request.id} request={request.value} onDone={() => setRequest(null)} />;
}

function ScheduleNoticeFlow({ request, onDone }: { request: ScheduleNoticeRequest; onDone: () => void }) {
  const whatsapp = useWhatsAppSend();
  const [pending, setPending] = useState<{ request: ScheduleNoticeRequest; group: ReminderGroup } | null>(null);
  const [sequence, setSequence] = useState<ReminderGroup | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Espera os modelos chegarem para montar o texto de cada aluno.
    if (!whatsapp.ready || started.current) return;
    started.current = true;
    void (async () => {
      const [enrollments, clients] = await Promise.all([
        turmasService.listEnrollments(request.classGroupId),
        clientsService.list({ status: "active" }),
      ]);
      const phoneOf = new Map(clients.map((c) => [c.id, c.phone]));
      const items = enrollments
        .filter((e) => e.status === "active" && e.studentStatus === "active")
        .map((e) => {
          const base = whatsapp.compose("schedule_change", {}, e.studentName).trim();
          return {
            key: `schedule_change:${request.classGroupId}:${e.studentId}`,
            studentId: e.studentId,
            studentName: e.studentName,
            ...(phoneOf.get(e.studentId) ? { phone: phoneOf.get(e.studentId) } : {}),
            trigger: "schedule_change" as const,
            values: {},
            content: `${base} ${request.slotsText}`.trim(),
            detail: request.className,
          };
        });
      if (items.length === 0) {
        onDone();
        return;
      }
      setPending({
        request,
        group: {
          key: "schedule_change",
          category: "notice",
          level: "info",
          title: `Novo horário de ${request.className}`,
          detail: request.slotsText,
          items,
          hidden: 0,
          pending: items.length,
        },
      });
    })();
  }, [whatsapp, request, onDone]);

  return (
    <>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPending(null);
          if (!sequence) onDone();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avisar os alunos?</DialogTitle>
            <DialogDescription>
              {pending
                ? `${pending.request.className} mudou de horário. Avisar ${plural(pending.group.items.length, "aluno", "alunos")} pelo WhatsApp?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPending(null);
                onDone();
              }}
            >
              Agora não
            </Button>
            <Button
              type="button"
              disabled={!whatsapp.ready}
              onClick={() => {
                setSequence(pending?.group ?? null);
                setPending(null);
              }}
            >
              Avisar alunos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReminderSequenceDialog
        group={sequence}
        open={sequence !== null}
        onOpenChange={(open) => {
          if (open) return;
          setSequence(null);
          onDone();
        }}
      />
    </>
  );
}
