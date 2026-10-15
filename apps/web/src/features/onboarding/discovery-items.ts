import type {
  ClassBillingMode,
  DiscoveryMilestones,
  Permission,
} from "@gestarahub/contracts";

export type DiscoveryItemId =
  | "enroll"
  | "attendance"
  | "membership_payment"
  | "course_installments"
  | "package_sale"
  | "message"
  | "progress"
  | "finance";

export interface DiscoveryItem {
  id: DiscoveryItemId;
  title: string;
  hint: string;
  href: string;
  done: boolean;
  /** O que falta antes (ex.: "matrícula"); presente = bloqueado, sem link. */
  requires?: string;
}

export interface DiscoveryInput {
  milestones: DiscoveryMilestones;
  /** Telas ja abertas por este usuario (marcas do navegador). */
  visited: { courseBilling: boolean; finance: boolean };
  /** Forma de cobranca padrao da area (`useBusinessSegment().defaultBillingMode`). */
  areaBillingMode: ClassBillingMode;
  /** Permissao do usuario: itens sem acesso ficam de fora. */
  can: (permission: Permission) => boolean;
}

interface Candidate extends DiscoveryItem {
  permission: Permission;
}

/** Item do dinheiro pela forma de cobranca da area; sem cobranca, nenhum. */
function moneyItem(input: DiscoveryInput): Candidate | null {
  const { milestones, visited } = input;
  switch (input.areaBillingMode) {
    case "membership":
      return {
        id: "membership_payment",
        title: "Registrar um pagamento",
        hint: "Marque pago em Cobranças.",
        href: "/classes/billing",
        done: milestones.hasPaidCharge,
        permission: "billing:manage",
      };
    case "course":
      return {
        id: "course_installments",
        title: "Ver as parcelas do curso",
        hint: "E emitir o certificado ao terminar.",
        href: "/classes/billing?kind=course",
        done: visited.courseBilling || milestones.hasPaidCourseInstallment,
        permission: "billing:view",
      };
    case "package":
      return {
        id: "package_sale",
        title: "Vender um pacote de aulas",
        hint: "O saldo aparece na chamada.",
        // A venda fica no menu do aluno ("Vender pacote").
        href: "/clients",
        done: milestones.hasPackageSale,
        permission: "billing:manage",
      };
    case "free":
    default:
      return null;
  }
}

/**
 * Itens do card "Descubra o dia a dia" (Dashboard, depois da configuracao
 * inicial, modelo de turmas). Cada item se marca sozinho pelo dado real (ou
 * pela tela aberta, quando a acao e so olhar). A chamada so libera depois da
 * primeira matricula. Itens sem permissao do usuario ficam de fora.
 */
export function buildDiscoveryItems(input: DiscoveryInput): DiscoveryItem[] {
  const { milestones, visited, areaBillingMode } = input;
  const isCourseArea = areaBillingMode === "course";

  const candidates: (Candidate | null)[] = [
    {
      id: "enroll",
      title: isCourseArea ? "Matricular alunos no curso" : "Matricular alunos na turma",
      hint: "Quem já frequenta, em poucos cliques.",
      href: milestones.enrollClassGroupId
        ? `/classes/${milestones.enrollClassGroupId}?enroll=true`
        : "/classes",
      done: milestones.hasEnrollment,
      permission: "enrollment:manage",
    },
    {
      id: "attendance",
      title: "Fazer a primeira chamada",
      hint: "Presença em um toque, no celular.",
      href: "/classes/calendar",
      done: milestones.hasAttendance,
      // Sem matricula a chamada fica vazia: libera so depois dela.
      requires: milestones.hasEnrollment || milestones.hasAttendance ? undefined : "matrícula",
      permission: "attendance:mark",
    },
    moneyItem(input),
    {
      id: "message",
      title: "Mandar um lembrete no WhatsApp",
      hint: "Mensagem pronta, sai do seu número.",
      href: "/communication",
      done: milestones.hasMessage,
      permission: "communication:view",
    },
    {
      id: "progress",
      title: "Registrar a evolução de um aluno",
      hint: "Registro de aula, meta ou graduação.",
      href: "/clients",
      done: milestones.hasProgressRecord,
      permission: "clients:manage",
    },
    {
      id: "finance",
      title: "Ver o resultado do mês",
      hint: "O que entrou, saiu e falta.",
      href: "/finance",
      done: visited.finance,
      permission: "finance:view",
    },
  ];

  return candidates
    .filter((item): item is Candidate => item !== null && input.can(item.permission))
    .map(({ id, title, hint, href, done, requires }) =>
      requires ? { id, title, hint, href, done, requires } : { id, title, hint, href, done },
    );
}

/** Progresso do card: feitos, total e se acabou (some sozinho). */
export function summarizeDiscovery(items: DiscoveryItem[]) {
  const doneCount = items.filter((item) => item.done).length;
  return {
    doneCount,
    total: items.length,
    allDone: items.length > 0 && doneCount === items.length,
  };
}
