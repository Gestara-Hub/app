"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/config/site";
import { isAnalyticsConfigured, reviewAnalyticsConsent } from "@/lib/analytics";
import { LandingLegalPage, LegalSection } from "./landing-legal-page";

export function TermsOfUse() {
  return (
    <LandingLegalPage title="Termos de Uso e Condições Gerais">
      <LegalSection title="1. Apresentação e Objeto">
        <p>
          Estes Termos de Uso e Condições Gerais regulam o acesso e a utilização
          da plataforma <strong>GestaraHub</strong>, disponibilizada na modalidade
          Software como Serviço (SaaS), destinada à gestão operacional, acadêmica
          e financeira de escolas, estúdios, academias, centros de treinamento,
          espaços de ensino e instrutores autônomos (&ldquo;Contratante&rdquo; ou
          &ldquo;Você&rdquo;).
        </p>
        <p>
          A plataforma disponibiliza ferramentas para organização de turmas,
          controle de frequência/chamada, cadastro de clientes e alunos,
          agendamento de aulas e atendimentos, emissão e controle de
          mensalidades, cobranças avulsas, comunicação e emissão de certificados.
        </p>
        <p>
          <strong>Natureza de Meio:</strong> A GestaraHub é estritamente uma
          plataforma tecnológica de meio. A GestaraHub não é prestadora dos
          serviços educacionais ou esportivos contratados pelos seus alunos, não
          ministra aulas, não aufere receitas pedagógicas e não é responsável
          pelo cumprimento dos acordos comerciais ou de prestação de serviços
          firmados entre Você e seus clientes finais.
        </p>
      </LegalSection>

      <LegalSection title="2. Cadastro, Segurança e Responsabilidade da Conta">
        <ul>
          <li>
            <strong>Capacidade e Veracidade:</strong> Ao se cadastrar, Você
            declara possuir plena capacidade civil e prestar informações exatas,
            completas e verídicas sobre si e sobre a sua organização, obrigando-se
            a mantê-las permanentemente atualizadas.
          </li>
          <li>
            <strong>Sigilo das Credenciais:</strong> O acesso à conta é pessoal e
            intransferível. Você é integralmente responsável por manter a
            confidencialidade da sua senha e por todas as operações, lançamentos
            e comunicações realizados sob suas credenciais.
          </li>
          <li>
            <strong>Uso Autorizado de Colaboradores:</strong> Caso cadastre
            profissionais, professores, recepcionistas ou gestores na sua equipe,
            Você declara possuir autorização para conceder os respectivos perfis
            de acesso e responde pelas ações praticadas por seus prepostos no
            ambiente da plataforma.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Planos, Cobrança e Funcionalidades">
        <ul>
          <li>
            <strong>Plano Gratuito:</strong> A GestaraHub disponibiliza um plano
            gratuito sem limite de tempo e sem necessidade de cartão de crédito no
            momento do cadastro, contendo as ferramentas essenciais para gestão
            básica descritas na tabela de planos da plataforma.
          </li>
          <li>
            <strong>Planos Pagos e Módulos Opcionais:</strong> A contratação de
            planos superiores (ex.: planos Pro ou Scale) ou módulos opcionais
            (como automações de WhatsApp e relatórios avançados) é facultativa,
            com valores, limites e periodicidades de faturamento expressamente
            informados antes da contratação.
          </li>
          <li>
            <strong>Atualizações de Recursos:</strong> A GestaraHub poderá
            aprimorar, modificar, adicionar ou descontinuar funcionalidades da
            plataforma, sempre buscando a evolução do sistema e avisando os
            usuários previamente em caso de mudanças substanciais.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Módulo Financeiro, Pagamentos Online e Subcontas">
        <p>
          Ao habilitar recursos de recebimento online (Pix, boletos bancários ou
          cartão de crédito) e split de pagamentos:
        </p>
        <ul>
          <li>
            <strong>Instituição Parceira Homologada:</strong> Os pagamentos
            online são processados e liquidados por instituição de pagamento
            parceira autorizada e supervisionada pelo Banco Central do Brasil
            (BACEN), notadamente a <strong>Asaas Gestão Financeira IP S.A.</strong>
          </li>
          <li>
            <strong>Mandato de Intermediação e Subconta:</strong> Você autoriza a
            criação e operacionalização de uma subconta vinculada à sua
            organização, outorgando poderes à plataforma para emitir cobranças,
            gerar QR Codes Pix e registrar liquidações estritamente conforme as
            suas instruções.
          </li>
          <li>
            <strong>Tarifas e Retenções:</strong> O Contratante está ciente de
            que transações financeiras liquidadas via gateway estão sujeitas às
            tarifas por transação (taxa do gateway e taxa de intermediação da
            plataforma/split) detalhadas no momento da ativação da funcionalidade.
          </li>
          <li>
            <strong>Prevenção a Fraudes e Chargebacks:</strong> Você se
            compromete a não utilizar o módulo de pagamentos para operações
            simuladas, agiotagem, autofinanciamento ou atividades ilícitas. Em caso
            de contestação de compra (chargeback) ou cancelamento por parte do seu
            aluno, a responsabilidade civil e financeira é exclusiva do seu
            estabelecimento perante o aluno e o gateway de pagamento.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Tratamento de Dados e Conformidade LGPD">
        <p>
          O tratamento de dados pessoais realizado no âmbito da plataforma
          observa rigorosamente a Lei Geral de Proteção de Dados Pessoais (Lei nº
          13.709/2018 - LGPD) e rege-se pela nossa{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <p>
          <strong>Papéis LGPD:</strong> O Contratante é o{" "}
          <strong>Controlador</strong> dos dados pessoais dos seus alunos,
          responsáveis legais e professores. A GestaraHub é a{" "}
          <strong>Operadora de Tecnologia</strong>, tratando esses dados apenas em
          nome do Contratante e para a execução dos serviços contratados.
        </p>
        <p>
          <strong>Dados de Menores de Idade:</strong> O Contratante assume a
          obrigação de colher a autorização prévia de ao menos um dos pais ou
          responsável legal dos alunos menores de 18 anos cadastrados no sistema,
          em observância ao Artigo 14 da LGPD.
        </p>
      </LegalSection>

      <LegalSection title="6. Condutas Vedadas e Uso Aceitável">
        <p>É expressamente proibido ao Contratante e aos seus usuários:</p>
        <ul>
          <li>
            Utilizar a plataforma para veiculação de conteúdos ilícitos,
            ofensivos, discriminatórios ou que violem direitos de terceiros.
          </li>
          <li>
            Disparar mensagens de WhatsApp, e-mails ou cobranças em massa para
            destinatários que não possuam vínculo prévio com o estabelecimento ou
            que tenham solicitado o encerramento do contato (combate a spam).
          </li>
          <li>
            Praticar engenharia reversa, descompilar, copiar, clonar ou
            desenvolver produtos concorrentes baseados no código-fonte, layout ou
            arquitetura da GestaraHub.
          </li>
          <li>
            Burlar ou tentar violar mecanismos de autenticação, cotas de uso,
            taxas de rate-limiting ou barreiras de segurança do sistema.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Propriedade Intelectual">
        <p>
          Todos os direitos de propriedade intelectual relativos ao software
          GestaraHub, marcas, logotipos, telas, bancos de dados, algoritmos e
          documentação pertencem exclusivamente aos desenvolvedores e mantenedores
          da GestaraHub. A contratação confere apenas uma licença de uso revogável,
          não exclusiva e intransferível durante o período de vigência da conta.
        </p>
        <p>
          Por outro lado, todo o conteúdo e acervo de dados inserido pelo
          Contratante na plataforma (cadastros de alunos, turmas, valores e
          marcas da sua academia) permanece como propriedade exclusiva do
          Contratante.
        </p>
      </LegalSection>

      <LegalSection title="8. Nível de Serviço (SLA) e Disponibilidade">
        <p>
          A GestaraHub emprega práticas de ponta e infraestrutura em nuvem
          escalável para assegurar alta disponibilidade contínua (meta de SLA de
          99,5% do tempo no ar).
        </p>
        <p>
          Não configuram inadimplemento contratual pausas programadas para
          manutenção técnica preventiva (informadas previamente no painel ou por
          e-mail com antecedência razoável), interrupções de telecomunicações
          gerais da internet, falhas decorrentes do dispositivo do usuário ou
          instabilidades externas de gateways bancários (como o Sistema de
          Pagamentos Instantâneos - SPI/Bacen).
        </p>
      </LegalSection>

      <LegalSection title="9. Rescisão, Exportação e Encerramento de Conta">
        <p>
          <strong>Liberdade de Rescisão:</strong> O Contratante pode rescindir
          este contrato e encerrar a sua conta a qualquer momento, sem exigência
          de fidelidade contratual mínima para os planos mensais.
        </p>
        <p>
          <strong>Como Encerrar:</strong> O encerramento pode ser solicitado
          diretamente no painel de configurações do sistema (&ldquo;Configurações &gt;
          Encerrar Organização&rdquo;) ou pelo e-mail de suporte oficial.
        </p>
        <p>
          <strong>Exportação de Dados:</strong> Recomenda-se que o Contratante
          emita os relatórios e exportações cadastrais antes de formalizar o
          encerramento da conta.
        </p>
        <p>
          <strong>Prazos de Guarda Legal e Fiscal:</strong> Em atendimento ao
          Marco Civil da Internet (Lei nº 12.965/2014, Arts. 10 e 15) e à
          legislação tributária e civil brasileira, determinados registros de
          conexão, logs de auditoria e registros de transações financeiras serão
          mantidos arquivados pelos prazos prescricionais legais (de 6 meses a 5
          anos), após o que serão definitivamente expurgados ou anonimizados.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações dos Termos">
        <p>
          A GestaraHub poderá atualizar estes Termos periodicamente para refletir
          evoluções tecnológicas ou adequações regulatórias. Quando houver
          alterações relevantes, Você será notificado por meio de aviso na
          plataforma ou por e-mail, exigindo-se a ciência ou aceite antes do
          prosseguimento do uso.
        </p>
      </LegalSection>

      <LegalSection title="11. Legislação Aplicável e Foro">
        <p>
          Estes Termos são regidos e interpretados de acordo com a legislação da
          República Federativa do Brasil. Para dirimir quaisquer litígios
          decorrentes da utilização da plataforma, fica eleito o Foro da Comarca
          de domicílio da sede da plataforma GestaraHub, com renúncia expressa a
          qualquer outro, por mais privilegiado que seja.
        </p>
      </LegalSection>
    </LandingLegalPage>
  );
}

export function PrivacyPolicy() {
  return (
    <LandingLegalPage title="Política de Privacidade e Proteção de Dados">
      <LegalSection title="1. Compromisso com a Privacidade">
        <p>
          Esta Política de Privacidade descreve como a plataforma{" "}
          <strong>GestaraHub</strong> coleta, utiliza, armazena, protege e
          compartilha dados pessoais, em estrita conformidade com a Lei Geral de
          Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e com o Marco
          Civil da Internet (Lei nº 12.965/2014).
        </p>
      </LegalSection>

      <LegalSection title="2. Papéis e Agentes de Tratamento">
        <ul>
          <li>
            <strong>Controlador dos Dados dos Alunos e Alunas:</strong> A sua
            escola, academia ou espaço contratante é o <strong>Controlador</strong>{" "}
            dos dados pessoais que cadastra na plataforma (alunos, pais/mães,
            responsáveis financeiros e instrutores). É o seu espaço quem decide
            quais dados coletar, para quais modalidades e como cobrar.
          </li>
          <li>
            <strong>Operador Tecnológico:</strong> A GestaraHub atua como{" "}
            <strong>Operadora</strong>, processando os dados estritamente em nome
            do seu espaço e para viabilizar as funcionalidades do sistema
            (gestão de turmas, chamadas, cobranças e mensagens).
          </li>
          <li>
            <strong>Controlador dos Dados da Conta do Gestor:</strong> A
            GestaraHub atua como Controladora exclusivamente dos dados cadastrais
            do titular da conta (nome, e-mail de acesso e dados corporativos da
            empresa contratante).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Dados Coletados e Finalidades">
        <p>Tratamos as seguintes categorias de dados para finalidades específicas:</p>
        <ul>
          <li>
            <strong>Dados da Conta do Usuário Gestor:</strong> Nome completo,
            endereço de e-mail profissional, telefone e senha em formato com hash
            criptográfico seguro. <em>Finalidade:</em> autenticação na conta,
            segurança, suporte e envio de avisos operacionais da plataforma.
          </li>
          <li>
            <strong>Dados do Estabelecimento / Espaço:</strong> Nome comercial,
            endereço, horários de funcionamento, modalidades ofertadas, planos,
            valores e regras pedagógicas. <em>Finalidade:</em> parametrização do
            sistema.
          </li>
          <li>
            <strong>Dados dos Alunos e Responsáveis:</strong> Nome completo, CPF,
            data de nascimento, telefone de contato, histórico de presenças e
            registros de mensalidades/pagamentos. <em>Finalidade:</em> controle de
            matrícula, emissão de cobranças Pix/boleto/cartão e comunicação via
            WhatsApp.
          </li>
          <li>
            <strong>Dados de Conexão e Dispositivo:</strong> Endereço IP, data e
            hora de acesso em UTC e identificador de navegador (User-Agent).{" "}
            <em>Finalidade:</em> auditoria legal obrigatória nos termos dos Artigos
            10 e 15 do Marco Civil da Internet.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Dados de Crianças e Adolescentes (Art. 14 da LGPD)">
        <p>
          Nos casos em que o estabelecimento contratante atenda alunos menores de
          18 anos (como turmas infantis de artes marciais, dança, natação ou
          música), o estabelecimento compromete-se a coletar o consentimento
          específico e em destaque dado por pelo menos um dos pais ou pelo
          responsável legal.
        </p>
        <p>
          A GestaraHub trata esses dados estritamente para viabilizar o plano de
          aulas contratado pelos pais e a emissão das respectivas cobranças, sem
          jamais utilizar esses dados para perfilamento comercial ou
          publicidade.
        </p>
      </LegalSection>

      <LegalSection title="5. Não Comercialização e Compartilhamento Restrito">
        <p>
          <strong>Garantia de Não Comercialização:</strong> A GestaraHub{" "}
          <strong>nunca comercializa, aluga, cede ou monetiza</strong> seus dados
          pessoais ou os dados dos seus alunos para terceiros para fins de
          marketing direto, publicidade direcionada ou enriquecimento de bases.
        </p>
        <p>
          O compartilhamento ocorre unicamente com prestadores de serviços
          essenciais para o funcionamento da plataforma:
        </p>
        <ul>
          <li>
            <strong>Instituições Financeiras e Gateways:</strong> Compartilhamento
            com a Asaas Gestão Financeira IP S.A. para processamento, validação e
            liquidação de transações Pix, boletos e cartões de crédito.
          </li>
          <li>
            <strong>Infraestrutura em Nuvem:</strong> Servidores em nuvem de alta
            segurança para hospedagem da aplicação e banco de dados, protegidos
            por padrões internacionais de segurança da informação (ISO 27001 e
            SOC 2).
          </li>
          <li>
            <strong>Serviços de Comunicação:</strong> Provedores homologados de
            mensageria (Meta/WhatsApp Cloud API) para disparo de notificações e
            lembretes autorizados pelo usuário.
          </li>
          <li>
            <strong>Determinação Judicial ou Fiscal:</strong> Em caso de ordem
            judicial expressa ou requisição formal de autoridade pública
            competente, nos termos da legislação aplicável.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Análise de Uso e Telemetria">
        <p>
          Quando autorizado pelo usuário no banner de cookies, utilizamos a
          plataforma PostHog para aferir métricas de desempenho e entender como as
          funcionalidades são utilizadas no dia a dia.
        </p>
        <p>
          Para resguardar sua privacidade, todo texto confidencial (como nomes de
          alunos e valores) é ocultado nas gravações de sessão, e informações
          confidenciais de digitação nunca são coletadas. Esses dados são
          utilizados unicamente para aprimoramento da interface e correção de
          erros.
        </p>
      </LegalSection>

      <LegalSection title="7. Uso de Cookies">
        <p>A plataforma utiliza as seguintes categorias de cookies:</p>
        <ul>
          <li>
            <strong>Cookies Estritamente Necessários:</strong> Indispensáveis
            para manter a sua sessão autenticada com segurança no navegador e
            impedir ataques de falsificação de requisições.
          </li>
          <li>
            <strong>Cookies de Preferências:</strong> Guardam escolhas locais da
            interface, como a preferência de tema (claro/escuro) ou o modo de
            visualização de listas.
          </li>
          <li>
            <strong>Cookies Analíticos:</strong> Opcionais, ativados apenas se Você
            autorizar expressamente no aviso de cookies.
          </li>
        </ul>
        {isAnalyticsConfigured ? (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reviewAnalyticsConsent}
              className="text-xs"
            >
              Rever minha escolha de cookies
            </Button>
          </div>
        ) : null}
      </LegalSection>

      <LegalSection title="8. Segurança da Informação">
        <p>
          Adotamos medidas técnicas, administrativas e organizacionais para
          proteger seus dados contra acessos não autorizados, perda, destruição
          ou vazamentos:
        </p>
        <ul>
          <li>Tráfego 100% criptografado de ponta a ponta mediante HTTPS/TLS.</li>
          <li>Senhas armazenadas com algoritmos de hash criptográfico de última geração.</li>
          <li>Isolamento lógico rigoroso multi-tenant entre diferentes organizações.</li>
          <li>Controles de permissões baseados em papéis (RBAC).</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Direitos dos Titulares de Dados (Artigo 18 da LGPD)">
        <p>
          Na condição de titular de dados pessoais, Você ou seus alunos podem a
          qualquer momento solicitar:
        </p>
        <ul>
          <li>Confirmação da existência de tratamento e acesso aos dados.</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
          <li>
            Anonimização, bloqueio ou eliminação de dados desnecessários ou
            excessivos.
          </li>
          <li>Portabilidade dos dados para outro fornecedor de serviços.</li>
          <li>Eliminação dos dados tratados com consentimento.</li>
          <li>Informação sobre as entidades com as quais os dados foram compartilhados.</li>
        </ul>
        <p>
          Como a GestaraHub atua como Operadora no tocante aos alunos, pedidos de
          alunos devem ser direcionados prioritariamente ao próprio espaço
          educacional/academia (Controlador), prestando a GestaraHub o suporte
          técnico necessário para viabilizar a requisição.
        </p>
      </LegalSection>

      <LegalSection title="10. Prazos de Retenção e Descarte">
        <p>
          Os dados permanecem armazenados enquanto durar a sua conta na
          plataforma. Após o encerramento da conta, os dados serão excluídos ou
          anonimizados, ressalvadas as hipóteses legais de conservação para:
        </p>
        <ul>
          <li>
            Cumprimento de obrigação legal ou regulatória (ex.: guarda de logs de
            acesso por 6 meses conforme o Marco Civil da Internet; documentos
            fiscais por 5 anos conforme o Código Tributário Nacional).
          </li>
          <li>
            Exercício regular de direitos em processo judicial, administrativo ou
            arbitral.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="11. Canal de Contato do Encarregado (DPO)">
        <p>
          Para exercer seus direitos de privacidade, tirar dúvidas ou apresentar
          requisições sobre o tratamento de dados pessoais, entre em contato com
          nosso Encarregado pelo e-mail{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LandingLegalPage>
  );
}
