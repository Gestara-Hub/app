"use client";

import type { ReactNode } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@gestarahub/core/format";
import type { Client, StudentSummary } from "@gestarahub/contracts";
import { useConfirmPaperMinorConsent } from "../hooks/use-clients";
import { brDate } from "./student-profile-parts";
import { ageLabel } from "@/lib/birthdays";
import { isSupabaseOrganization } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/auth";
import { dateInSpace } from "@gestarahub/core/date";

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "sm:col-span-2 lg:col-span-3")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function addressText(address: Client["address"]): string | null {
  if (!address?.street) return null;
  const line1 = [address.street, address.number].filter(Boolean).join(", ");
  return [line1, address.complement, address.neighborhood, [address.city, address.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
}

/** "e-mail e nascimento", "telefone, e-mail e nascimento". */
function joinWithAnd(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/**
 * Secao "Cadastro" da ficha (doc 07 §1.8, 30/10/2026): os dados numa grade sem
 * cartoes, so os preenchidos; o que falta vira uma linha com "Completar
 * cadastro". Responsaveis entram na grade (sempre para menor). Menor de idade
 * mostra a autorizacao LGPD: enviar e copiar o link ficam no aviso do topo;
 * aqui, registrar o termo impresso e baixar o termo. O plano fica em "Plano e
 * pacotes".
 */
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
  const { student } = summary;
  const guardians = student.guardians ?? [];
  const address = addressText(student.address);
  const isMinor = summary.age !== null && summary.age < 18;
  const confirmPaperMutation = useConfirmPaperMinorConsent();
  // Termo em PDF: gerado no servidor (conta real).
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const missing = [
    student.phone ? null : "telefone",
    student.email ? null : "e-mail",
    student.birthDate ? null : "nascimento",
  ].filter((item): item is string => item !== null);

  const handleConfirmPaper = async () => {
    try {
      const res = await confirmPaperMutation.mutateAsync({
        studentId: student.id,
        guardianName: guardians[0]?.name,
      });
      if (res.success) {
        toast.success("Termo físico registrado com sucesso.");
      } else {
        toast.error(res.error || "Não foi possível registrar o termo físico.");
      }
    } catch {
      toast.error("Erro ao registrar termo físico.");
    }
  };

  const consentAt = student.minorConsentAt ? ` em ${brDate(dateInSpace(student.minorConsentAt))}` : "";
  const consent =
    student.minorConsentStatus === "confirmed_whatsapp"
      ? { status: "autorizada pelo WhatsApp", detail: `Por ${student.minorConsentBy || "responsável legal"}${consentAt}.`, done: true }
      : student.minorConsentStatus === "confirmed_paper"
        ? { status: "termo impresso arquivado", detail: `Assinado na recepção${consentAt}.`, done: true }
        : { status: "pendente", detail: "Não impede as aulas. Envie o link pelo aviso no topo da ficha.", done: false };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {student.phone ? <Field label="Telefone">{formatPhone(student.phone)}</Field> : null}
        {student.email ? <Field label="E-mail">{student.email}</Field> : null}
        {student.birthDate ? (
          <Field label="Nascimento">
            {`${brDate(student.birthDate)}${summary.age !== null ? ` · ${ageLabel(summary.age)}` : ""}`}
          </Field>
        ) : null}
        <Field label={isClasses ? "Aluno desde" : "Cliente desde"}>{brDate(summary.studentSince)}</Field>
        {guardians.length > 0 || isMinor ? (
          <Field label={guardians.length > 1 ? "Responsáveis" : "Responsável"}>
            {guardians.length === 0 ? (
              <span className="text-muted-foreground">Nenhum</span>
            ) : (
              <ul className="space-y-1">
                {guardians.map((g, i) => {
                  const contact = [g.phone ? formatPhone(g.phone) : null, g.email].filter(Boolean).join(" · ");
                  return (
                    <li key={`${g.name}-${i}`}>
                      {g.name}
                      {g.relationship ? <span className="text-muted-foreground"> · {g.relationship}</span> : null}
                      {contact ? <span className="block text-xs text-muted-foreground">{contact}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>
        ) : null}
        {address ? (
          <Field label="Endereço" wide>
            {address}
          </Field>
        ) : null}
        {student.notes ? (
          <Field label="Observações" wide>
            {student.notes}
          </Field>
        ) : null}
      </dl>

      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Falta {joinWithAnd(missing)}
          {onEdit ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
              >
                Completar cadastro
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {isMinor ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Autorização LGPD:
            <span
              className={cn(
                "font-medium",
                consent.done ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
              )}
            >
              {consent.status}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{consent.detail}</p>
          {!consent.done || serverDocuments ? (
            <div className="flex flex-wrap gap-2">
              {!consent.done ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConfirmPaper}
                  disabled={confirmPaperMutation.isPending}
                >
                  <FileText className="size-4" />
                  Registrar termo impresso
                </Button>
              ) : null}
              {serverDocuments ? (
                <Button variant="ghost" asChild>
                  <a href={`/api/documents/students/${student.id}/consent`} target="_blank" rel="noopener">
                    <FileText className="size-4" />
                    Baixar termo
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
