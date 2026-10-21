import type { Charge, ClassReservation, Id, ReservationKind, ReservationView } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { apiError, newId, notFoundError, nowIso, simulateWrite, validationError } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { acceptsPackages, hasUsablePackage } from "../packagesService";
import { syncAttendanceUsage } from "./attendancePackageUsage";
import {
  clone,
  todayISO,
  studentName,
  activeEnrollments,
  parseSessionId,
  resolveSession,
} from "./classShared";

export const reservationsService = {
  // --- Reservations (Drop-in) ---------------------------------------------
  reserveSession(input: {
    classGroupId: Id;
    sessionId: Id;
    studentId: Id;
    kind?: ReservationKind;
    amountCents?: number;
  }): Promise<ReservationView> {
    return simulateWrite(async () => {
      const { g } = resolveSession(input.sessionId);
      if (g.id !== input.classGroupId) throw notFoundError("Aula não encontrada.");
      const already = store.reservations.find(
        (r) =>
          r.sessionId === input.sessionId &&
          r.studentId === input.studentId &&
          r.status === "reserved",
      );
      if (already) {
        throw validationError([
          { field: "studentId", message: "Aluno já reservou esta aula." },
        ]);
      }
      const isEnrolled = activeEnrollments(g.id).some(
        (e) => e.studentId === input.studentId,
      );
      if (isEnrolled) {
        throw validationError([
          { field: "studentId", message: "Aluno já está matriculado nesta turma." },
        ]);
      }

      const kind: ReservationKind = input.kind || "dropin";
      // Experimental segue liberada; avulsa so se a turma aceita (ausente = true).
      if (kind === "dropin" && g.allowDropin === false) {
        throw apiError("VALIDATION", "Esta turma não aceita aula avulsa.", {
          httpStatus: 422,
        });
      }
      const p = parseSessionId(input.sessionId);
      const sessionDate = p?.date ?? todayISO();
      // Pacote: entra em qualquer aula das modalidades dele, sem cobranca.
      if (kind === "package" && !acceptsPackages(g)) {
        throw apiError("VALIDATION", "Esta turma não aceita pacote.", { httpStatus: 422 });
      }
      if (kind === "package" && !hasUsablePackage(input.studentId, g, sessionDate)) {
        throw apiError(
          "VALIDATION",
          `${studentName(input.studentId)} não tem pacote com aulas para esta turma.`,
          { httpStatus: 422 },
        );
      }
      const ts = nowIso();

      let chargeId: Id | undefined;
      // Cobranca avulsa apenas para aula paga (kind: "dropin"). Se o aluno tinha
      // saido desta mesma aula sem pagar, reaproveita a cobranca encerrada pelo
      // sistema para nao duplicar linha no historico.
      const price = input.amountCents ?? g.sessionPriceCents ?? 0;
      if (kind === "dropin" && price > 0) {
        const existingCanceled = store.charges.find(
          (c) =>
            c.kind === "dropin" &&
            c.sessionId === input.sessionId &&
            c.studentId === input.studentId &&
            c.status === "canceled" &&
            c.canceledBy === "system",
        );
        if (existingCanceled) {
          existingCanceled.competence = sessionDate.slice(0, 7);
          existingCanceled.dueDate = sessionDate;
          existingCanceled.amountCents = price;
          existingCanceled.status = "pending";
          existingCanceled.canceledBy = undefined;
          existingCanceled.cancelReason = undefined;
          existingCanceled.replaced = undefined;
          existingCanceled.notes = undefined;
          existingCanceled.updatedAt = ts;
          chargeId = existingCanceled.id;
        } else {
          const charge: Charge = {
            id: newId(),
            organizationId: store.organization.id,
            studentId: input.studentId,
            kind: "dropin",
            unitId: g.unitId,
            classGroupId: g.id,
            sessionId: input.sessionId,
            competence: sessionDate.slice(0, 7),
            dueDate: sessionDate,
            amountCents: price,
            status: "pending",
            createdAt: ts,
            updatedAt: ts,
          };
          store.charges.push(charge);
          chargeId = charge.id;
        }
      }

      const reservation: ClassReservation = {
        id: newId(),
        classGroupId: g.id,
        sessionId: input.sessionId,
        studentId: input.studentId,
        kind,
        chargeId,
        cobrancaId: chargeId,
        status: "reserved",
        reservedAt: ts,
      };

      store.reservations.push(reservation);
      auditLogService.record({
        action: "created",
        target: { type: "enrollment", id: reservation.id, label: `${studentName(input.studentId)} em ${g.name}` },
        predicate: `inscreveu ${studentName(input.studentId)} na aula de ${sessionDate.split("-").reverse().join("/")} da turma ${g.name}${chargeId ? ` (cobrança avulsa de ${formatCents(price)})` : kind === "package" ? " (usa 1 aula do pacote)" : ""}`,
      });

      return clone({
        ...reservation,
        studentName: studentName(input.studentId),
      });
    });
  },

  cancelReservation(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return simulateWrite(async () => {
      const r = store.reservations.find(
        (x) =>
          x.sessionId === input.sessionId &&
          x.studentId === input.studentId &&
          x.status === "reserved",
      );
      if (!r) throw notFoundError("Reserva não encontrada.");
      // Quem entrou pelo pacote devolve a aula, se ja tinha gastado.
      const returned = r.kind === "package" && syncAttendanceUsage(input.sessionId, input.studentId) === "reverted";
      // A presenca sai junto: voltar para a aula comeca sem marcacao (e gasta de novo).
      store.attendances = store.attendances.filter(
        (a) => !(a.sessionId === input.sessionId && a.studentId === input.studentId),
      );

      r.status = "canceled";
      // Cancela a cobranca avulsa vinculada (por chargeId ou busca), se ainda nao paga.
      const targetChargeId = r.chargeId || r.cobrancaId;
      const charge = r.kind === "package"
        ? undefined
        : targetChargeId
        ? store.charges.find((c) => c.id === targetChargeId && c.status !== "paid")
        : store.charges.find(
            (c) =>
              c.kind === "dropin" &&
              c.sessionId === input.sessionId &&
              c.studentId === input.studentId &&
              c.status !== "paid",
          );
      if (charge) {
        charge.status = "canceled";
        // Cancelada pelo sistema (aluno saiu da aula), nao por decisao do usuario.
        charge.canceledBy = "system";
        charge.notes = "Saiu da aula";
        charge.updatedAt = nowIso();
      }
      auditLogService.record({
        action: "cancelled",
        target: { type: "enrollment", id: r.id, label: studentName(input.studentId) },
        predicate: `removeu ${studentName(input.studentId)} da aula${charge ? " e cancelou a cobrança avulsa" : returned ? " e devolveu a aula do pacote" : ""}`,
      });
    });
  },

  cancelReserva(input: { sessionId: Id; studentId: Id }): Promise<void> {
    return this.cancelReservation(input);
  },
};
