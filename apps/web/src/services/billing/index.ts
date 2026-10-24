import { chargePaymentsService } from "./chargePaymentsService";
import { chargesService } from "./chargesService";
import { lessonPackagesService } from "./lessonPackagesService";
import { plansService } from "./plansService";
import { studentPackagesService } from "./studentPackagesService";
import { delegateAll } from "../world/delegate";

export { chargePaymentsService, chargesService, lessonPackagesService, plansService, studentPackagesService };

export {
} from "./billingSync";
export {
  autoGenerateMembershipCharges,
  cancelCurrentMembershipCharges,
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
export const billingServiceImpl = {
  ...plansService,
  ...chargesService,
  ...chargePaymentsService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const billingService = delegateAll("billing", billingServiceImpl, ["listPlans", "createPlan", "updatePlan"]);

/** Objeto legado: catalogo de pacotes + pacotes dos alunos. */
export const packagesServiceImpl = {
  ...lessonPackagesService,
  ...studentPackagesService,
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const packagesService = delegateAll("packages", packagesServiceImpl, ["listPackages", "createPackage", "updatePackage"]);
