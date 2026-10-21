import { store } from "@/mocks/store";
import { realAccountInBrowser } from "../world/delegate";
import { listChargesFromDb, listPlansFromDb } from "../billingBackend";
import { listLessonPackagesFromDb, listStudentPackagesFromDb } from "../packagesBackend";

export async function syncPlansFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const dbPlans = await listPlansFromDb(organizationId);
  const dbMap = new Map(dbPlans.map((p) => [p.id, p]));
  for (let i = 0; i < store.plans.length; i++) {
    const existing = store.plans[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.plans[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newPlan of dbMap.values()) {
    store.plans.push(newPlan);
  }
}

export async function syncChargesFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const dbCharges = await listChargesFromDb(organizationId);
  const dbMap = new Map(dbCharges.map((c) => [c.id, c]));
  for (let i = 0; i < store.charges.length; i++) {
    const existing = store.charges[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.charges[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newCharge of dbMap.values()) {
    store.charges.push(newCharge);
  }
  // Mensalidade que so existe neste navegador (gerada aqui antes da fatia 1 do
  // doc 15) nao vale: a geracao agora e no servidor e o banco e a fonte.
  const inDb = new Set(dbCharges.map((c) => c.id));
  store.charges = store.charges.filter(
    (c) => c.organizationId !== organizationId || c.kind !== "membership" || inDb.has(c.id),
  );
}

// --- Sync with DB -----------------------------------------------------------

export async function syncLessonPackagesFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const dbPackages = await listLessonPackagesFromDb(organizationId);
  const dbMap = new Map(dbPackages.map((p) => [p.id, p]));
  for (let i = 0; i < store.lessonPackages.length; i++) {
    const existing = store.lessonPackages[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.lessonPackages[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newPkg of dbMap.values()) {
    store.lessonPackages.push(newPkg);
  }
}

export async function syncStudentPackagesFromDb(organizationId: string): Promise<void> {
  if (!realAccountInBrowser(organizationId)) return;
  const dbPkgs = await listStudentPackagesFromDb(organizationId);
  const dbMap = new Map(dbPkgs.map((p) => [p.id, p]));
  for (let i = 0; i < store.studentPackages.length; i++) {
    const existing = store.studentPackages[i];
    const fromDb = dbMap.get(existing.id);
    if (fromDb) {
      store.studentPackages[i] = fromDb;
      dbMap.delete(existing.id);
    }
  }
  for (const newPkg of dbMap.values()) {
    store.studentPackages.push(newPkg);
  }
}
