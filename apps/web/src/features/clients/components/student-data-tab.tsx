"use client";

import type { ReactNode } from "react";
import { Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import type { Client, StudentSummary } from "@gestarahub/contracts";
import { brDate, PERIOD_SHORT, TIMING_LABEL } from "./student-profile-parts";
import { ageLabel } from "@/lib/birthdays";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const EMPTY = <span className="text-muted-foreground">Não informado</span>;

function addressText(address: Client["address"]): string | null {
  if (!address?.street) return null;
  const line1 = [address.street, address.number].filter(Boolean).join(", ");
  return [line1, address.complement, address.neighborhood, [address.city, address.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
}

/** Aba "Dados" da ficha: cadastro, responsaveis e mensalidade (so leitura). */
export function StudentDataTab({
  summary,
  isClasses,
  onEdit,
}: {
  summary: StudentSummary;
  isClasses: boolean;
  /** Ausente sem permissao de editar. */
  onEdit?: () => void;
}) {
  const { student, membership } = summary;
  const guardians = student.guardians ?? [];
  const address = addressText(student.address);
  const editButton = onEdit ? (
    <Button variant="outline" onClick={onEdit}>
      <Pencil className="size-4" />
      Editar
    </Button>
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Section title="Cadastro" action={editButton}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome">{student.name}</Field>
          <Field label="Telefone">{student.phone ? formatPhone(student.phone) : EMPTY}</Field>
          <Field label="E-mail">{student.email || EMPTY}</Field>
          <Field label="Nascimento">
            {student.birthDate
              ? `${brDate(student.birthDate)}${summary.age !== null ? ` · ${ageLabel(summary.age)}` : ""}`
              : EMPTY}
          </Field>
          <Field label={isClasses ? "Aluno desde" : "Cliente desde"}>{brDate(summary.studentSince)}</Field>
          {address ? <Field label="Endereço">{address}</Field> : null}
        </dl>
        {student.notes ? (
          <div className="mt-3 border-t border-border/50 pt-3">
            <Field label="Observações">{student.notes}</Field>
          </div>
        ) : null}
      </Section>

      {isClasses ? (
        <Section title="Mensalidade">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Plano">{membership.planName ?? "Sem mensalidade"}</Field>
            {membership.priceCents !== undefined ? (
              <Field label="Valor">
                <span className="tabular-nums">
                  {formatCents(membership.priceCents)}/{PERIOD_SHORT[membership.planPeriod ?? "monthly"]}
                </span>
                {membership.listPriceCents !== undefined && membership.listPriceCents > membership.priceCents ? (
                  <span className="ml-1.5 text-xs text-muted-foreground line-through tabular-nums">
                    {formatCents(membership.listPriceCents)}
                  </span>
                ) : null}
              </Field>
            ) : null}
            {membership.planId ? (
              <>
                <Field label="Situação">
                  {membership.status === "paused" ? "Trancada" : membership.status === "canceled" ? "Cancelada" : "Ativa"}
                </Field>
                {membership.paymentTiming ? (
                  <Field label="Cobrança">{TIMING_LABEL[membership.paymentTiming]}</Field>
                ) : null}
                {membership.dueDay ? <Field label="Vencimento">Dia {membership.dueDay}</Field> : null}
                <Field label="Pix Automático">{membership.recurringActive ? "Ativo" : "Desligado"}</Field>
              </>
            ) : null}
            {membership.scholarship ? (
              <Field label="Bolsa">
                {membership.scholarship.full ? "Integral" : `${membership.scholarship.percent}%`}
                {membership.scholarship.reason ? ` · ${membership.scholarship.reason}` : ""}
                {membership.scholarship.validUntil ? ` · até ${brDate(membership.scholarship.validUntil)}` : ""}
              </Field>
            ) : null}
          </dl>
        </Section>
      ) : null}

      <Section title="Responsáveis">
        {guardians.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 shrink-0" />
            Nenhum responsável cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {guardians.map((g, i) => (
              <li key={`${g.name}-${i}`} className="py-2 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">
                  {g.name}
                  {g.relationship ? <span className="font-normal text-muted-foreground"> · {g.relationship}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[g.phone ? formatPhone(g.phone) : null, g.email].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
