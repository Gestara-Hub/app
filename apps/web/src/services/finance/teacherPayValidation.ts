import type {
  ApiErrorField,
  Id,
  SaveTeacherPayRule,
  TeacherPayComponent,
  TeacherPayComponentKind,
  TeacherPayoutAdjustment,
  TeacherPayoutLine,
} from "@gestarahub/contracts";
import { DEFAULT_TEACHER_PAYMENT_DAY } from "@gestarahub/core/finance";
import { validationError } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { isCompetence } from "./teacherPayHelpers";

// ---------------------------------------------------------------------------
// Validacao
// ---------------------------------------------------------------------------

export const COMPONENT_KINDS: readonly TeacherPayComponentKind[] = [
  "fixed_monthly",
  "per_session",
  "per_student",
  "percent_of_memberships",
];

export function normalizeComponents(
  professionalId: Id,
  components: TeacherPayComponent[] | undefined,
): TeacherPayComponent[] {
  const fields: ApiErrorField[] = [];
  const list = components ?? [];
  if (list.length === 0) {
    fields.push({ field: "components", message: "Adicione ao menos uma parte ao pagamento." });
  }
  const ownGroups = new Set(
    store.classGroups.filter((g) => g.instructorId === professionalId).map((g) => g.id),
  );
  const out: TeacherPayComponent[] = [];
  list.forEach((c, i) => {
    if (!COMPONENT_KINDS.includes(c.kind)) {
      fields.push({ field: `components.${i}.kind`, message: "Selecione o tipo da parte." });
      return;
    }
    const classGroupIds = [...new Set(c.classGroupIds ?? [])];
    if (classGroupIds.some((id) => !ownGroups.has(id))) {
      fields.push({
        field: `components.${i}.classGroupIds`,
        message: "Escolha apenas turmas em que o professor é titular.",
      });
    }
    const scope = classGroupIds.length > 0 ? { classGroupIds } : {};
    if (c.kind === "percent_of_memberships") {
      const percent = Number(c.percent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        fields.push({
          field: `components.${i}.percent`,
          message: "Informe uma porcentagem maior que 0 e até 100.",
        });
      }
      out.push({ kind: c.kind, percent, ...scope });
      return;
    }
    const amountCents = Number(c.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      fields.push({
        field: `components.${i}.amountCents`,
        message: "Informe um valor maior que zero.",
      });
    }
    // Fixo mensal nao depende de turma.
    out.push({ kind: c.kind, amountCents, ...(c.kind === "fixed_monthly" ? {} : scope) });
  });
  if (fields.length > 0) throw validationError(fields);
  return out;
}

export function validateRulePayload(payload: SaveTeacherPayRule): void {
  const fields: ApiErrorField[] = [];
  const day = payload.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY;
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    fields.push({ field: "paymentDay", message: "Informe um dia entre 1 e 31." });
  }
  if (!isCompetence(payload.startCompetence)) {
    fields.push({ field: "startCompetence", message: "Informe o mês de início." });
  }
  if (fields.length > 0) throw validationError(fields);
}

export function normalizeAdjustments(
  adjustments: TeacherPayoutAdjustment[] | undefined,
): TeacherPayoutLine[] {
  const fields: ApiErrorField[] = [];
  const lines: TeacherPayoutLine[] = [];
  (adjustments ?? []).forEach((a, i) => {
    const label = (a.label ?? "").trim();
    if (!label) fields.push({ field: `adjustments.${i}.label`, message: "Descreva o ajuste." });
    if (!Number.isInteger(a.amountCents) || a.amountCents === 0) {
      fields.push({
        field: `adjustments.${i}.amountCents`,
        message: "Informe um valor diferente de zero.",
      });
    }
    lines.push({ kind: "adjustment", label, amountCents: a.amountCents });
  });
  if (fields.length > 0) throw validationError(fields);
  return lines;
}
