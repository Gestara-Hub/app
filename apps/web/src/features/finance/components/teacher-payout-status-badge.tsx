import type { TeacherPayoutLine, TeacherPayoutStatus } from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { teacherPayComponentLabel, teacherPayoutStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<TeacherPayoutStatus, string> = {
  open: "border-info/25 bg-info/10 text-info",
  closed: "border-warning/30 bg-warning/10 text-warning",
  paid: "border-success/25 bg-success/10 text-success",
  canceled: "border-border/60 bg-muted/50 text-muted-foreground line-through",
};

/** Badge Prévia / Fechado / Pago do mes do professor. */
export function TeacherPayoutStatusBadge({
  status,
  className,
}: {
  status: TeacherPayoutStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        STATUS_CLASS[status],
        className,
      )}
    >
      {teacherPayoutStatusLabel(status)}
    </span>
  );
}

/** Titulo da linha do calculo com a quantidade ("16 aulas dadas", "25 alunos ativos"). */
export function payoutLineTitle(line: TeacherPayoutLine): string {
  switch (line.kind) {
    case "per_session":
      return plural(line.quantity ?? 0, "aula dada", "aulas dadas");
    case "per_student":
      return plural(line.quantity ?? 0, "aluno ativo", "alunos ativos");
    case "percent_of_memberships":
      return line.label; // "40% de R$ 3.000,00"
    case "fixed_monthly":
      return teacherPayComponentLabel("fixed_monthly");
    case "adjustment":
      return line.label;
  }
}

/** Subtitulo da linha (a conta ou o tipo). */
export function payoutLineDetail(line: TeacherPayoutLine): string | undefined {
  switch (line.kind) {
    case "per_session":
    case "per_student":
      return line.label; // "16 aulas × R$ 60,00"
    case "percent_of_memberships":
      return "Mensalidades pagas atribuídas às turmas dele";
    case "adjustment":
      return line.amountCents >= 0 ? "Ajuste (acréscimo)" : "Ajuste (desconto)";
    default:
      return undefined;
  }
}
