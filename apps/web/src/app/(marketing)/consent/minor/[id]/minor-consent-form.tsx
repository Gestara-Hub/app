"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmMinorConsentAction } from "@/services/legalConsent/actions";
import { logError } from "@/lib/log";

interface MinorConsentFormProps {
  student: {
    id: string;
    name: string;
    birthDate?: string;
    guardians?: Array<{ name: string; relationship?: string; phone?: string }>;
    minorConsentStatus?: string;
    organizationName: string;
  };
}

export function MinorConsentForm({ student }: MinorConsentFormProps) {
  const primaryGuardian = student.guardians?.[0];
  const [guardianName, setGuardianName] = useState(
    primaryGuardian?.name || "",
  );
  const [relationship, setRelationship] = useState(
    primaryGuardian?.relationship || "Pai / Mãe / Responsável Legal",
  );
  const [phone, setPhone] = useState(primaryGuardian?.phone || "");
  const [agreed, setAgreed] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(
    student.minorConsentStatus === "confirmed_whatsapp" ||
      student.minorConsentStatus === "confirmed_paper",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setHasError(true);
      return;
    }
    if (!guardianName.trim()) {
      toast.error("Informe seu nome completo como responsável.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmMinorConsentAction({
        studentId: student.id,
        guardianName: guardianName.trim(),
        guardianPhone: phone.trim() || undefined,
        relationship: relationship.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Não foi possível registrar a autorização.");
        setIsSubmitting(false);
        return;
      }

      setIsConfirmed(true);
      toast.success("Autorização confirmada com sucesso!");
    } catch (err) {
      logError("[MinorConsentForm] Erro ao confirmar autorização:", err);
      toast.error("Ocorreu um erro ao processar. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const formattedBirthDate = student.birthDate
    ? student.birthDate.split("-").reverse().join("/")
    : null;

  if (isConfirmed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 sm:p-8 shadow-sm space-y-6 text-center animate-in fade-in">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            Autorização Confirmada com Sucesso!
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Muito obrigado, <strong className="text-foreground">{guardianName || "Responsável"}</strong>. A matrícula e a autorização de tratamento de dados de{" "}
            <strong className="text-foreground">{student.name}</strong> foram registradas com segurança na{" "}
            <strong className="text-foreground">{student.organizationName}</strong>.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1 text-left">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Lock className="size-3.5 text-primary" />
            Registro Eletrônico Auditado
          </p>
          <p>
            O aceite foi certificado com carimbo temporal oficial, IP de conexão e arquivamento seguro em conformidade com o Artigo 14 da LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-primary/30 bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
          >
            <ShieldCheck className="size-3.5" />
            Conformidade LGPD · Art. 14
          </Badge>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Autorização de Matrícula e Dados de Menor
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Termo de consentimento e representação para atividades esportivas e educacionais.
          </p>
        </div>
      </header>

      {/* Dados do Aluno e Estabelecimento */}
      <div className="rounded-xl border bg-muted/15 p-4 space-y-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Building2 className="size-4 shrink-0 text-primary mt-0.5" />
          <div>
            <span className="text-muted-foreground">Estabelecimento:</span>
            <p className="font-semibold text-foreground text-sm">
              {student.organizationName}
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-start gap-2.5">
            <User className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground">Aluno(a) Menor:</span>
              <p className="font-semibold text-foreground">{student.name}</p>
            </div>
          </div>
          {formattedBirthDate && (
            <div className="flex items-start gap-2.5">
              <Calendar className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-muted-foreground">Nascimento:</span>
                <p className="font-medium text-foreground">
                  {formattedBirthDate}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identificação do Responsável */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="size-3.5" />
            Dados do Responsável Legal
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="guardian-name" className="text-xs">
                Seu Nome Completo (Pai, Mãe ou Tutor)<span className="text-destructive">*</span>
              </Label>
              <Input
                id="guardian-name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Informe seu nome completo"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardian-relationship" className="text-xs">
                Grau de Parentesco
              </Label>
              <Input
                id="guardian-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Ex.: Pai, Mãe, Avó, Tutor"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardian-phone" className="text-xs">
                Seu Telefone (WhatsApp)
              </Label>
              <Input
                id="guardian-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Termos e Declarações */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileCheck2 className="size-3.5" />
            Declarações de Consentimento
          </h2>
          <div className="rounded-lg border bg-muted/10 p-3.5 text-xs text-muted-foreground space-y-2.5 leading-relaxed">
            <p>
              <strong>1. Matrícula e Atividades:</strong> Autorizo a matrícula e a participação de <strong>{student.name}</strong> nas aulas, treinos, turmas e atividades promovidas por <strong>{student.organizationName}</strong>.
            </p>
            <p>
              <strong>2. Tratamento de Dados (Art. 14 da LGPD):</strong> Autorizo a coleta e o tratamento dos dados cadastrais (nome, nascimento, controle de frequência e pagamentos) estritamente para a gestão pedagógica e operacional da escola/academia, com proibição de comercialização a terceiros.
            </p>
            <p>
              <strong>3. Notificações:</strong> Concordo em receber lembretes de aulas, avisos escolares e cobranças no número de contato informado.
            </p>
          </div>
        </div>

        {/* Checkbox de Aceite */}
        <div className="space-y-1.5">
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 shadow-xs transition-colors ${
              hasError
                ? "border-destructive bg-destructive/5 ring-1 ring-destructive/40"
                : "border-border bg-card"
            }`}
          >
            <Checkbox
              id="minor-agree"
              checked={agreed}
              onCheckedChange={(val) => {
                const checked = Boolean(val);
                setAgreed(checked);
                if (checked) setHasError(false);
              }}
              className="mt-0.5 shrink-0"
            />
            <Label
              htmlFor="minor-agree"
              className="block flex-1 text-xs font-normal leading-relaxed text-foreground cursor-pointer select-none"
            >
              Declaro que sou o(a) responsável legal por <strong>{student.name}</strong> e autorizo expressamente sua matrícula e o tratamento de dados pessoais nos termos acima.
            </Label>
          </div>
          {hasError && (
            <p className="text-xs font-medium text-destructive px-1">
              É necessário marcar a caixa de confirmação para autorizar.
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full gap-2 font-semibold text-sm h-11"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Confirmando autorização…
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              Confirmar autorização de matrícula
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          Ao confirmar, registramos de forma auditada seu IP, dispositivo e horário nos termos da Lei 13.709/2018 (LGPD). Dúvidas? Consulte nossa{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5">
            Política de Privacidade
            <ExternalLink className="size-2.5" />
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
