"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  Copy,
  FileText,
  MessageCircle,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents, formatPhone } from "@gestarahub/core/format";
import type { Client, StudentSummary } from "@gestarahub/contracts";
import { useOrganization } from "@/features/settings";
import { useConfirmPaperMinorConsent } from "../hooks/use-clients";
import { brDate, PERIOD_SHORT, TIMING_LABEL } from "./student-profile-parts";
import { ageLabel } from "@/lib/birthdays";
import { minorConsentUrl } from "@/lib/minor-consent-link";
import { isSupabaseOrganization } from "@/lib/session";
import { useCurrentUser } from "@/features/auth";
import { dateInSpace } from "@gestarahub/core/date";

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
  const { data: organization } = useOrganization();
  const confirmPaperMutation = useConfirmPaperMinorConsent();
  // Termo em PDF: gerado no servidor (conta real).
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);

  const handleCopyLink = () => {
    const url = minorConsentUrl(student.id);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Link de autorização copiado para a área de transferência.");
    }
  };

  const handleSendWhatsApp = () => {
    const url = minorConsentUrl(student.id);
    const primaryGuardian = guardians[0];
    const targetPhone = primaryGuardian?.phone || student.phone;
    const guardianGreeting = primaryGuardian?.name ? `, ${primaryGuardian.name}` : "";
    const orgName = organization?.name || "nossa unidade";

    const msg = `Olá${guardianGreeting}! Segue o link para conferência e autorização de matrícula e consentimento LGPD do aluno(a) ${student.name} na ${orgName}:\n\n${url}\n\nLeva menos de 1 minuto para confirmar no celular. Obrigado!`;

    if (!targetPhone) {
      handleCopyLink();
      toast.info("Nenhum telefone de contato cadastrado. O link foi copiado para envio manual.");
      return;
    }

    const cleanPhone = targetPhone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, "_blank");
  };

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
        <div className="space-y-4">
          {summary.age !== null && summary.age < 18 ? (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Consentimento LGPD (Art. 14)</span>
                </div>
                {student.minorConsentStatus === "confirmed_whatsapp" ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-[11px]">
                    <CheckCircle2 className="size-3" />
                    Autorizado via WhatsApp
                  </Badge>
                ) : student.minorConsentStatus === "confirmed_paper" ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-[11px]">
                    <CheckCircle2 className="size-3" />
                    Termo Físico Arquivado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 text-[11px]">
                    <ShieldAlert className="size-3" />
                    Pendente de Autorização
                  </Badge>
                )}
              </div>

              {student.minorConsentStatus === "confirmed_whatsapp" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Autorizado eletronicamente por <strong className="text-foreground">{student.minorConsentBy || "Responsável legal"}</strong>
                  {student.minorConsentAt ? ` em ${brDate(dateInSpace(student.minorConsentAt))}` : ""}. Registro probatório com carimbo temporal arquivado.
                </p>
              ) : student.minorConsentStatus === "confirmed_paper" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Termo impresso assinado presencialmente e arquivado na recepção
                  {student.minorConsentAt ? ` em ${brDate(dateInSpace(student.minorConsentAt))}` : ""}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O consentimento de ao menos um dos pais ou responsável é orientado pela LGPD para o tratamento de dados de menores. A ausência de confirmação não impede o aluno de frequentar as aulas.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendWhatsApp}
                  className="h-8 gap-1.5 text-xs text-foreground"
                >
                  <MessageCircle className="size-3.5 text-emerald-600" />
                  Enviar por WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                  Copiar link
                </Button>
                {student.minorConsentStatus === "pending" || !student.minorConsentStatus ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConfirmPaper}
                    disabled={confirmPaperMutation.isPending}
                    className="h-8 gap-1.5 text-xs text-foreground"
                  >
                    <FileText className="size-3.5" />
                    Registrar termo impresso
                  </Button>
                ) : null}
                {serverDocuments ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <a href={`/api/documents/students/${student.id}/consent`} target="_blank" rel="noopener">
                      <FileText className="size-3.5" />
                      Baixar termo
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

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
        </div>
      </Section>
    </div>
  );
}
