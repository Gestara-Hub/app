"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import { useLegalConsent } from "../hooks/use-legal-consent";
import { useCurrentUser } from "../session-provider";

type LegalTab = "lgpd" | "payments" | "audit";

export function LegalConsentDialog() {
  const user = useCurrentUser();
  const { isAccepted, isLoading, recordConsent, isSubmitting } =
    useLegalConsent();
  const [agreed, setAgreed] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState<LegalTab>("lgpd");
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Se já aceito ou ainda carregando a validação inicial, não exibe
  if (isLoading || isAccepted) {
    return null;
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
    }
  };

  const handleAccept = async () => {
    if (!agreed) {
      setHasError(true);
      return;
    }
    setHasError(false);

    try {
      const result = await recordConsent({
        metadata: {
          source: "first_login_dialog",
          userRole: user.profile,
          organizationId: user.organizationId,
        },
      });

      if (!result.success) {
        toast.error(result.error || "Não foi possível registrar o aceite.");
        return;
      }

      toast.success(
        "Termos aceitos com sucesso! Seja bem-vindo ao GestaraHub.",
      );
    } catch (err) {
      console.error("[LegalConsentDialog] Erro ao aceitar termos:", err);
      toast.error("Ocorreu um erro ao salvar o aceite. Tente novamente.");
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        closeOnInteractOutside={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-2xl max-h-[92vh] flex flex-col p-6 gap-5"
      >
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-primary px-2.5 py-0.5 font-medium"
            >
              <ShieldCheck className="size-3.5" />
              Conformidade LGPD & Marco Civil
            </Badge>
            <span className="text-xs text-muted-foreground">
              Versão Vigente: v1.0-2026-10
            </span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Termos de Uso e Política de Privacidade
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Olá, <strong className="text-foreground">{user.name}</strong>. Para
            garantir a segurança jurídica da sua organização e cumprir as
            normas da ANPD e do Marco Civil da Internet, revise e confirme o
            aceite antes de acessar o sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Navegação entre seções dos termos */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("lgpd")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors cursor-pointer ${
              activeTab === "lgpd"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5" />
            <span>LGPD e Dados</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors cursor-pointer ${
              activeTab === "payments"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="size-3.5" />
            <span>Pagamentos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors cursor-pointer ${
              activeTab === "audit"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scale className="size-3.5" />
            <span>Auditoria & Direitos</span>
          </button>
        </div>

        {/* Conteúdo rolável com destaques claros */}
        <ScrollArea className="h-64 rounded-lg border bg-muted/15 p-4 text-xs leading-relaxed text-muted-foreground">
          {activeTab === "lgpd" && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" />
                Papéis LGPD e Tratamento de Dados (Lei 13.709/2018)
              </h4>
              <p>
                <strong>1. Papéis Regulatórios:</strong> Pela LGPD, o seu
                espaço/empresa atua como <strong>Controlador</strong> dos dados
                pessoais dos seus alunos, responsáveis e instrutores. A
                GestaraHub atua estritamente como <strong>Operadora</strong>,
                fornecendo a infraestrutura tecnológica para organização das
                atividades.
              </p>
              <p>
                <strong>2. Finalidade Legítima:</strong> Os dados cadastrados
                (nomes, contatos, datas de nascimento, presenças, planos e
                valores) são tratados exclusivamente para o funcionamento do
                sistema: gestão de turmas, agendamento de sessões, controle de
                frequência, emissão de cobranças e comunicação.
              </p>
              <p>
                <strong>3. Não Comercialização:</strong> A GestaraHub{" "}
                <strong>nunca comercializa nem transfere</strong> seus dados ou
                os dados dos seus alunos para terceiros para fins de
                publicidade, enriquecimento de leads ou marketing direto.
              </p>
              <p>
                <strong>4. Segurança e Criptografia:</strong> Os dados trafegam
                sob conexões seguras criptografadas (HTTPS/TLS) e são armazenados
                com isolamento lógico estrito entre organizações (multi-tenant).
              </p>
              <p>
                <strong>5. Alunos Menores de Idade (Art. 14 LGPD):</strong> Para
                alunos menores de 18 anos cadastrados nas turmas, o estabelecimento
                declara possuir a anuência prévia dos pais ou responsáveis legais.
              </p>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Wallet className="size-4 text-primary" />
                Intermediação Financeira e Gateways Homologados
              </h4>
              <p>
                <strong>1. Integração com Instituições Reguladas:</strong> Ao
                utilizar cobranças online (Pix instantâneo, QR Code, boletos ou
                cartão), os pagamentos são processados por instituições de
                pagamento homologadas e supervisionadas pelo Banco Central do
                Brasil (BACEN), incluindo a Asaas Gestão Financeira IP S.A.
              </p>
              <p>
                <strong>2. Subcontas e Mandato de Intermediação:</strong> Ao
                ativar recebimentos na plataforma, o titular da organização
                autoriza a abertura e gestão operacional da subconta integrada,
                bem como as retenções e tarifas previamente informadas na tabela
                de planos e serviços.
              </p>
              <p>
                <strong>3. Prevenção a Fraudes e Liquidação:</strong> Os dados
                das transações são compartilhados estritamente na medida
                necessária para prevenção a fraudes financeiras, conformidade
                com as regras do BACEN e liquidação bancária.
              </p>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Scale className="size-4 text-primary" />
                Evidências Probatórias e Direitos do Titular
              </h4>
              <p>
                <strong>
                  1. Registro Probatório Auditável (Art. 8º §2º LGPD e Marco
                  Civil):
                </strong>{" "}
                Para respaldar você e a plataforma perante órgãos fiscalizadores
                (ANPD, BACEN e Poder Judiciário), o ato de aceite gera uma
                trilha de auditoria eletrônica imutável que registra:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Endereço IP público de conexão</li>
                <li>Identificador de navegação (User-Agent completo)</li>
                <li>Carimbo temporal preciso em UTC (servidor)</li>
                <li>Hash criptográfico SHA-256 do documento aceito</li>
                <li>Identificação cadastral da conta e organização</li>
              </ul>
              <p>
                <strong>2. Direitos do Titular (Art. 18 LGPD):</strong> Você e
                seus alunos têm o direito de confirmar o tratamento, acessar,
                corrigir dados incompletos ou inexatos, solicitar
                anonimização e portabilidade a qualquer momento.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Alerta de transparência probatória */}
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="leading-relaxed">
            Ao confirmar, seu aceite eletrônico será auditado e arquivado nos
            termos dos Arts. 10 e 15 da Lei 12.965/2014 (Marco Civil) e do Art.
            8º §2º da Lei 13.709/2018 (LGPD).
          </p>
        </div>

        {/* Checkbox de aceite obrigatório */}
        <div className="space-y-1.5">
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 shadow-xs transition-colors",
              hasError
                ? "border-destructive bg-destructive/5 ring-1 ring-destructive/40"
                : "border-border bg-card",
            )}
          >
            <Checkbox
              id="terms-consent-checkbox"
              checked={agreed}
              onCheckedChange={(val) => {
                const checked = Boolean(val);
                setAgreed(checked);
                if (checked) {
                  setHasError(false);
                }
              }}
              className={cn("mt-0.5 shrink-0", hasError && "border-destructive")}
            />
            <Label
              htmlFor="terms-consent-checkbox"
              className="block flex-1 text-xs font-normal leading-relaxed text-foreground cursor-pointer select-none"
            >
              Declaro que li, compreendi e concordo integralmente com os{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
              >
                Termos de Uso
                <ExternalLink className="size-2.5" />
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
              >
                Política de Privacidade
                <ExternalLink className="size-2.5" />
              </Link>{" "}
              da GestaraHub.
            </Label>
          </div>
          {hasError && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 px-1">
              <AlertCircle className="size-3.5 shrink-0" />
              É necessário marcar a caixa de seleção para aceitar os termos e continuar.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between items-center gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut || isSubmitting}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-destructive gap-1.5"
          >
            {isSigningOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            Recusar e sair
          </Button>

          <Button
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting || isSigningOut}
            className="w-full sm:w-auto gap-2 font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Registrando aceite…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Aceitar e continuar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
