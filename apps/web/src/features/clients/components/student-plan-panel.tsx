"use client";

import type { ReactNode } from "react";
import type { Id, StudentSummary } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { StudentPackagesPanel } from "@/features/turmas";
import { brDate, PERIOD_SHORT, TIMING_LABEL } from "./student-profile-parts";

type Scholarship = NonNullable<StudentSummary["membership"]["scholarship"]>;

/** "Bolsa 50% · Atleta · até 31/12/2026" ou "Bolsista integral". */
export function scholarshipText(scholarship: Scholarship): string {
  return [
    scholarship.full ? "Bolsista integral" : `Bolsa ${scholarship.percent}%`,
    scholarship.reason,
    scholarship.validUntil ? `até ${brDate(scholarship.validUntil)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function InlineLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}

/**
 * "Plano e pacotes" da ficha (doc 07 §1.8, 30/10/2026): o plano em destaque
 * (nome e valor), a linha de situacao, vencimento e pagamento, a bolsa e os
 * pacotes com o saldo. Trocar o plano abre o cadastro. Quem so tem pacote nao
 * ve "Sem mensalidade".
 */
export function StudentPlanPanel({
  summary,
  onEditPlan,
  canManagePackages,
  onSellPackage,
}: {
  summary: StudentSummary;
  /** Ausente sem permissao de editar o aluno. */
  onEditPlan?: () => void;
  canManagePackages: boolean;
  onSellPackage?: (packageId?: Id) => void;
}) {
  const { membership, student } = summary;
  const hasPlan = Boolean(membership.planId && membership.planName);
  const scholarship = membership.scholarship;
  const hasPackages = summary.packages.length > 0;
  const facts = [
    membership.status === "paused" ? "Trancada" : membership.status === "canceled" ? "Cancelada" : null,
    membership.dueDay ? `Vence todo dia ${membership.dueDay}` : null,
    membership.paymentTiming ? `Pagamento ${TIMING_LABEL[membership.paymentTiming].toLowerCase()}` : null,
    `Pix Automático ${membership.recurringActive ? "ligado" : "desligado"}`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {hasPlan ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Plano</p>
              <p className="text-lg font-semibold break-words text-foreground">{membership.planName}</p>
            </div>
            {membership.priceCents !== undefined ? (
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatCents(membership.priceCents)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{PERIOD_SHORT[membership.planPeriod ?? "monthly"]}
                  </span>
                </p>
                {membership.listPriceCents !== undefined && membership.listPriceCents > membership.priceCents ? (
                  <p className="text-xs text-muted-foreground line-through tabular-nums">
                    {formatCents(membership.listPriceCents)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {scholarship ? <p className="mt-1 text-sm text-foreground">{scholarshipText(scholarship)}</p> : null}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {facts.join(" · ")}
            {onEditPlan ? (
              <>
                {" · "}
                <InlineLink onClick={onEditPlan}>Trocar plano</InlineLink>
              </>
            ) : null}
          </p>
        </div>
      ) : scholarship ? (
        <div>
          <p className="text-xs text-muted-foreground">Mensalidade</p>
          <p className="text-lg font-semibold text-foreground">{scholarshipText(scholarship)}</p>
          {onEditPlan ? (
            <p className="mt-1.5 text-xs">
              <InlineLink onClick={onEditPlan}>Trocar plano</InlineLink>
            </p>
          ) : null}
        </div>
      ) : !hasPackages ? (
        <p className="text-sm text-muted-foreground">
          Sem mensalidade.
          {onEditPlan ? (
            <>
              {" "}
              <InlineLink onClick={onEditPlan}>Definir plano</InlineLink>
            </>
          ) : null}
        </p>
      ) : null}

      <div className={hasPlan || scholarship || !hasPackages ? "border-t border-border/60 pt-4" : undefined}>
        <StudentPackagesPanel studentId={student.id} canManage={canManagePackages} onSell={onSellPackage} />
      </div>
    </div>
  );
}
