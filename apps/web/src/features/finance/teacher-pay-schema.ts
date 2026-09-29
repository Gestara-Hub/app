import { z } from "zod";
import type {
  SaveTeacherPayRule,
  TeacherPayComponent,
  TeacherPayComponentKind,
  TeacherPayRule,
} from "@gestarahub/contracts";
import { DEFAULT_TEACHER_PAYMENT_DAY } from "@gestarahub/core/finance";

/**
 * Schemas da aba Professores do Financeiro. Mensagens alinhadas ao
 * teacherPayService (que valida de novo no "servidor").
 */

export const TEACHER_PAY_KINDS: readonly TeacherPayComponentKind[] = [
  "fixed_monthly",
  "per_session",
  "per_student",
  "percent_of_memberships",
];

const componentSchema = z
  .object({
    kind: z.enum(["fixed_monthly", "per_session", "per_student", "percent_of_memberships"], {
      error: "Selecione o tipo da parte.",
    }),
    amountCents: z.number().int().nullish(),
    percent: z.number().nullish(),
    classGroupIds: z.array(z.string()),
  })
  .superRefine((c, ctx) => {
    if (c.kind === "percent_of_memberships") {
      if (c.percent == null || c.percent <= 0 || c.percent > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["percent"],
          message: "Informe uma porcentagem maior que 0 e até 100.",
        });
      }
      return;
    }
    if (c.amountCents == null || c.amountCents <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "Informe um valor maior que zero.",
      });
    }
  });

export const teacherPayRuleFormSchema = z.object({
  components: z.array(componentSchema).min(1, "Adicione ao menos uma parte ao pagamento."),
  paymentDay: z
    .number({ error: "Informe um dia entre 1 e 28." })
    .int("Informe um dia entre 1 e 28.")
    .min(1, "Informe um dia entre 1 e 28.")
    .max(28, "Informe um dia entre 1 e 28."),
  startCompetence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe o mês de início."),
  active: z.boolean(),
});

export type TeacherPayRuleFormValues = z.infer<typeof teacherPayRuleFormSchema>;
export type TeacherPayComponentFormValues = TeacherPayRuleFormValues["components"][number];

export function emptyComponent(
  kind: TeacherPayComponentKind = "fixed_monthly",
): TeacherPayComponentFormValues {
  return { kind, amountCents: null, percent: null, classGroupIds: [] };
}

export function ruleToFormValues(
  rule: TeacherPayRule | undefined,
  defaultStart: string,
): TeacherPayRuleFormValues {
  if (!rule) {
    return {
      components: [emptyComponent()],
      paymentDay: DEFAULT_TEACHER_PAYMENT_DAY,
      startCompetence: defaultStart,
      active: true,
    };
  }
  return {
    components: rule.components.map((c) => ({
      kind: c.kind,
      amountCents: c.amountCents ?? null,
      percent: c.percent ?? null,
      classGroupIds: c.classGroupIds ?? [],
    })),
    paymentDay: rule.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY,
    startCompetence: rule.startCompetence,
    active: rule.status === "active",
  };
}

export function formValuesToPayload(values: TeacherPayRuleFormValues): SaveTeacherPayRule {
  return {
    components: values.components.map((c): TeacherPayComponent => {
      const scope =
        c.kind !== "fixed_monthly" && c.classGroupIds.length > 0
          ? { classGroupIds: c.classGroupIds }
          : {};
      return c.kind === "percent_of_memberships"
        ? { kind: c.kind, percent: c.percent ?? 0, ...scope }
        : { kind: c.kind, amountCents: c.amountCents ?? 0, ...scope };
    }),
    paymentDay: values.paymentDay,
    startCompetence: values.startCompetence,
    status: values.active ? "active" : "inactive",
  };
}

/** Tipo do ajuste do fechamento: bonus soma; desconto e vale subtraem. */
export type AdjustmentType = "bonus" | "discount" | "advance";

export const ADJUSTMENT_TYPES: readonly AdjustmentType[] = ["bonus", "discount", "advance"];

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  bonus: "Bônus",
  discount: "Desconto",
  advance: "Vale",
};

export const adjustmentFormSchema = z.object({
  type: z.enum(["bonus", "discount", "advance"], { error: "Selecione o tipo do ajuste." }),
  label: z.string().trim().min(1, "Descreva o ajuste."),
  amountCents: z
    .number({ error: "Informe um valor maior que zero." })
    .int("Informe um valor maior que zero.")
    .min(1, "Informe um valor maior que zero."),
});

export type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

/** Valor com sinal do ajuste (desconto/vale negativos). */
export function signedAdjustment(values: Pick<AdjustmentFormValues, "type" | "amountCents">): number {
  return values.type === "bonus" ? values.amountCents : -values.amountCents;
}
