import type { Id, SaveTeacherPayRule, TeacherPayRule } from "@gestarahub/contracts";
import { DEFAULT_TEACHER_PAYMENT_DAY, describeTeacherPayRule } from "@gestarahub/core/finance";
import { newId, notFoundError, nowIso, simulateRead, simulateWrite } from "@/mocks/helpers";
import { store } from "@/mocks/store";
import { auditLogService } from "../auditLogService";
import { isSupabaseOrganization } from "@/lib/session";
import { saveTeacherPayRuleInDb } from "../teacherPayBackend";
import { clone, ruleOf } from "./teacherPayHelpers";
import { syncTeacherPayFromDb } from "./teacherPayStore";
import { normalizeComponents, validateRulePayload } from "./teacherPayValidation";
import type { TeacherPayTeacher } from "./teacherPayViews";

export const teacherPayRulesService = {
  /** Professores (ativos ou com regra) com as turmas em que sao titulares. */
  listTeachers(): Promise<TeacherPayTeacher[]> {
    return simulateRead(async () => {
      await syncTeacherPayFromDb(store.organization.id);
      const out: TeacherPayTeacher[] = store.professionals
        .filter((p) => p.status === "active" || ruleOf(p.id))
        .map((p) => {
          const rule = ruleOf(p.id);
          return {
            professionalId: p.id,
            name: p.name,
            status: p.status,
            classGroups: store.classGroups
              .filter((g) => g.instructorId === p.id)
              .map((g) => ({ id: g.id, name: g.name, status: g.status }))
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
            rule: rule ? clone(rule) : undefined,
            ruleSummary: rule ? describeTeacherPayRule(rule) : undefined,
          };
        });
      return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
  },

  listRules(): Promise<TeacherPayRule[]> {
    return simulateRead(async () => {
      await syncTeacherPayFromDb(store.organization.id);
      return clone(store.teacherPayRules);
    });
  },

  /** Cria ou substitui a regra do professor (uma por professor). */
  saveRule(professionalId: Id, payload: SaveTeacherPayRule): Promise<TeacherPayRule> {
    return simulateWrite(async () => {
      const professional = store.professionals.find((p) => p.id === professionalId);
      if (!professional) throw notFoundError("Professor não encontrado.");
      const components = normalizeComponents(professionalId, payload.components);
      validateRulePayload(payload);

      const ts = nowIso();
      const existing = ruleOf(professionalId);
      const next = {
        components,
        paymentDay: payload.paymentDay ?? DEFAULT_TEACHER_PAYMENT_DAY,
        startCompetence: payload.startCompetence,
        status: payload.status ?? existing?.status ?? "active",
      };
      let rule: TeacherPayRule;
      if (existing) {
        const before = describeTeacherPayRule(existing);
        Object.assign(existing, next, { updatedAt: ts });
        rule = existing;
        const after = describeTeacherPayRule(rule);
        auditLogService.record({
          action: "updated",
          target: { type: "teacher_pay_rule", id: rule.id, label: professional.name },
          predicate: `atualizou a regra de pagamento de ${professional.name} (${after})`,
          changes:
            before !== after
              ? [{ field: "components", label: "Regra", before, after }]
              : undefined,
        });
      } else {
        rule = {
          id: newId(),
          organizationId: store.organization.id,
          professionalId,
          ...next,
          createdAt: ts,
          updatedAt: ts,
        };
        store.teacherPayRules.push(rule);
        auditLogService.record({
          action: "created",
          target: { type: "teacher_pay_rule", id: rule.id, label: professional.name },
          predicate: `configurou o pagamento de ${professional.name} (${describeTeacherPayRule(rule)})`,
        });
      }

      if (isSupabaseOrganization(store.organization.id)) {
        await saveTeacherPayRuleInDb(rule);
      }

      return clone(rule);
    });
  },
};
