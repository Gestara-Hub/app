"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAnalyticsConfigured, reviewAnalyticsConsent } from "@/lib/analytics";
import { LandingLegalPage, LegalSection } from "./landing-legal-page";

// Primeira versao dos textos (17/10/2026). Revisar com apoio juridico antes de
// abrir o cadastro de verdade (doc 08, secao 3.8).

export function TermsOfUse() {
  return (
    <LandingLegalPage title="Termos de uso">
      <LegalSection title="O serviço">
        <p>
          O GestaraHub é um sistema para quem ensina organizar turmas, aulas particulares, alunos,
          cobranças e comunicação.
        </p>
      </LegalSection>
      <LegalSection title="Sua conta">
        <ul>
          <li>Informe dados verdadeiros no cadastro.</li>
          <li>Você responde pelo acesso à conta e pelo que é feito nela.</li>
          <li>Você pode encerrar a conta quando quiser.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Planos">
        <ul>
          <li>O plano grátis não tem prazo nem limite de alunos.</li>
          <li>Recursos pagos são opcionais. O valor aparece antes de você ativar.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Seus dados">
        <p>
          O que você cadastra é seu. O tratamento dos dados segue a{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
            Política de privacidade
          </Link>
          .
        </p>
      </LegalSection>
      <LegalSection title="Uso permitido">
        <ul>
          <li>Não use o sistema para atividades ilegais.</li>
          <li>Não envie mensagens a quem não autorizou o contato.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Disponibilidade">
        <p>Trabalhamos para manter o sistema no ar, mas pode haver pausas para manutenção.</p>
      </LegalSection>
      <LegalSection title="Mudanças nos termos">
        <p>Se estes termos mudarem, avisamos no sistema antes de valer.</p>
      </LegalSection>
    </LandingLegalPage>
  );
}

export function PrivacyPolicy() {
  return (
    <LandingLegalPage title="Política de privacidade">
      <LegalSection title="Dados que tratamos">
        <ul>
          <li>Da sua conta: nome e e-mail, informados no cadastro.</li>
          <li>Do seu espaço: nome, endereço, horários, modalidades, turmas e valores.</li>
          <li>
            Dos seus alunos e professores: o que você cadastra, como nome, telefone, data de
            nascimento, presenças e pagamentos.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="Para que usamos">
        <ul>
          <li>Para o sistema funcionar: entrar, organizar turmas, chamada, cobranças e mensagens.</li>
          <li>Para falar com você sobre a sua conta.</li>
          <li>Não vendemos seus dados nem os dos seus alunos.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Dados dos alunos">
        <p>
          Pela LGPD, o seu espaço é o controlador dos dados dos alunos e professores que cadastra. O
          GestaraHub é o operador: guarda e processa esses dados só para você usar o sistema.
        </p>
      </LegalSection>
      <LegalSection title="Compartilhamento">
        <p>
          Só com serviços necessários para o sistema funcionar, como a hospedagem e a análise de
          uso (abaixo). Com o provedor de pagamento e com o WhatsApp, só quando você liga esses
          recursos.
        </p>
      </LegalSection>
      <LegalSection title="Análise de uso">
        <p>
          Se você aceitar no aviso de cookies, usamos o PostHog para entender como o sistema é
          usado: páginas visitadas, cliques e gravações das sessões. O que você digita nunca é gravado
          e, dentro do sistema, os textos ficam ocultos nas gravações. Esses dados ficam nos
          servidores do PostHog, fora do Brasil.
        </p>
      </LegalSection>
      <LegalSection title="Cookies">
        <p>
          Usamos um cookie para manter você conectado e guardamos preferências no navegador, como o
          tema. Os cookies de análise de uso só ligam se você aceitar no aviso. Não usamos cookies de
          publicidade.
        </p>
        {isAnalyticsConfigured ? (
          <Button variant="outline" onClick={reviewAnalyticsConsent}>
            Rever minha escolha de cookies
          </Button>
        ) : null}
      </LegalSection>
      <LegalSection title="Seus direitos">
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados e encerrar a conta quando
          quiser.
        </p>
      </LegalSection>
      <LegalSection title="Mudanças nesta política">
        <p>Se esta política mudar, avisamos no sistema antes de valer.</p>
      </LegalSection>
    </LandingLegalPage>
  );
}
