import { store } from "@/mocks/store";
import { isSupabaseOrganization } from "@/lib/session";
import { listTeacherPayoutsFromDb, listTeacherPayRulesFromDb } from "../teacherPayBackend";

export async function syncTeacherPayFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  const [rules, payouts] = await Promise.all([
    listTeacherPayRulesFromDb(organizationId),
    listTeacherPayoutsFromDb(organizationId),
  ]);

  // Sync Rules
  const ruleMap = new Map(rules.map((r) => [r.id, r]));
  for (let i = 0; i < store.teacherPayRules.length; i++) {
    const existing = store.teacherPayRules[i];
    if (existing.organizationId === organizationId) {
      const fromDb = ruleMap.get(existing.id);
      if (fromDb) {
        store.teacherPayRules[i] = fromDb;
        ruleMap.delete(existing.id);
      }
    }
  }
  for (const r of ruleMap.values()) {
    store.teacherPayRules.push(r);
  }

  // Sync Payouts
  const payoutMap = new Map(payouts.map((p) => [p.id, p]));
  for (let i = 0; i < store.teacherPayouts.length; i++) {
    const existing = store.teacherPayouts[i];
    if (existing.organizationId === organizationId) {
      const fromDb = payoutMap.get(existing.id);
      if (fromDb) {
        store.teacherPayouts[i] = fromDb;
        payoutMap.delete(existing.id);
      }
    }
  }
  for (const p of payoutMap.values()) {
    store.teacherPayouts.push(p);
  }
}
