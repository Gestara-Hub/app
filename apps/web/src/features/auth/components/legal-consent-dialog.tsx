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
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { declineTermsAndSignOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import { useLegalConsent } from "../hooks/use-legal-consent";
import { CURRENT_PLATFORM_TERMS_VERSION } from "@gestarahub/contracts";
import { useCurrentUser } from "../session-provider";
import { logError } from "@/lib/log";

type LegalTab = "lgpd" | "payments" | "audit";

const LEGAL_TABS: { value: LegalTab; label: string; icon: typeof FileText }[] = [
  { value: "lgpd", label: "LGPD", icon: FileText },
  { value: "payments", label: "Pagamentos", icon: Wallet },
  { value: "audit", label: "Direitos", icon: Scale },
];

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
      await declineTermsAndSignOut();
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
      logError("[LegalConsentDialog] Erro ao aceitar termos:", err);
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
        className="flex h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[88vh] sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 gap-3 border-b border-border/40 p-4 text-left sm:p-6 sm:pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="hidden gap-1 border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary sm:inline-flex"
            >
              <ShieldCheck className="size-3.5" />
              Conformidade LGPD & Marco Civil
            </Badge>
            <span className="text-xs text-muted-foreground">
              Versão {CURRENT_PLATFORM_TERMS_VERSION}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
            Termos de Uso e Política de Privacidade
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Olá, <strong className="text-foreground">{user.name}</strong>.
            Revise e aceite para acessar o sistema.
          </DialogDescription>

          {/* Navegação entre seções dos termos */}
          <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
            {LEGAL_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={cn(
                  "flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 font-medium transition-colors",
                  activeTab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0 max-sm:hidden" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Só o texto rola; a key volta a rolagem ao topo ao trocar de aba */}
        <DialogBody
          key={activeTab}
          scrollCueLabel="Continuar lendo"
          className="p-4 text-sm leading-relaxed text-muted-foreground sm:p-6"
        >
          {activeTab === "lgpd" && (
            <div className="space-y-4">
              <div className="border-b border-border/50 pb-2">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" />
                  CLÁUSULA 1ª – DO TRATAMENTO DE DADOS PESSOAIS E PAPÉIS CONTRATUAIS (LEI Nº 13.709/2018 - LGPD)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acordo de Processamento de Dados (DPA) aplicável às operações realizadas no ambiente GestaraHub.
                </p>
              </div>

              <div className="space-y-3 text-foreground/90">
                <p>
                  <strong>1.1. Qualificação das Partes e Responsabilidades Regulatórias:</strong> Para todos os fins e efeitos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), a Organização Contratante é e permanece como a única e exclusiva <strong>Controladora</strong> (Art. 5º, inciso VI), competindo-lhe tomar as decisões referentes ao tratamento de dados pessoais de seus alunos, alunas, pais, responsáveis legais, instrutores e colaboradores. A <strong>GestaraHub</strong> atua estritamente na qualidade de <strong>Operadora de Tecnologia</strong> (Art. 5º, inciso VII), limitando-se a realizar o tratamento automatizado dos dados pessoais única e exclusivamente em nome da Controladora, sob suas instruções lícitas e no estrito limite das funcionalidades contratadas.
                </p>
                <p>
                  <strong>1.2. Finalidades Legítimas e Bases Legais Aplicáveis:</strong> O tratamento de dados pessoais no âmbito da plataforma limita-se às finalidades lícitas e vinculadas à execução do contrato de prestação de serviços (Art. 7º, V da LGPD), cumprimento de obrigação legal ou regulatória (Art. 7º, II) e legítimo interesse (Art. 7º, IX), abrangendo: (a) gestão acadêmica, matricial e operacional de turmas, agendamentos e sessões; (b) controle de chamada, assiduidade, presenças e histórico de evolução pedagógica/graduações; (c) faturamento, processamento de mensalidades, cobranças avulsas, liquidação e emissão de recibos; e (d) envio de avisos operacionais, lembretes de aula e notificações de cobrança.
                </p>
                <p>
                  <strong>1.3. Cláusula Pétrea de Não Comercialização e Não Desvio de Finalidade:</strong> É expressamente vedado à GestaraHub — e esta se obriga perante a Controladora a — <strong>não comercializar, não monetizar, não licenciar, não alugar, não ceder e não transferir</strong> a quaisquer terceiros os dados pessoais inseridos na plataforma pela Controladora, sendo terminantemente proibido o enriquecimento de bases, a veiculação de anúncios direcionados de terceiros ou o perfilamento comportamental e mercadológico de alunos e usuários.
                </p>
                <p>
                  <strong>1.4. Proteção e Consentimento de Crianças e Adolescentes (Artigo 14 da LGPD):</strong> Em estrita observância ao Artigo 14 da Lei nº 13.709/2018, caso a Controladora cadastre ou ministre atividades para alunos menores de 18 (dezoito) anos, esta declara e garante sob as penas da lei que colhe e mantém em seu poder o consentimento específico e em destaque dado por pelo menos um dos pais ou pelo responsável legal, ou ampara o respectivo tratamento em outra base legal expressamente admitida pelo ordenamento jurídico. A plataforma disponibiliza ferramentas integradas para coleta eletrônica e guarda probatória de autorizações de responsáveis.
                </p>
                <p>
                  <strong>1.5. Padrões de Segurança da Informação e Confidencialidade:</strong> A GestaraHub emprega e manterá ativas medidas técnicas, administrativas e operacionais de segurança da informação aptas a proteger os dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão (Art. 46 da LGPD), incluindo: criptografia em trânsito sob protocolos TLS 1.3 / HTTPS; senhas com dispersão criptográfica (hash seguro); isolamento lógico estrutural entre bases de dados de diferentes organizações (arquitetura <em>multi-tenant</em> estrita); e controle de privilégios de acesso baseado em perfis (RBAC).
                </p>
                <p>
                  <strong>1.6. Procedimento perante Incidentes de Segurança:</strong> Na hipótese de confirmação de incidente de segurança que possa acarretar risco ou dano relevante aos titulares de dados sob custódia da plataforma, a Operadora notificará formalmente a Controladora em prazo razoável, cooperando tecnicamente para que a Controladora cumpra suas obrigações de comunicação perante a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados.
                </p>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="border-b border-border/50 pb-2">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <Wallet className="size-4 text-primary" />
                  CLÁUSULA 2ª – DA INTERMEDIAÇÃO FINANCEIRA, PROCESSAMENTO E SUBCONTAS (BACEN / SPB)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regramento operacional e de conformidade aplicável aos módulos de cobranças online, Pix e split.
                </p>
              </div>

              <div className="space-y-3 text-foreground/90">
                <p>
                  <strong>2.1. Instituições de Pagamento Homologadas e Arranjo Regulatório:</strong> O processamento, conciliação e liquidação financeira de recebimentos via Pix (QR Code dinâmico e estático), boletos bancários registrados e cobranças recorrentes no cartão de crédito são realizados mediante integração sistêmica com instituições de pagamento homologadas, supervisionadas e autorizadas a funcionar pelo Banco Central do Brasil (BACEN), notadamente a <strong>Asaas Gestão Financeira IP S.A.</strong> (ou outros arranjos financeiros devidamente credenciados no Sistema de Pagamentos Brasileiro - SPB).
                </p>
                <p>
                  <strong>2.2. Outorga de Mandato para Operação de Subconta:</strong> Ao habilitar ou transacionar valores pelo módulo de cobranças online da GestaraHub, a Organização Contratante outorga mandato expresso à plataforma para, em seu nome e benefício: (a) solicitar a abertura, ativação, parametrização e gestão operacional de subconta de pagamento vinculada ao CNPJ ou CPF do estabelecimento; (b) emitir cobranças e requisições de liquidação financeira; e (c) comandar a transferência dos recursos líquidos recebidos diretamente para a conta bancária de mesma titularidade da Contratante, observados os prazos de compensação e liquidação do SPB.
                </p>
                <p>
                  <strong>2.3. Tarifas Operacionais, Retenção na Fonte e Split de Pagamentos:</strong> Toda transação financeira liquidada com sucesso está sujeita às tarifas públicas operacionais informadas previamente no painel de ativação (compostas pelos custos de processamento bancário da instituição financeira e, quando aplicável, pela taxa de serviço de intermediação tecnológica da plataforma). O Contratante autoriza expressamente a retenção automática dessas tarifas no ato da liquidação do recebimento (<em>split payment</em>), sendo o saldo líquido creditado em sua subconta.
                </p>
                <p>
                  <strong>2.4. Conformidade Regulatória, Prevenção a Fraudes e Verificação Cadastral (KYC/AML):</strong> Em observância à Lei nº 9.613/1998 e às circulares regulatórias do BACEN, o Contratante compromete-se a fornecer dados verídicos e documentações societárias que venham a ser exigidas para validação cadastral e prevenção à lavagem de dinheiro (<em>Know Your Customer</em>). Para abrir a conta de recebimento, são enviados à instituição parceira o nome ou razão social, CPF ou CNPJ, e-mail, celular, endereço, renda ou faturamento mensal e, para pessoa física, a data de nascimento. É terminantemente vedada a utilização do sistema para simulações financeiras, agiotagem, empréstimos, autofinanciamento por cartão de crédito ou qualquer movimentação sem lastro em serviços reais prestados pela organização.
                </p>
                <p>
                  <strong>2.5. Inexistência de Solidariedade Mercantil e Responsabilidade por Estornos (Chargebacks):</strong> A GestaraHub e seus parceiros bancários atuam exclusivamente na condição de intermediadores tecnológicos e processadores de pagamento, inexistindo qualquer solidariedade quanto ao conteúdo, qualidade, cumprimento ou cancelamento dos cursos, aulas ou serviços prestados pelo Contratante aos alunos finais. Toda e qualquer contestação de compra (<em>chargeback</em>), disputa, estorno ou pedido de cancelamento formalizado por aluno ou titular do meio de pagamento é de responsabilidade civil e financeira exclusiva do Contratante perante o pagador e os órgãos de proteção ao consumidor.
                </p>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="border-b border-border/50 pb-2">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <Scale className="size-4 text-primary" />
                  CLÁUSULA 3ª – DA TRILHA DE AUDITORIA, REGISTROS LEGAIS, RESCISÃO E FORO
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Eficácia probatória do consentimento eletrônico, prazos legais de guarda e encerramento de conta.
                </p>
              </div>

              <div className="space-y-3 text-foreground/90">
                <p>
                  <strong>3.1. Eficácia e Plena Validade Probatória do Consentimento Eletrônico:</strong> Nos termos do Art. 10 da Medida Provisória nº 2.200-2/2001 e do Art. 8º §2º da Lei nº 13.709/2018 (LGPD), as partes reconhecem como plenamente válida, eficaz, íntegra e exigível a manifestação de vontade expressa por meio eletrônico. Para assegurar a inquestionabilidade, autenticidade e fé probatória do aceite perante a ANPD, PROCON, Poder Judiciário e órgãos fiscalizadores, o ato de confirmação registra de modo indelével na trilha de auditoria:
                </p>
                <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1 font-mono">
                  <p className="text-foreground">I. Endereço IP público e porta lógica de conexão no momento do aceite;</p>
                  <p className="text-foreground">II. Identificador completo do navegador e dispositivo utilizado (User-Agent);</p>
                  <p className="text-foreground">III. Carimbo de tempo oficial sincronizado em Tempo Universal Coordenado (UTC);</p>
                  <p className="text-foreground">IV. Hash criptográfico seguro SHA-256 do documento formal aceito;</p>
                  <p className="text-foreground">V. Identificação cadastral unívoca do usuário e da respectiva organização.</p>
                </div>
                <p>
                  <strong>3.2. Dever de Guarda de Registros de Conexão e Acesso (Marco Civil da Internet):</strong> Em estrito cumprimento aos Artigos 10, 11 e 15 da Lei Federal nº 12.965/2014 (Marco Civil da Internet), a plataforma manterá arquivados em ambiente controlado e sob absoluto sigilo os registros de conexão e de acesso a aplicações pelo prazo legal mínimo de 6 (seis) meses, prestando-os exclusivamente mediante ordem judicial específica expedida por autoridade competente.
                </p>
                <p>
                  <strong>3.3. Garantia do Exercício dos Direitos dos Titulares de Dados (Art. 18 da LGPD):</strong> A plataforma disponibiliza recursos funcionais para que a Controladora possa atender prontamente às requisições formuladas pelos titulares de dados pessoais, compreendendo: (a) confirmação da existência de tratamento e acesso; (b) retificação e atualização cadastral; (c) anonimização, bloqueio ou eliminação de dados excessivos; e (d) portabilidade e exportação integral das bases de alunos e financeiro em formatos abertos e estruturados (CSV/JSON).
                </p>
                <p>
                  <strong>3.4. Rescisão sem Fidelidade, Portabilidade Cadastral e Expurgo Definitivo:</strong> É assegurado ao Contratante o direito potestativo de rescindir o contrato e encerrar a sua conta a qualquer momento, sem exigência de fidelidade mínima para planos mensais, mediante solicitação pelo e-mail de suporte (contato@gestarahub.com.br). Antes de formalizar o encerramento, incumbe ao Contratante realizar a exportação integral de seu acervo de dados. Decorridos os prazos legais de guarda documental e fiscal (de 6 meses a 5 anos nos termos do Código Civil e normas tributárias), os dados residuais serão definitiva e irreversivelmente expurgados ou anonimizados.
                </p>
                <p>
                  <strong>3.5. Legislação Aplicável e Eleição de Foro:</strong> O presente instrumento é regido e interpretado exclusivamente de acordo com as leis da República Federativa do Brasil. Para dirimir quaisquer litígios, controvérsias ou demandas decorrentes do uso da plataforma ou do tratamento de dados pessoais, as partes elegem de comum acordo o Foro da Comarca de domicílio da sede da plataforma GestaraHub, com expressa renúncia a qualquer outro foro, por mais privilegiado que seja.
                </p>
              </div>
            </div>
          )}

          {/* Alerta de transparência probatória */}
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="leading-relaxed">
              Ao confirmar, seu aceite eletrônico será auditado e arquivado nos
              termos dos Arts. 10 e 15 da Lei 12.965/2014 (Marco Civil) e do
              Art. 8º §2º da Lei 13.709/2018 (LGPD).
            </p>
          </div>
        </DialogBody>

        <div className="shrink-0 space-y-3 border-t border-border/40 p-4 sm:px-6">
          {/* Checkbox de aceite obrigatório */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-3">
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
                aria-invalid={hasError}
                className={cn("mt-0.5 shrink-0", hasError && "border-destructive")}
              />
              <Label
                htmlFor="terms-consent-checkbox"
                className="block flex-1 cursor-pointer select-none text-sm font-normal leading-relaxed text-foreground"
              >
                Li e aceito os{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Termos de Uso
                  <ExternalLink className="ml-0.5 inline size-3 align-baseline" />
                </Link>{" "}
                e a{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Política de Privacidade
                  <ExternalLink className="ml-0.5 inline size-3 align-baseline" />
                </Link>
                .
              </Label>
            </div>
            {hasError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="size-3.5 shrink-0" />
                Marque a caixa para aceitar os termos.
              </p>
            )}
          </div>

          <DialogFooter className="max-sm:p-0 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              disabled={isSigningOut || isSubmitting}
              className="gap-1.5"
            >
              {isSigningOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4 max-sm:hidden" />
              )}
              Recusar e sair
            </Button>

            <Button
              type="button"
              onClick={handleAccept}
              disabled={isSubmitting || isSigningOut}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 max-sm:hidden" />
                  Aceitar e continuar
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
