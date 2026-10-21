import type {
  Attendance,
  Category,
  ClassGroup,
  ClassReservation,
  ClassSessionOverride,
  Enrollment,
  Professional,
  StudentPackage,
  WaitlistEntry,
} from "@gestarahub/contracts";
import { isSupabaseOrganization } from "@/lib/session";
import { store } from "@/mocks/store";
import { listCategoriesFromDb } from "../categoriesBackend";
import { listStudentPackagesFromDb } from "../packagesBackend";
import { listProfessionalsFromDb } from "../professionalsBackend";
import {
  listAttendancesFromDb,
  listClassGroupsFromDb,
  listEnrollmentsFromDb,
  listReservationsFromDb,
  listSessionOverridesFromDb,
  listWaitlistFromDb,
} from "../turmasBackend";

export async function syncTurmasFromDb(organizationId: string): Promise<void> {
  if (!isSupabaseOrganization(organizationId)) return;
  try {
    const promises: [
      Promise<ClassGroup[]>,
      Promise<Enrollment[]>,
      Promise<Attendance[]>,
      Promise<WaitlistEntry[]>,
      Promise<ClassReservation[]>,
      Promise<ClassSessionOverride[]>,
      Promise<StudentPackage[]>,
      Promise<Professional[] | null>,
      Promise<Category[] | null>,
    ] = [
      listClassGroupsFromDb(organizationId),
      listEnrollmentsFromDb(organizationId),
      listAttendancesFromDb(organizationId),
      listWaitlistFromDb(organizationId),
      listReservationsFromDb(organizationId),
      listSessionOverridesFromDb(organizationId),
      listStudentPackagesFromDb(organizationId),
      store.professionals.some((p) => p.organizationId === organizationId)
        ? Promise.resolve(null)
        : listProfessionalsFromDb(organizationId),
      store.categories.some((c) => c.organizationId === organizationId)
        ? Promise.resolve(null)
        : listCategoriesFromDb(organizationId),
    ];

    const [groups, enrollments, attendances, waitlist, reservations, overrides, pkgs, profs, cats] =
      await Promise.all(promises);

    const groupIds = new Set(groups.map((g) => g.id));
    store.classGroups = [
      ...store.classGroups.filter((g) => g.organizationId === organizationId ? !groupIds.has(g.id) : true),
      ...groups,
    ];

    const enrollIds = new Set(enrollments.map((e) => e.id));
    store.enrollments = [
      ...store.enrollments.filter((e) => !enrollIds.has(e.id)),
      ...enrollments,
    ];

    const attIds = new Set(attendances.map((a) => a.id));
    store.attendances = [
      ...store.attendances.filter((a) => !attIds.has(a.id)),
      ...attendances,
    ];

    const waitIds = new Set(waitlist.map((w) => w.id));
    store.waitlist = [
      ...store.waitlist.filter((w) => !waitIds.has(w.id)),
      ...waitlist,
    ];

    const resIds = new Set(reservations.map((r) => r.id));
    store.reservations = [
      ...store.reservations.filter((r) => !resIds.has(r.id)),
      ...reservations,
    ];

    store.sessionOverrides = overrides;

    const pkgIds = new Set(pkgs.map((p) => p.id));
    store.studentPackages = [
      ...store.studentPackages.filter((p) => p.organizationId === organizationId ? !pkgIds.has(p.id) : true),
      ...pkgs,
    ];

    if (profs) {
      const profIds = new Set(profs.map((p) => p.id));
      store.professionals = [
        ...store.professionals.filter((p) => p.organizationId === organizationId ? !profIds.has(p.id) : true),
        ...profs,
      ];
    }

    if (cats) {
      const catIds = new Set(cats.map((c) => c.id));
      store.categories = [
        ...store.categories.filter((c) => c.organizationId === organizationId ? !catIds.has(c.id) : true),
        ...cats,
      ];
    }
  } catch (err) {
    console.error("[turmasService] Erro ao sincronizar dados do Supabase:", err);
  }
}
