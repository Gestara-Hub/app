"use client";

import { useState, type ReactNode } from "react";
import { FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { formatPhone } from "@gestarahub/core/format";
import type { Client, StudentSummary } from "@gestarahub/contracts";
import type { ClientFormFocus } from "./client-form";
import { useConfirmPaperMinorConsent, useRevokePaperMinorConsent } from "../hooks/use-clients";
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
  /** Ausente sem permissao de editar. Recebe o primeiro campo que falta. */
  onEdit?: (field?: ClientFormFocus) => void;
}) {
  const { student } = summary;
  const guardians = student.guardians ?? [];
  const address = addressText(student.address);
  const isMinor = summary.age !== null && summary.age < 18;
  const confirmPaperMutation = useConfirmPaperMinorConsent();
  const revokePaperMutation = useRevokePaperMinorConsent();

  const [confirmPaperOpen, setConfirmPaperOpen] = useState(false);
  const [revokePaperOpen, setRevokePaperOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<string>(
    guardians[0]?.name ? guardians[0].name : "__custom__",
  );
  const [customGuardian, setCustomGuardian] = useState<string>("");

  // Termo em PDF: gerado no servidor (conta real).
  const serverDocuments = isSupabaseOrganization(useCurrentUser().organizationId);
  const missingCandidates: Array<[ClientFormFocus, string, unknown]> = [
    ["phone", "telefone", student.phone],
    ["email", "e-mail", student.email],
    ["birthDate", "nascimento", student.birthDate],
    ...(!isMinor ? [["cpf", "CPF", student.cpf] as [ClientFormFocus, string, unknown]] : []),
  ];
  const missingFields = missingCandidates.filter(([, , value]) => !value);
  const missing = missingFields.map(([, label]) => label);

  const resolvedGuardianName =
    selectedGuardian === "__custom__"
      ? customGuardian.trim()
      : selectedGuardian.trim() || guardians[0]?.name || "Responsável legal";

  const handleConfirmPaper = async () => {
    try {
      const res = await confirmPaperMutation.mutateAsync({
        studentId: student.id,
        guardianName: resolvedGuardianName,
      });
      if (res.success) {
        toast.success("Termo físico registrado com sucesso.");
        setConfirmPaperOpen(false);
      } else {
        toast.error(res.error || "Não foi possível registrar o termo físico.");
      }
    } catch {
      toast.error("Erro ao registrar termo físico.");
    }
  };

  const handleRevokePaper = async () => {
    try {
      const res = await revokePaperMutation.mutateAsync({ studentId: student.id });
      if (res.success) {
        toast.success("Registro de termo impresso desfeito. Situação voltou para pendente.");
        setRevokePaperOpen(false);
      } else {
        toast.error(res.error || "Não foi possível desfazer.");
      }
    } catch {
      toast.error("Erro ao desfazer termo impresso.");
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
                onClick={() => onEdit(missingFields[0]?.[0])}
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
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!consent.done ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedGuardian(guardians[0]?.name ? guardians[0].name : "__custom__");
                  setCustomGuardian("");
                  setConfirmPaperOpen(true);
                }}
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
            {student.minorConsentStatus === "confirmed_paper" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRevokePaperOpen(true)}
                disabled={revokePaperMutation.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="size-4" />
                Desfazer registro (voltar para pendente)
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmActionDialog
        open={revokePaperOpen}
        onOpenChange={setRevokePaperOpen}
        title="Desfazer registro de termo impresso?"
        description="A autorização LGPD voltará ao status pendente. Você poderá coletar a assinatura física novamente ou enviar o link por WhatsApp para o responsável assinar digitalmente."
        confirmLabel="Desfazer registro"
        cancelLabel="Voltar"
        variant="destructive"
        isPending={revokePaperMutation.isPending}
        onConfirm={handleRevokePaper}
      />

      <Dialog open={confirmPaperOpen} onOpenChange={setConfirmPaperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="size-5 text-primary" />
              Registrar termo impresso (em papel)
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs text-muted-foreground">
              Confirmação de autorização física assinada presencialmente na recepção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Exigência Legal (Art. 14 da LGPD)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed">
                O tratamento de dados pessoais de crianças e adolescentes requer o consentimento formal de ao menos um dos pais ou responsável legal.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-1.5 leading-relaxed">
              <p className="font-medium text-foreground">Quando usar esta opção?</p>
              <p className="text-[11px] text-muted-foreground">
                Use quando o responsável compareceu <strong>presencialmente na sua recepção</strong> e assinou a folha de matrícula / termo impresso em papel.
              </p>
              <p className="text-[11px] text-muted-foreground">
                📁 <strong>Importante:</strong> A via física assinada deve ser mantida arquivada na pasta do aluno na sua unidade para fins de comprovação legal.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">
                Quem assinou o termo na recepção?
              </label>
              {guardians.length > 0 ? (
                <div className="space-y-1.5">
                  {guardians.map((g) => (
                    <label
                      key={g.name}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors",
                        selectedGuardian === g.name
                          ? "border-primary bg-primary/5 font-medium text-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="guardianRadio"
                        checked={selectedGuardian === g.name}
                        onChange={() => {
                          setSelectedGuardian(g.name);
                          setCustomGuardian("");
                        }}
                        className="size-3.5 text-primary focus:ring-primary"
                      />
                      <span>{g.name}</span>
                      {g.relationship ? (
                        <span className="text-[11px] text-muted-foreground">· {g.relationship}</span>
                      ) : null}
                    </label>
                  ))}
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors",
                      selectedGuardian === "__custom__"
                        ? "border-primary bg-primary/5 font-medium text-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="guardianRadio"
                      checked={selectedGuardian === "__custom__"}
                      onChange={() => setSelectedGuardian("__custom__")}
                      className="size-3.5 text-primary focus:ring-primary"
                    />
                    <span>Outro responsável</span>
                  </label>
                  {selectedGuardian === "__custom__" ? (
                    <input
                      type="text"
                      placeholder="Nome completo do responsável que assinou..."
                      value={customGuardian}
                      onChange={(e) => setCustomGuardian(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  ) : null}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Nome completo do responsável que assinou..."
                  value={customGuardian}
                  onChange={(e) => setCustomGuardian(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmPaperOpen(false)}
              disabled={confirmPaperMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPaper}
              disabled={
                confirmPaperMutation.isPending ||
                (selectedGuardian === "__custom__" && !customGuardian.trim()) ||
                (guardians.length === 0 && !customGuardian.trim())
              }
            >
              {confirmPaperMutation.isPending ? "Registrando..." : "Confirmar arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
