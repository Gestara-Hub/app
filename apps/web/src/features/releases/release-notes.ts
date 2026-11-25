/**
 * Novidades do GestaraHub para quem usa (doc technical/27). Uma entrada por
 * versao, a mais nova primeiro. Texto curto, sem termo tecnico, 3 a 6 itens.
 * O agente redige a partir das mudancas da versao e o dono aprova antes do
 * deploy; `pnpm release:prepare` avisa se a versao nova ainda nao tem entrada.
 */
export interface ReleaseNoteItem {
  text: string;
}

export interface ReleaseNote {
  /** Mesma versao do `package.json` (ex.: "2026.11.10"). */
  version: string;
  /** Dia da versao, "yyyy-MM-dd". */
  date: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "2026.11.25-6",
    date: "2026-11-25",
    items: [
      { text: "Boas-vindas e tours não voltam em outro aparelho." },
      { text: "Recebimentos online abre com a situação do Asaas já carregada." },
      { text: "Botão Já criei a senha na conta de recebimento." },
      { text: "Cobrança da turma travada depois da primeira matrícula." },
      { text: "Duplicar turma para criar outra com os mesmos dados." },
      { text: "Turma com alunos ativos não pode ser inativada." },
    ],
  },
  {
    version: "2026.11.25-5",
    date: "2026-11-25",
    items: [
      { text: "Situação da sua conta de recebimento no Asaas, com o que falta." },
      { text: "Botões para criar a senha e enviar os documentos no Asaas." },
      { text: "Aviso por e-mail quando o Asaas aprovar a conta." },
      { text: "Pix com aviso claro enquanto o Asaas analisa a conta." },
      { text: "Estornos e contestações de alunos avisados no app." },
    ],
  },
  {
    version: "2026.11.25-4",
    date: "2026-11-25",
    items: [
      { text: "App instalado abre com a logo enquanto o Painel carrega." },
      { text: "Aviso de nova versão ao voltar para o app, com botão Atualizar." },
    ],
  },
  {
    version: "2026.11.25-3",
    date: "2026-11-25",
    items: [
      { text: "Ativar recebimentos espera o Asaas abrir a conta, até 2 minutos." },
      { text: "Passos de acesso ao Asaas citam o e-mail e o prazo do link." },
    ],
  },
  {
    version: "2026.11.25-2",
    date: "2026-11-25",
    items: [
      { text: "Termos de uso e privacidade no menu da sua conta." },
      { text: "Mensagens da Comunicação em lista, com ícone para cada aviso." },
      { text: "Prazo e horário dos avisos só com o WhatsApp oficial." },
      { text: "Configurações mais organizadas, com fuso horário mais claro." },
      { text: "Celular sem o 9 é recusado no cadastro." },
    ],
  },
  {
    version: "2026.11.25",
    date: "2026-11-25",
    items: [
      { text: "Nota fiscal do plano chega por e-mail, com o PDF." },
      { text: "Cancelamento com devolução em até 7 dias, pelo suporte." },
      { text: "Voltar ao Grátis explica que o período pago continua." },
    ],
  },
  {
    version: "2026.11.24",
    date: "2026-11-24",
    items: [
      { text: "Termos de uso e privacidade atualizados, versão 1.3." },
      { text: "Privacidade explica os dados do WhatsApp e como apagá-los." },
      { text: "Termos com o custo das mensagens e o estorno do plano." },
    ],
  },
  {
    version: "2026.11.22",
    date: "2026-11-22",
    items: [
      { text: "Nota fiscal de cada pagamento do plano, em Configurações > Plano." },
      { text: "Aviso da próxima fatura do plano só perto do vencimento." },
      { text: "Avisos de cobrança no WhatsApp aceitos com nomes longos." },
    ],
  },
  {
    version: "2026.11.19",
    date: "2026-11-19",
    items: [
      { text: "Plano no Pix com débito automático e e-mails do plano com a cara do GestaraHub." },
      { text: "Passo a passo para entrar na sua conta de recebimento no Asaas." },
      { text: "Saque via Pix protegido contra pedido em dobro." },
      { text: "Telas mais rápidas: avisos e limpezas rodam em segundo plano." },
      { text: "Lembretes do WhatsApp esperam a aprovação e tentam de novo se a Meta falhar." },
      { text: "Espaço novo já vem no fuso horário de onde você está." },
    ],
  },
  {
    version: "2026.11.18",
    date: "2026-11-18",
    items: [
      { text: "WhatsApp automático pelo número do seu espaço, no Profissional." },
      { text: "Situação do seu WhatsApp na Meta, com aviso de pagamento." },
      { text: "Lembretes de cobrança com botão Pagar agora no WhatsApp." },
      { text: "Endereço de cobrança no checkout do plano." },
      { text: "No celular, arrastar da borda esquerda abre o menu." },
      { text: "Novidades mostram o número de cada versão." },
    ],
  },
  {
    version: "2026.11.16-2",
    date: "2026-11-16",
    items: [
      { text: "Barra no topo mostra quando uma tela ou painel está carregando." },
      { text: "Formulários indicam o salvamento e evitam fechar por engano no meio." },
      { text: "Horários cabem melhor no celular e salvamentos simultâneos estão mais estáveis." },
    ],
  },
  {
    version: "2026.11.16",
    date: "2026-11-16",
    items: [
      { text: "Inscrição pública em eventos por link, com ingresso e QR code." },
      { text: "Evento de graduação, graduação em grupo e mudança de turma." },
      { text: "Chamada com botão Salvar e rascunho guardado no aparelho." },
      { text: "Selo Em atraso e filtro Visitante na lista de alunos." },
      { text: "Cores das modalidades no calendário e tela própria de Certificados." },
      { text: "Resumo financeiro mais claro, com filtro direto pelos cards." },
    ],
  },
  {
    version: "2026.11.10",
    date: "2026-11-10",
    items: [
      { text: "Eventos e seminários com inscrição, chamada e certificado." },
      { text: "Mais de um instrutor por evento, escolhido por dia." },
      { text: "Escolha o som da chamada em Preferências." },
      { text: "Menu ⋮ das listas mais curto, com Acompanhamento." },
      { text: "Formulários de turma e evento organizados em partes." },
      { text: "Ao salvar, o cursor vai para o campo que falta." },
    ],
  },
];

/** Versao mais nova com novidades (o ponto no menu compara com esta). */
export const LATEST_RELEASE_VERSION: string | undefined = RELEASE_NOTES[0]?.version;
