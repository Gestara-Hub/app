"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  COMPANY_ADDRESS,
  COMPANY_CNPJ,
  COMPANY_NAME,
  LEGAL_FORUM,
  LEGAL_UPDATED_AT,
  SUPPORT_EMAIL,
} from "@/config/site";
import { isAnalyticsConfigured, reviewAnalyticsConsent } from "@/lib/analytics";
import { LandingLegalPage, LegalSection } from "./landing-legal-page";

/** Historico das versoes dos dois textos (T9 da revisao juridica, doc product/27). */
function LegalChangelog() {
  return (
    <LegalSection title="Histórico de versões">
      <ul>
        <li>
          <strong>v1.1 ({LEGAL_UPDATED_AT}):</strong> identificação da empresa titular (razão social,
          CNPJ, endereço e foro), direito de arrependimento e regras do plano anual, comunicação de
          incidentes de segurança, entrada com Google, lista dos fornecedores que tratam dados, como
          pedir a exclusão de dados e o encarregado.
        </li>
        <li>
          <strong>v1.0 (22/10/2026):</strong> primeira versão publicada.
        </li>
      </ul>
    </LegalSection>
  );
}

export function TermsOfUse() {
  return (
    <LandingLegalPage title="Termos de Uso e Condições Gerais">
      <LegalSection title="1. Apresentação, Partes e Objeto">
        <p>
          Estes Termos de Uso e Condições Gerais regulam o acesso e a utilização
          da plataforma <strong>GestaraHub</strong>, de titularidade de{" "}
          <strong>{COMPANY_NAME}</strong>, inscrita no CNPJ sob o nº{" "}
          {COMPANY_CNPJ}, com sede em {COMPANY_ADDRESS} (&ldquo;GestaraHub&rdquo; ou
          &ldquo;Nós&rdquo;), disponibilizada na modalidade Software como Serviço
          (SaaS) e destinada à gestão operacional, acadêmica e financeira de
          escolas, estúdios, academias, centros de treinamento, espaços de ensino
          e instrutores autônomos (&ldquo;Contratante&rdquo; ou &ldquo;Você&rdquo;).
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
        <p>
          <strong>Canal de atendimento:</strong> {SUPPORT_EMAIL}.
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
            planos superiores (ex.: planos Profissional ou Expansão) ou módulos opcionais
            (como automações de WhatsApp e relatórios avançados) é facultativa,
            com valores, limites e periodicidades de faturamento expressamente
            informados antes da contratação.
          </li>
          <li>
            <strong>Direito de Arrependimento:</strong> Nos termos do artigo 49
            do Código de Defesa do Consumidor, Você pode desistir da contratação
            de um plano pago em até 7 (sete) dias corridos a partir do primeiro
            pagamento, com devolução integral do valor pago, bastando solicitar
            pelo canal de atendimento ou pela própria plataforma.
          </li>
          <li>
            <strong>Cancelamento depois dos 7 dias:</strong> O plano mensal pode
            ser cancelado a qualquer momento, sem multa, e os recursos pagos
            permanecem disponíveis até o fim do período já pago, sem devolução
            proporcional. O plano anual permanece ativo até o fim do ano pago e
            não é devolvido proporcionalmente; ao fim do período, não é renovado.
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
            suas instruções. A conta é aberta em seu nome junto à instituição
            parceira, que lhe envia a comunicação de ativação, colhe o aceite dos
            termos dela e a documentação exigida pela regulação.
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
          <li>
            <strong>Dados para Abrir a Conta de Recebimento:</strong> Para
            ativar o recebimento online, Você informa dados verídicos do titular
            (nome ou razão social, CPF ou CNPJ, e-mail, celular, endereço, renda
            ou faturamento mensal e, para pessoa física, a data de nascimento),
            enviados à instituição parceira para abertura e validação da conta.
          </li>
          <li>
            <strong>CPF de Quem Paga:</strong> A instituição parceira exige o
            CPF de quem paga cada cobrança online: o do aluno, quando maior de
            idade, ou o do responsável financeiro, quando menor. Cabe a Você
            cadastrar esse dado e informar ao aluno ou responsável que nome,
            CPF, e-mail, telefone e endereço seguem para a instituição parceira
            para emitir a cobrança.
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
          <strong>Instruções do Controlador à Operadora:</strong> a GestaraHub
          trata os dados dos seus alunos somente para as finalidades das
          funcionalidades contratadas (turmas, chamada, cobrança, comunicação,
          certificados e relatórios), com sigilo, usando apenas os fornecedores
          listados na Política de Privacidade, sem compartilhá-los com terceiros
          para outros fins, e os exclui ou anonimiza ao encerramento da conta,
          ressalvadas as guardas legais. A GestaraHub presta o apoio técnico
          necessário para Você atender aos pedidos dos titulares.
        </p>
        <p>
          <strong>Dados de Menores de Idade:</strong> O Contratante assume a
          obrigação de colher a autorização prévia de ao menos um dos pais ou
          responsável legal dos alunos menores de 18 anos cadastrados no sistema,
          em observância ao Artigo 14 da LGPD.
        </p>
        <p>
          <strong>Mensagens de WhatsApp:</strong> O envio de mensagens aos
          alunos e responsáveis pelo WhatsApp depende de autorização prévia deles
          ao Contratante, que responde pela coleta e pela guarda dessa autorização
          e por interromper o envio quando o destinatário pedir.
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
          documentação pertencem exclusivamente à {COMPANY_NAME}. A contratação
          confere apenas uma licença de uso revogável, não exclusiva e
          intransferível durante o período de vigência da conta.
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
          escalável para manter a plataforma disponível de forma contínua.
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
          pelo e-mail de suporte oficial ({SUPPORT_EMAIL}). Respondemos em até 15
          dias úteis com a confirmação e os prazos de exclusão.
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
          prosseguimento do uso. O histórico das versões fica no fim desta página.
        </p>
      </LegalSection>

      <LegalSection title="11. Legislação Aplicável e Foro">
        <p>
          Estes Termos são regidos e interpretados de acordo com a legislação da
          República Federativa do Brasil. Para dirimir quaisquer litígios
          decorrentes da utilização da plataforma, fica eleito o Foro da{" "}
          {LEGAL_FORUM}, com renúncia expressa a qualquer outro, por mais
          privilegiado que seja, ressalvadas as hipóteses em que a lei garanta
          ao consumidor o foro do seu domicílio.
        </p>
      </LegalSection>

      <LegalChangelog />
    </LandingLegalPage>
  );
}

