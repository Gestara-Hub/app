import { chargePaymentsService } from "./chargePaymentsService";
import { chargesService } from "./chargesService";
import { lessonPackagesService } from "./lessonPackagesService";
import { plansService } from "./plansService";
import { studentPackagesService } from "./studentPackagesService";

export { chargePaymentsService, chargesService, lessonPackagesService, plansService, studentPackagesService };

export {
  syncChargesFromDb,
  syncLessonPackagesFromDb,
  syncPlansFromDb,
  syncStudentPackagesFromDb,
} from "./billingSync";
export {
  autoGenerateMembershipCharges,
  cancelOpenMembershipCharges,
  chargeStartedMembershipPeriods,
  ensureMembershipCharges,
  isPlanlessScholar,
  membershipPeriodTaken,
  planlessScholarCharges,
  scholarshipChargeFields,
  studentMembershipTerms,
} from "./membershipCharges";
export {
  acceptsPackages,
  hasPackageUsage,
  hasUsablePackage,
  packageCandidatesFor,
  packageRosterInfo,
  syncPackageUsage,
  type PackageUsageChange,
} from "./packageUsage";

/** Objeto legado: planos + cobrancas (mesmos metodos de antes). */
export const billingService = {
  ...plansService,
  ...chargesService,
  ...chargePaymentsService,
};

/** Objeto legado: catalogo de pacotes + pacotes dos alunos. */
export const packagesService = {
  ...lessonPackagesService,
  ...studentPackagesService,
};
