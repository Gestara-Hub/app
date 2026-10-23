import type {
  Charge,
  Id,
  SellPackage,
  StudentPackage,
  StudentPackageFilter,
  StudentPackageView,
} from "@gestarahub/contracts";
import { splitInstallments } from "@gestarahub/core/billing";
import { formatCents, plural } from "@gestarahub/core/format";
import { carryOverSources, leftoverLots, mergeLots, packageExpiresAt } from "@gestarahub/core/packages";
import { store } from "@/services/world/store";
import { apiError, newId, notFoundError, nowIso, readOp, writeOp, validationError } from "@/services/world/ops";
import { withKind } from "@/lib/text";
import { auditLogService } from "../audit/auditLogService";
import { cancelOnlinePaymentsForCharge } from "../onlinePayments";
import { clone, studentName, todayISO } from "./billingHelpers";
import { validateSale } from "./billingValidation";
import { toView } from "./billingViews";

const ACTIVE_STATUSES = new Set(["pending", "overdue"]);

export const studentPackagesService = {
  // --- Pacotes dos alunos --------------------------------------------------
  listStudentPackages(filter?: StudentPackageFilter): Promise<StudentPackageView[]> {
    return readOp(async () => {
      let result = store.studentPackages;
      if (filter?.studentId) result = result.filter((p) => p.studentId === filter.studentId);
      if (filter?.status) result = result.filter((p) => p.status === filter.status);
      return clone(
        [...result]
          .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt))
          .map(toView),
      );
    });
  },

  /**
   * Venda do pacote: cria o pacote do aluno e as cobrancas (a vista ou em ate
   * 12 parcelas mensais, como a cobranca avulsa). Regra 6: o saldo dos pacotes
   * ativos nas mesmas modalidades vem para este, com a validade deste; os
   * antigos ficam "Renovado".
   */
  sellPackage(payload: SellPackage): Promise<StudentPackageView> {
    return writeOp(async () => {
      validateSale(payload);
      const student = store.clients.find((c) => c.id === payload.studentId);
      if (!student) throw validationError([{ field: "studentId", message: "Aluno não encontrado." }]);
      if (student.status !== "active") {
        throw validationError([
          { field: "studentId", message: "Aluno inativo. Reative o cadastro para vender o pacote." },
        ]);
      }
      const catalog = store.lessonPackages.find((p) => p.id === payload.packageId);
      if (!catalog) throw validationError([{ field: "packageId", message: "Pacote não encontrado." }]);
      if (catalog.status !== "active") {
        throw validationError([{ field: "packageId", message: "Pacote inativo. Reative-o em Planos para vender." }]);
      }

      const today = todayISO();
      const ts = nowIso();
      const id = newId();
      const owned = store.studentPackages.filter((p) => p.studentId === student.id);
      // Renova so o mesmo pacote do catalogo; outro pacote fica separado.
      const carry = carryOverSources(owned, catalog.id, today);
      // De onde vem cada aula trazida (o pacote que a vendeu), antes de renovar.
      const carriedFrom = mergeLots(carry.sources.flatMap((source) => leftoverLots(source, source.lessonsUsed)));
      for (const source of carry.sources) {
        source.status = "renewed";
        source.renewedIntoId = id;
        source.updatedAt = ts;
      }

      const parts = splitInstallments(payload.priceCents, payload.installments, payload.firstDueDate);
      const isSplit = parts.length > 1;
      const groupId = isSplit ? newId() : undefined;
      const charges: Charge[] = parts.map((part) => ({
        id: newId(),
        organizationId: store.organization.id,
        unitId: store.unit.id,
        studentId: student.id,
        kind: "package",
        description: catalog.name,
        studentPackageId: id,
        installmentGroupId: groupId,
        competence: part.dueDate.slice(0, 7),
        dueDate: part.dueDate,
        amountCents: part.amountCents,
        status: "pending",
        cycleIndex: isSplit ? part.index : undefined,
        cycleTotal: isSplit ? part.total : undefined,
        createdAt: ts,
        updatedAt: ts,
      }));

      const sold: StudentPackage = {
        id,
        organizationId: store.organization.id,
        unitId: store.unit.id,
        studentId: student.id,
        packageId: catalog.id,
        name: catalog.name,
        lessonsTotal: catalog.lessons + carry.lessons,
        lessonsUsed: 0,
        purchasedAt: today,
        expiresAt: packageExpiresAt(today, catalog.validityDays),
        classGroupIds: catalog.classGroupIds?.length ? [...catalog.classGroupIds] : undefined,
        modalityIds: [...catalog.modalityIds],
        absenceConsumes: catalog.absenceConsumes,
        status: "active",
        carriedOverLessons: carry.lessons > 0 ? carry.lessons : undefined,
        carriedFrom: carry.lessons > 0 ? carriedFrom : undefined,
        renewedFromId: carry.sources[0]?.id,
        chargeIds: charges.map((c) => c.id),
        usages: [],
        createdAt: ts,
        updatedAt: ts,
      };

      store.charges.push(...charges);
      store.studentPackages.push(sold);
      auditLogService.record({
        action: "created",
        // Mesmo alvo do cancelamento: o filtro "Pacote de aulas" mostra a venda.
        target: { type: "lesson_package", id: sold.id, label: `${catalog.name} de ${student.name}` },
        predicate: `vendeu o ${withKind("pacote", catalog.name)} para ${student.name} (${formatCents(payload.priceCents)}${isSplit ? `, em ${parts.length} parcelas` : ""})${carry.lessons > 0 ? `, com ${plural(carry.lessons, "aula trazida", "aulas trazidas")} do pacote anterior` : ""}`,
      });
      return clone(toView(sold));
    });
  },

  /**
   * Desfaz a venda de um pacote ainda sem aula usada: cancela as cobrancas em
   * aberto (e o Pix ou link delas); as pagas ficam. Se o pacote trouxe saldo
   * de outro, o anterior volta a valer.
   */
  cancelStudentPackage(id: Id): Promise<StudentPackageView> {
    return writeOp(async () => {
      const pkg = store.studentPackages.find((p) => p.id === id);
      if (!pkg) throw notFoundError("Pacote não encontrado.");
      if (pkg.status === "canceled") {
        throw apiError("VALIDATION", "Este pacote já foi cancelado.", { httpStatus: 409 });
      }
      if (pkg.status === "renewed") {
        throw apiError("VALIDATION", "O saldo deste pacote já passou para o pacote novo.", { httpStatus: 409 });
      }
      if (pkg.usages.length > 0) {
        throw apiError("VALIDATION", "O pacote já tem aulas usadas.", { httpStatus: 409 });
      }
      const ts = nowIso();
      pkg.status = "canceled";
      pkg.updatedAt = ts;
      let canceled = 0;
      const canceledCharges: Charge[] = [];
      for (const c of store.charges) {
        if (!pkg.chargeIds.includes(c.id) || !ACTIVE_STATUSES.has(c.status)) continue;
        c.status = "canceled";
        c.canceledBy = "system";
        c.cancelReason = "Pacote cancelado";
        c.updatedAt = ts;
        cancelOnlinePaymentsForCharge(c.id);
        canceledCharges.push(c);
        canceled += 1;
      }
      const restoredSources: StudentPackage[] = [];
      for (const previous of store.studentPackages) {
        if (previous.renewedIntoId !== pkg.id || previous.status !== "renewed") continue;
        previous.status = "active";
        previous.renewedIntoId = undefined;
        previous.updatedAt = ts;
        restoredSources.push(previous);
      }
      const name = studentName(pkg.studentId);
      auditLogService.record({
        action: "cancelled",
        target: { type: "lesson_package", id: pkg.id, label: `${pkg.name} de ${name}` },
        predicate: `cancelou o ${withKind("pacote", pkg.name)} de ${name}${canceled > 0 ? ` e ${plural(canceled, "cobrança em aberto", "cobranças em aberto")}` : ""}`,
      });
      return clone(toView(pkg));
    });
  },
};
