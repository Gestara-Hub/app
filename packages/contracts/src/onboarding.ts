import type { ClassBillingMode } from "./class";
import type { Id, RecordStatus } from "./common";

/**
 * Marcos do dia a dia do espaco (card "Descubra o dia a dia" do Dashboard,
 * depois da configuracao inicial). So booleanos: o que ja aconteceu pelo menos
 * uma vez no tenant. Lido do dado real (nada manual); o que depende de "abrir
 * a tela" fica no navegador (ver `lib/discovery-flags`).
 */
export interface DiscoveryMilestones {
  /** Alguma turma com matricula ativa. */
  hasEnrollment: boolean;
  /** Primeira turma ativa (destino do "matricular"); ausente sem turma ativa. */
  enrollClassGroupId?: Id;
  /** Alguma presenca marcada na chamada (presente, falta ou justificada). */
  hasAttendance: boolean;
  /** Alguma cobranca paga (qualquer tipo). */
  hasPaidCharge: boolean;
  /** Alguma parcela de curso paga. */
  hasPaidCourseInstallment: boolean;
  /** Algum pacote de aulas vendido a um aluno. */
  hasPackageSale: boolean;
  /** Alguma mensagem registrada (WhatsApp assistido ou oficial). */
  hasMessage: boolean;
  /** Algum registro de aula, meta ou graduacao na evolucao de um aluno. */
  hasProgressRecord: boolean;
}

/**
 * O que os passos da configuracao inicial precisam, numa leitura so (doc 19,
 * fase 1): contagens e o minimo de cada turma. Antes a barra do topo buscava
 * dez listas inteiras (alunos, agendamentos...) em toda pagina.
 */
export interface OnboardingSnapshot {
  servicesCount: number;
  professionalsCount: number;
  clientsCount: number;
  appointmentsCount: number;
  modalitiesCount: number;
  activePlansCount: number;
  activeLessonPackagesCount: number;
  classGroups: { id: Id; status: RecordStatus; billingMode?: ClassBillingMode; enrolledCount: number }[];
}