export function PrivacyPolicy() {
  return (
    <LandingLegalPage title="Política de Privacidade e Proteção de Dados">
      <LegalSection title="1. Compromisso com a Privacidade">
        <p>
          Esta Política de Privacidade descreve como a plataforma{" "}
          <strong>GestaraHub</strong>, de titularidade de{" "}
          <strong>{COMPANY_NAME}</strong> (CNPJ {COMPANY_CNPJ}, {COMPANY_ADDRESS}),
          coleta, utiliza, armazena, protege e compartilha dados pessoais, em
          estrita conformidade com a Lei Geral de Proteção de Dados Pessoais
          (Lei nº 13.709/2018 - LGPD) e com o Marco Civil da Internet (Lei nº
          12.965/2014).
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
            <strong>Controlador dos Dados da Conta do Gestor:</strong> A{" "}
            {COMPANY_NAME} atua como Controladora exclusivamente dos dados
            cadastrais do titular da conta (nome, e-mail de acesso e dados
            corporativos da empresa contratante).
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
            <strong>Entrada com Google:</strong> Se Você escolher entrar com a
            sua conta Google, recebemos do Google apenas nome, e-mail e foto do
            perfil, usados só para criar e autenticar a sua conta. Não acessamos
            seus contatos, arquivos ou agenda.
          </li>
          <li>
            <strong>Dados do Estabelecimento / Espaço:</strong> Nome comercial,
            endereço, horários de funcionamento, modalidades ofertadas, planos,
            valores e regras pedagógicas. <em>Finalidade:</em> parametrização do
            sistema.
          </li>
          <li>
            <strong>Dados dos Alunos e Responsáveis:</strong> Nome completo, CPF,
            data de nascimento, telefone de contato, e-mail, endereço, histórico de
            presenças e registros de mensalidades/pagamentos. O CPF identifica quem
            paga a cobrança online: o próprio aluno, quando maior de idade, ou o
            responsável financeiro, quando menor. <em>Finalidade:</em> controle de
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
          O compartilhamento ocorre unicamente com os fornecedores a seguir,
          essenciais para o funcionamento da plataforma (suboperadores):
        </p>
        <ul>
          <li>
            <strong>Instituição de pagamento:</strong> Asaas Gestão Financeira IP
            S.A., para processamento, validação e liquidação de transações Pix,
            boletos e cartões de crédito. Somente quando o espaço gera uma
            cobrança online, seguem os dados de quem paga (nome, CPF, e-mail,
            telefone e endereço), exigidos pela instituição para emitir a
            cobrança e prevenir fraudes.
          </li>
          <li>
            <strong>Banco de dados e arquivos:</strong> Supabase, que hospeda o
            banco de dados e os anexos da plataforma, com criptografia em
            repouso e em trânsito.
          </li>
          <li>
            <strong>Aplicação:</strong> Vercel, que hospeda e entrega o sistema
            no navegador.
          </li>
          <li>
            <strong>Mensagens:</strong> Meta Platforms (WhatsApp Cloud API) para
            as notificações e lembretes autorizados pelo destinatário, e
            MailerSend para o e-mail transacional (links de cadastro, convites,
            troca de senha e boas-vindas), com nome e e-mail do destinatário.
          </li>
          <li>
            <strong>Análise de uso:</strong> PostHog, somente quando autorizado
            no aviso de cookies (seção 6).
          </li>
          <li>
            <strong>Determinação Judicial ou Fiscal:</strong> Em caso de ordem
            judicial expressa ou requisição formal de autoridade pública
            competente, nos termos da legislação aplicável.
          </li>
        </ul>
        <p>
          <strong>Transferência internacional:</strong> alguns desses fornecedores
          podem processar dados em servidores fora do Brasil (Estados Unidos ou
          União Europeia). Nesses casos a transferência segue o artigo 33 da
          LGPD, com as cláusulas contratuais e certificações de segurança dos
          próprios fornecedores.
        </p>
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
              onClick={reviewAnalyticsConsent}
              className="text-xs"
            >
              Rever minha escolha de cookies
            </Button>
          </div>
        ) : null}
      </LegalSection>

      <LegalSection title="8. Segurança da Informação e Incidentes">
        <p>
          Adotamos medidas técnicas, administrativas e organizacionais para
          proteger seus dados contra acessos não autorizados, perda, destruição
          ou vazamentos:
        </p>
        <ul>
          <li>Tráfego 100% criptografado de ponta a ponta mediante HTTPS/TLS.</li>
          <li>Senhas armazenadas com algoritmos de hash criptográfico de última geração.</li>
          <li>Isolamento lógico rigoroso multi-tenant entre diferentes organizações.</li>
          <li>Controles de permissões baseados em papéis (RBAC) e verificação em duas etapas.</li>
        </ul>
        <p>
          <strong>Comunicação de incidentes (Art. 48 da LGPD):</strong> se um
          incidente de segurança puder causar risco ou dano relevante aos
          titulares, comunicamos o espaço contratante (Controlador) sem demora
          injustificada, em regra em até 72 horas após tomarmos conhecimento,
          com a descrição dos dados afetados, as medidas adotadas e as
          recomendações, para que ele possa avisar os titulares e a Autoridade
          Nacional de Proteção de Dados quando for o caso.
        </p>
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

      <section id="exclusao" className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-bold text-foreground">10. Como pedir a exclusão dos seus dados</h2>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          <ul>
            <li>
              <strong>Titular da conta (gestor):</strong> envie um e-mail para{" "}
              {SUPPORT_EMAIL} a partir do e-mail cadastrado, com o assunto
              &ldquo;Exclusão de conta&rdquo;. Confirmamos em até 15 dias úteis e
              excluímos ou anonimizamos os dados, ressalvadas as guardas legais da
              seção 11. O mesmo vale para quem entrou com Google: a exclusão da
              conta no GestaraHub apaga os dados recebidos do Google.
            </li>
            <li>
              <strong>Aluno ou responsável:</strong> peça ao espaço em que está
              matriculado (o Controlador), que usa as ferramentas da plataforma
              para inativar ou excluir o cadastro. Se não conseguir contato com o
              espaço, escreva para {SUPPORT_EMAIL} e encaminhamos o pedido.
            </li>
            <li>
              <strong>Mensagens de WhatsApp:</strong> responda &ldquo;SAIR&rdquo; a
              qualquer mensagem ou peça ao espaço para parar o envio.
            </li>
          </ul>
        </div>
      </section>

      <LegalSection title="11. Prazos de Retenção e Descarte">
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

      <LegalSection title="12. Encarregado pelo Tratamento de Dados (DPO)">
        <p>
          A {COMPANY_NAME} é a encarregada pelo tratamento de dados pessoais da
          plataforma. Para exercer seus direitos, tirar dúvidas ou apresentar
          requisições sobre o tratamento de dados pessoais, escreva para{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          ou para o endereço {COMPANY_ADDRESS}.
        </p>
      </LegalSection>

      <LegalChangelog />
    </LandingLegalPage>
  );
}
